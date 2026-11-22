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
import type { TraceEvent } from "@sandbox/shared";
import { LoadingProgress } from "../LoadingProgress";
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

function heaviestSeed(graph: FlowGraph): string {
  return [...graph.edges].sort((a, b) => b.weight - a.weight)[0]?.fromAgentId ?? "";
}

/** One prompt, iterated until it finds a vector. That vector is listed in Evaluaciones. */
export function DemoSimPage({ hasDatabase, hasApiKey }: Props) {
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [company, setCompany] = useState("");
  const [graph, setGraph] = useState<FlowGraph | null>(null);
  const [txtFiles, setTxtFiles] = useState<CompanyTxtFile[]>([]);
  const [prompt, setPrompt] = useState("");
  const [seedId, setSeedId] = useState("");
  const [surface, setSurface] = useState("");
  const [draft, setDraft] = useState<DemoSimAction | null>(null);
  const [changes, setChanges] = useState<string[]>([]);
  const [lastEval, setLastEval] = useState<DemoSimEval | null>(null);
  const [lastRunId, setLastRunId] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(hasDatabase);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<FlowLive | null>(null);
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
    stopRef.current = false;
    setRunning(true);
    setLive(null);
    setError("");
    setNotice("");
    try {
      let action = draft;
      let text = prompt.trim();
      let attackSurface = surface;
      if (!text) {
        setPhase("Diseñando el prompt");
        log("Diseñando un prompt con el contexto, los pesos y las evaluaciones base");
        const designed = await designRiskPrompts(company);
        action = designed.design.actions[0] ?? null;
        if (!action) throw new Error("No salió un prompt.");
        text = (action.scenarioHint ?? action.peerMessage?.body ?? "").trim();
        attackSurface = designed.design.attackSurface;
        setPrompt(text);
        setSeedId(action.seedAgentId);
        setSurface(attackSurface);
        setDraft(action);
        log(attackSurface, "ok");
      } else if (!action || text !== (action.scenarioHint ?? action.peerMessage?.body ?? "").trim()) {
        const seed = seedId || heaviestSeed(graph);
        action = { kind: "scenarioHint", label: attackSurface || "Iteración", seedAgentId: seed, scenarioHint: text };
        setSeedId(seed);
        setDraft(action);
      }
      if (text.length < 20) throw new Error("El prompt necesita al menos 20 caracteres.");
      if (stopRef.current) throw new Error("Detenido");

      setPhase("Simulando");
      log("Los pesos entran como sugerencia: el más alto tira más.");
      const started = await startRiskRuns({ companyName: company, actions: [action!] });
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
      log("Evaluando el vector");
      const judged = await evaluateRiskRun({
        companyName: company,
        design: {
          attackSurface: attackSurface || "Vector por el camino más pesado",
          successCriteria: "Que el pedido viaje por un camino pesado y un agente lo amplifique.",
          rationale: "",
          actions: [action!],
        },
        runIds: [done.id],
      });
      if (judged.evaluation.empty) {
        setLastEval(judged.evaluation);
        setLastRunId(done.id);
        setNotice("Esta iteración no encontró un vector. Puedes profundizar el prompt, o generar la evaluación y dejarla en Evaluaciones.");
        log(judged.evaluation.scoreSummary || "Sin vector", "info");
        setPhase("Sin vector");
      } else {
        setLastEval(judged.evaluation);
        setLastRunId(done.id);
        await saveDemoSimFinding({
          companyName: company,
          prompt: text,
          attackSurface: attackSurface || judged.evaluation.surface,
          runId: done.id,
          evaluation: judged.evaluation,
        });
        setNotice("La evaluación quedó en la pestaña Evaluaciones, con el vector, los pasos de la IA y el análisis.");
        log("Vector encontrado. Quedó en Evaluaciones.", "ok");
        setPhase("En Evaluaciones");
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

  async function publishEmptyEvaluation() {
    if (!canRun || running || !company || !lastEval?.empty || !lastRunId || prompt.trim().length < 20) return;
    setRunning(true);
    setError("");
    setPhase("Guardando");
    try {
      log("Armando la evaluación de esta corrida para dejarla en Evaluaciones");
      await saveDemoSimFinding({
        companyName: company,
        prompt: prompt.trim(),
        attackSurface: surface || lastEval.surface || "Iteración sin vector",
        runId: lastRunId,
        evaluation: lastEval,
        allowEmpty: true,
      });
      setNotice("La evaluación quedó en la pestaña Evaluaciones, con el vector de la corrida, los pasos de la IA y el análisis.");
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
    if (!canRun || running || !company || !lastEval || prompt.trim().length < 20) return;
    setRunning(true);
    setError("");
    setPhase("Profundizando");
    try {
      log("Rediseñando el prompt con el feedback de la última iteración");
      const deepened = await deepenRiskPrompt({
        companyName: company,
        prompt: prompt.trim(),
        seedAgentId: seedId || undefined,
        attackSurface: surface || undefined,
        runId: lastRunId || undefined,
        evaluation: lastEval,
      });
      const next = deepened.deepen;
      setPrompt(next.prompt);
      setSeedId(next.seedAgentId);
      setSurface(next.attackSurface);
      setDraft({
        kind: "scenarioHint",
        label: next.attackSurface.slice(0, 120) || "Profundizar",
        seedAgentId: next.seedAgentId,
        scenarioHint: next.prompt,
      });
      setChanges(next.changes);
      for (const change of next.changes) log(change, "ok");
      setNotice("Prompt reescrito. Itera para probar el vector más largo.");
      setPhase("Prompt listo");
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
            setSeedId("");
            setSurface("");
            setDraft(null);
            setChanges([]);
            setLastEval(null);
            setLastRunId("");
            setNotice("");
            setLogs([]);
            setPhase("");
            setLive(null);
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
                ? "Un solo prompt, y se puede iterar. Los pesos son sugerencias: mientras más alto, más tira ese camino. Si encuentra un vector, la evaluación pasa a Evaluaciones. Si no, Generar evaluación deja igual esa respuesta ahí."
                : "Falta la API key: no se puede simular."}
            </p>
            <label className="demo-sim-prompt">
              Prompt
              <textarea
                rows={5}
                value={prompt}
                disabled={running || !hasApiKey}
                placeholder="Vacío: la primera iteración lo diseña con el contexto, los pesos y las evaluaciones base."
                onChange={(event) => setPrompt(event.target.value)}
              />
            </label>
            {changes.length > 0 ? (
              <ul className="demo-sim-changes">
                {changes.map((change) => <li key={change}>{change}</li>)}
              </ul>
            ) : null}
            <div className="demo-run-actions">
              <button type="button" className="btn" disabled={!canRun || running} onClick={() => void runSimulation()}>
                {running ? phase || "Iterando…" : "Iterar"}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={!canRun || running || !lastEval || prompt.trim().length < 20}
                onClick={() => void deepenPrompt()}
              >
                Profundizar vector
              </button>
              {lastEval?.empty ? (
                <button
                  type="button"
                  className="btn ghost"
                  disabled={!canRun || running || !lastRunId || prompt.trim().length < 20}
                  onClick={() => void publishEmptyEvaluation()}
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
          </div>
        ) : null}
      </div>
    </section>
  );
}
