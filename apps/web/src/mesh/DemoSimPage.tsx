import { useEffect, useMemo, useRef, useState } from "react";
import {
  designRiskPrompts,
  deepenRiskPrompt,
  evaluateRiskRun,
  fetchCompanyTxtFiles,
  fetchFlowGraph,
  fetchRun,
  listAgents,
  saveDemoSimFinding,
  startRiskRuns,
  type CompanyTxtFile,
  type DemoSimAction,
  type DemoSimEval,
  type FlowGraph,
  type StoredAgent,
} from "../api";
import { FlowGraphView, type FlowLive } from "./FlowGraph";
import { AnalysisList } from "./DemoSimFindings";
import type { TraceEvent } from "@sandbox/shared";
import { LoadingProgress } from "../LoadingProgress";
import "../evaluations-list.css";
import "./demo-setup.css";

type Props = { hasDatabase: boolean; hasApiKey: boolean };
type LogLine = { text: string; tone: "info" | "ok" | "err" };

function companyName(agent: StoredAgent): string {
  return agent.orgHints?.companyName?.trim() ?? "";
}

function liveFromEvents(events: TraceEvent[]): FlowLive | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]!;
    if (event.type === "agent.message_sent") {
      const message = (event.payload.message ?? {}) as { fromAgentId?: string; toAgentId?: string };
      const fromAgentId = message.fromAgentId || event.agentId;
      const toAgentId = message.toAgentId;
      if (fromAgentId && toAgentId && fromAgentId !== toAgentId) return { kind: "flow", fromAgentId, toAgentId };
    }
    if (event.type === "agent.tool_call" || event.type === "sandbox.tool_attempt") {
      const name = String(event.payload.name ?? event.payload.tool ?? "");
      const slug = name.match(/^(.+)_txt_(?:read|write)$/)?.[1];
      if (slug && event.agentId) return { kind: "file", agentId: event.agentId, slug };
    }
  }
  return null;
}

async function waitForRun(runId: string, shouldStop: () => boolean, onTick?: (events: TraceEvent[]) => void) {
  const started = Date.now();
  while (Date.now() - started < 180_000) {
    if (shouldStop()) throw new Error("Detenido");
    const { run, events } = await fetchRun(runId);
    onTick?.(events);
    if (run.status === "completed" || run.status === "failed") return run;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("La ejecución tardó demasiado");
}

/** One step per agent, walking the heaviest unused hop. Extra steps repeat that walk. */
function suggestedPath(graph: FlowGraph, count: number): string[] {
  const nodes = [...graph.nodes].sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label, "es"));
  if (!nodes.length || count <= 0) return [];
  const outgoing = new Map<string, FlowGraph["edges"]>();
  for (const edge of graph.edges) {
    if (edge.fromAgentId === edge.toAgentId || edge.weight <= 0) continue;
    const list = outgoing.get(edge.fromAgentId) ?? [];
    list.push(edge);
    outgoing.set(edge.fromAgentId, list);
  }
  for (const list of outgoing.values()) list.sort((a, b) => b.weight - a.weight || a.to.localeCompare(b.to, "es"));
  const path = [nodes[0]!.agentId];
  const seen = new Set(path);
  while (path.length < Math.min(count, nodes.length)) {
    const from = path[path.length - 1]!;
    const next = (outgoing.get(from) ?? []).find((edge) => !seen.has(edge.toAgentId));
    if (next) {
      path.push(next.toAgentId);
      seen.add(next.toAgentId);
      continue;
    }
    const spare = nodes.find((node) => !seen.has(node.agentId));
    if (!spare) break;
    path.push(spare.agentId);
    seen.add(spare.agentId);
  }
  let guard = 0;
  while (path.length < count && guard < count) {
    guard += 1;
    const from = path[path.length - 1]!;
    const next = (outgoing.get(from) ?? []).find((edge) => edge.toAgentId !== from) ?? graph.edges.find((edge) => edge.toAgentId !== from);
    if (!next) break;
    path.push(next.toAgentId);
  }
  return path.slice(0, count);
}

/** The user writes an objective. The planner writes the message an agent actually receives. */
export function DemoSimPage({ hasDatabase, hasApiKey }: Props) {
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [company, setCompany] = useState("");
  const [graph, setGraph] = useState<FlowGraph | null>(null);
  const [txtFiles, setTxtFiles] = useState<CompanyTxtFile[]>([]);
  const [prompt, setPrompt] = useState("");
  const [delivered, setDelivered] = useState("");
  const [plannedFor, setPlannedFor] = useState("");
  const [seedId, setSeedId] = useState("");
  const [surface, setSurface] = useState("");
  const [draft, setDraft] = useState<DemoSimAction | null>(null);
  const [changes, setChanges] = useState<string[]>([]);
  const [lastEval, setLastEval] = useState<DemoSimEval | null>(null);
  const [lastRunId, setLastRunId] = useState("");
  const [publishedRunId, setPublishedRunId] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(hasDatabase);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<FlowLive | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const stopRef = useRef(false);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!hasDatabase) {
      setAgents([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listAgents()
      .then((list) => {
        if (!cancelled) setAgents(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasDatabase]);

  useEffect(() => {
    if (!company) {
      setGraph(null);
      return;
    }
    let cancelled = false;
    fetchFlowGraph(company)
      .then((stored) => {
        if (!cancelled) setGraph(stored);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [company]);

  useEffect(() => {
    if (!company) {
      setTxtFiles([]);
      return;
    }
    let cancelled = false;
    fetchCompanyTxtFiles(company)
      .then((stored) => {
        if (!cancelled) setTxtFiles(stored);
      })
      .catch(() => {
        if (!cancelled) setTxtFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [company]);

  useEffect(() => {
    if (!graph || graph.nodes.length === 0) {
      setSteps([]);
      return;
    }
    setSteps(suggestedPath(graph, graph.nodes.length));
  }, [graph]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const companies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const agent of agents) {
      const name = companyName(agent);
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [agents]);

  const companyAgents = useMemo(
    () => (company ? agents.filter((agent) => companyName(agent) === company) : []),
    [agents, company],
  );

  const canRun = hasApiKey && Boolean(graph && graph.edges.length > 0) && companyAgents.length >= 2;

  function log(text: string, tone: LogLine["tone"] = "info") {
    const ts = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [...prev, { text: `${ts}  ${text}`, tone }]);
  }

  async function runSimulation() {
    if (!canRun || running || !company || !graph) return;
    const objective = prompt.trim();
    if (objective.length < 20) {
      setError("El objetivo necesita al menos 20 caracteres.");
      return;
    }
    stopRef.current = false;
    setRunning(true);
    setLive(null);
    setError("");
    setNotice("");
    try {
      let action = plannedFor === objective && delivered.trim().length >= 20 ? draft : null;
      let attackSurface = surface;
      let rationale = "";
      if (!action) {
        setPhase("Diseñando el mensaje");
        log("El objetivo se queda acá. El sistema arma el mensaje con la comunicación, el trabajo, los permisos y las evaluaciones.");
        const designed = await designRiskPrompts(company, objective, steps.length || graph.nodes.length);
        action = designed.design.actions[0] ?? null;
        if (!action) throw new Error("No salió un mensaje.");
        const text = (action.scenarioHint ?? action.peerMessage?.body ?? "").trim();
        if (text.length < 20) throw new Error("El mensaje para el agente salió demasiado corto.");
        attackSurface = designed.design.attackSurface;
        rationale = designed.design.rationale;
        setDelivered(text);
        setPlannedFor(objective);
        setSeedId(action.seedAgentId);
        setSurface(attackSurface);
        setDraft(action);
        log(attackSurface, "ok");
        if (rationale) log(rationale);
      }
      if (stopRef.current) throw new Error("Detenido");

      setPhase("Simulando");
      const seedName = companyAgents.find((agent) => agent.id === action.seedAgentId)?.name ?? "el agente";
      log(`Mensaje enviado a ${seedName}. El objetivo no va en ese texto.`);
      const started = await startRiskRuns({
        companyName: company,
        actions: [action],
        maxTurns: steps.length || graph.nodes.length,
      });
      const run = started.runs[0];
      if (!run) throw new Error("No partió la simulación.");
      log(`Run ${run.id} en curso`);
      const done = await waitForRun(run.id, () => stopRef.current, (events) => {
        const next = liveFromEvents(events);
        if (next) setLive(next);
      });
      log(`Run ${run.id} → ${done.status}`, done.status === "failed" ? "err" : "ok");
      if (stopRef.current) throw new Error("Detenido");

      setPhase("Evaluando");
      log("Evaluando si el objetivo se cumplió");
      const judged = await evaluateRiskRun({
        companyName: company,
        design: {
          attackSurface: attackSurface || objective,
          successCriteria: objective,
          rationale,
          actions: [action],
        },
        runIds: [done.id],
      });
      setLastEval(judged.evaluation);
      setLastRunId(done.id);
      for (const step of judged.evaluation.failuresAmplifications) log(step, judged.evaluation.empty ? "info" : "ok");
      if (judged.evaluation.empty) {
        setNotice("El objetivo no se cumplió. Abajo está lo que pasó. Puedes guardar la evaluación, o seguir iterando para cambiar la estrategia.");
        log("Objetivo no cumplido.", "info");
        setPhase("Objetivo pendiente");
      } else {
        setNotice("El objetivo se cumplió. Abajo está lo que pasó. Guarda la evaluación, o sigue iterando para apretar el mismo camino.");
        log("Objetivo cumplido. Todavía no está en Evaluaciones.", "ok");
        setPhase("Objetivo cumplido");
      }
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      if (message === "Detenido") {
        setPhase("Detenido");
        log("Detenido.");
      } else {
        setError(message);
        setPhase("Error");
        log(message, "err");
      }
    } finally {
      setRunning(false);
    }
  }

  async function publishEvaluation() {
    if (!canRun || running || !company || !lastEval || !lastRunId || delivered.trim().length < 20 || publishedRunId === lastRunId) return;
    setRunning(true);
    setError("");
    setPhase("Guardando");
    try {
      log("Armando la evaluación de esta corrida para dejarla en Evaluaciones");
      await saveDemoSimFinding({
        companyName: company,
        prompt: delivered.trim(),
        attackSurface: surface || prompt.trim() || lastEval.surface || (lastEval.empty ? "Objetivo no cumplido" : "Objetivo cumplido"),
        runId: lastRunId,
        evaluation: lastEval,
        allowEmpty: lastEval.empty,
      });
      setPublishedRunId(lastRunId);
      setNotice("La evaluación quedó en la pestaña Evaluaciones.");
      log("Evaluación guardada. Quedó en Evaluaciones.", "ok");
      setPhase("En Evaluaciones");
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      setError(message);
      setPhase("Error");
      log(message, "err");
    } finally {
      setRunning(false);
    }
  }

  async function deepenPrompt() {
    if (!canRun || running || !company || !lastEval || prompt.trim().length < 20 || delivered.trim().length < 20) return;
    setRunning(true);
    setError("");
    setPhase("Profundizando");
    try {
      log("Rediseñando el mensaje con lo que pensaron los agentes. El objetivo no cambia.");
      const deepened = await deepenRiskPrompt({
        companyName: company,
        prompt: delivered.trim(),
        seedAgentId: seedId || undefined,
        attackSurface: prompt.trim(),
        runId: lastRunId || undefined,
        evaluation: lastEval,
      });
      const next = deepened.deepen;
      setDelivered(next.prompt);
      setSeedId(next.seedAgentId);
      setDraft({
        kind: "scenarioHint",
        label: "Siguiente mensaje",
        seedAgentId: next.seedAgentId,
        scenarioHint: next.prompt,
      });
      setChanges(next.changes);
      for (const change of next.changes) log(change, "ok");
      setNotice("Hay un mensaje nuevo para el mismo objetivo. Itera de nuevo para mandarlo, o guarda la evaluación de lo que ya pasó.");
      setPhase("Mensaje listo");
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      setError(message);
      setPhase("Error");
      log(message, "err");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="demo-setup">
      <label className="demo-setup-pick">
        Empresa
        <select
          value={company}
          disabled={!hasDatabase || loading || companies.length === 0 || running}
          onChange={(event) => {
            setCompany(event.target.value);
            setGraph(null);
            setPrompt("");
            setDelivered("");
            setPlannedFor("");
            setSeedId("");
            setSurface("");
            setDraft(null);
            setChanges([]);
            setLastEval(null);
            setLastRunId("");
            setPublishedRunId("");
            setNotice("");
            setLogs([]);
            setPhase("");
            setLive(null);
            setSteps([]);
            setError("");
          }}
        >
          <option value="">{loading ? "Cargando…" : "Elige una empresa"}</option>
          {companies.map(([name, count]) => (
            <option key={name} value={name}>
              {name} · {count} agente{count === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>
      {loading ? <LoadingProgress label="Cargando empresas y agentes…" /> : null}
      {!hasDatabase ? <p className="error">Base de datos no disponible: no hay empresas cargadas.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="demo-space demo-space-characterize demo-space-sim">
        <h2>Simula el riesgo</h2>
        {!company ? <p className="demo-run-note">Elige una empresa para ver su grafo de caracterización.</p> : null}
        {company && !graph ? (
          <p className="demo-run-note">Esta empresa todavía no tiene grafo. Caracterízala en DEMO SETUP.</p>
        ) : null}
        {graph && graph.nodes.length > 0 ? <FlowGraphView graph={graph} files={txtFiles} live={live} /> : null}
        {graph && graph.edges.length > 0 ? (
          <div className="demo-run">
            <p className="demo-run-note">
              {hasApiKey
                ? "Escribes el objetivo. El sistema lee la comunicación, el trabajo, los permisos y las evaluaciones, y manda otro mensaje al agente que elige."
                : "Falta la API key: no se puede simular."}
            </p>
            <label className="demo-sim-prompt">
              Objetivo
              <textarea
                rows={5}
                value={prompt}
                disabled={running || !hasApiKey}
                placeholder="Qué quieres que pase: confundir a dos agentes, un ping-pong, comprobar que una base no se abre, o llegar a un archivo."
                onChange={(event) => setPrompt(event.target.value)}
              />
            </label>
            {delivered ? (
              <p className="demo-run-note demo-sim-delivered">
                Mensaje enviado{seedId ? ` a ${companyAgents.find((agent) => agent.id === seedId)?.name.split(/\s+[—–-]\s+/)[0] ?? "un agente"}` : ""}: {delivered}
              </p>
            ) : null}
            {graph.nodes.length > 0 ? (
              <label className="demo-sim-steps">
                Pasos
                <input
                  type="number"
                  min={1}
                  max={1000}
                  aria-label="Pasos"
                  value={steps.length || graph.nodes.length}
                  disabled={running}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isInteger(next) || next < 1 || next > 1000) return;
                    setSteps(suggestedPath(graph, next));
                  }}
                />
              </label>
            ) : null}
            {changes.length > 0 ? (
              <ul className="demo-sim-changes">
                {changes.map((change) => <li key={change}>{change}</li>)}
              </ul>
            ) : null}
            <div className="demo-run-actions">
              <button type="button" className="btn" disabled={!canRun || running || prompt.trim().length < 20} onClick={() => void runSimulation()}>
                {running ? phase || "Iterando…" : "Iterar"}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={!canRun || running || !lastEval || delivered.trim().length < 20}
                onClick={() => void deepenPrompt()}
              >
                Seguir iterando
              </button>
              {lastEval && publishedRunId !== lastRunId ? (
                <button
                  type="button"
                  className="btn ghost"
                  disabled={!canRun || running || !lastRunId || delivered.trim().length < 20}
                  onClick={() => void publishEvaluation()}
                >
                  Generar evaluación
                </button>
              ) : null}
              {running ? (
                <button type="button" className="btn ghost" onClick={() => { stopRef.current = true; }}>
                  Detener
                </button>
              ) : null}
            </div>
            {logs.length > 0 ? (
              <div className="demo-console">
                <p>Consola</p>
                <pre ref={logRef} aria-live="polite">
                  {logs.map((line, index) => (
                    <span key={index} className={`demo-run-line ${line.tone}`}>
                      {line.text}
                      {"\n"}
                    </span>
                  ))}
                </pre>
              </div>
            ) : null}
            {notice ? <p className="demo-run-note">{notice}</p> : null}
            {lastEval && lastEval.failuresAmplifications.length > 0 ? (
              <AnalysisList items={lastEval.failuresAmplifications} />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
