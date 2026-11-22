import { useEffect, useMemo, useRef, useState } from "react";
import {
  designEverydayProblems,
  fetchCompanyTxtFiles,
  fetchFlowGraph,
  fetchRun,
  listAgents,
  startCharacterizeRuns,
  summarizeFlows,
  type CompanyTxtFile,
  type EverydayProblem,
  type FlowGraph,
  type StoredAgent,
} from "../api";
import { areaLabel } from "../generator/labels";
import { FlowGraphView } from "./FlowGraph";
import "./demo-setup.css";
import { CompanyTxtFiles } from "./CompanyTxtFiles";
import { DemoAgentAssessment } from "./DemoAgentAssessment";
import { LoadingProgress } from "../LoadingProgress";

type Props = { hasDatabase: boolean; hasApiKey: boolean };

type LogLine = { text: string; tone: "info" | "ok" | "err" };

const BATCH = 5;
const MAX_PARTICIPANTS = 8;

function companyName(agent: StoredAgent): string {
  return agent.orgHints?.companyName?.trim() ?? "";
}

function agentCard(agent: StoredAgent): { name: string; title: string; fn: string } {
  const raw = agent.name.trim();
  const [person, ...rest] = raw.split(/\s+[—–-]\s+/);
  const fromName = rest.join(" — ").trim();
  const stored = agent.title.trim();
  const title =
    stored && stored !== raw && stored !== person ? stored : fromName;
  return { name: person || raw, title, fn: areaLabel(agent.areaId) };
}

function PersonBadge() {
  return (
    <svg className="demo-agent-icon" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="33" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="36" cy="28" r="8" />
        <path d="M20 52c0-12 32-12 32 0" />
      </g>
    </svg>
  );
}

function participantIds(agents: StoredAgent[], seedId: string): string[] {
  const ids = agents.map((agent) => agent.id);
  if (ids.length <= MAX_PARTICIPANTS) return ids;
  return [seedId, ...ids.filter((id) => id !== seedId).slice(0, MAX_PARTICIPANTS - 1)];
}

async function waitForRun(runId: string, shouldStop: () => boolean) {
  const started = Date.now();
  while (Date.now() - started < 180_000) {
    if (shouldStop()) throw new Error("Detenido");
    const { run } = await fetchRun(runId);
    if (run.status === "completed" || run.status === "failed") return run;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("La ejecución tardó demasiado");
}

/** Espacio A genera problemas cotidianos. Espacio B clasifica y evalúa los agentes. */
export function DemoSetupPage({ hasDatabase, hasApiKey }: Props) {
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [company, setCompany] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [bulkScore, setBulkScore] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(hasDatabase);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [graph, setGraph] = useState<FlowGraph | null>(null);
  const [txtFiles, setTxtFiles] = useState<CompanyTxtFile[]>([]);
  const [filesTick, setFilesTick] = useState(0);
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
    setError("");
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
  }, [company, filesTick]);

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
    () =>
      company
        ? agents
            .filter((agent) => companyName(agent) === company)
            .sort((a, b) => a.name.localeCompare(b.name, "es"))
        : [],
    [agents, company],
  );

  const readySeeds = selectedIds.filter((id) => {
    const value = Number(scores[id]);
    return Number.isInteger(value) && value >= 1 && value <= 100;
  });
  const canRun = hasApiKey && readySeeds.length === selectedIds.length && readySeeds.length > 0;
  const allOn = companyAgents.length > 0 && companyAgents.every((agent) => selectedIds.includes(agent.id));

  function applyBulk(raw: string) {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    if (raw !== "") {
      const value = Number(raw);
      if (value < 1 || value > 100) return;
    }
    setBulkScore(raw);
    if (raw === "") return;
    setScores((prev) => {
      const next = { ...prev };
      for (const agent of companyAgents) next[agent.id] = raw;
      return next;
    });
  }

  function log(text: string, tone: LogLine["tone"] = "info") {
    const ts = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [...prev, { text: `${ts}  ${text}`, tone }]);
  }

  async function problemsFor(seedId: string, total: number, names: Map<string, string>): Promise<EverydayProblem[]> {
    const problems: EverydayProblem[] = [];
    const avoidTitles: string[] = [];
    let emptyStreak = 0;
    while (problems.length < total) {
      if (stopRef.current) throw new Error("Detenido");
      const count = Math.min(BATCH, total - problems.length);
      const name = names.get(seedId) ?? "Agente";
      setPhase(`${name} · diseñando ${problems.length + 1}–${problems.length + count}`);
      log(`${name}: diseñando ${count} problema${count === 1 ? "" : "s"}`);
      const designed = await designEverydayProblems({
        seedAgentId: seedId,
        agentIds: participantIds(companyAgents, seedId),
        count,
        avoidTitles,
      });
      // Prefer unseen titles; if the batch collides, keep going with renamed copies.
      const fresh = designed.problems.filter((problem) => !avoidTitles.includes(problem.title));
      const batch = fresh.length ? fresh : designed.problems.map((problem, index) => ({
        ...problem,
        title: avoidTitles.includes(problem.title)
          ? `${problem.title} (${problems.length + index + 1})`
          : problem.title,
      }));
      if (!batch.length) {
        emptyStreak += 1;
        if (emptyStreak >= 3) throw new Error(`No se pudieron armar problemas para ${name}.`);
        log(`${name}: tanda vacía, reintentando…`, "info");
        continue;
      }
      emptyStreak = 0;
      for (const problem of batch) {
        if (problems.length >= total) break;
        problems.push(problem);
        avoidTitles.push(problem.title);
        log(`${name}: ${problem.title}`, "ok");
      }
    }
    return problems;
  }

  async function runCharacterization() {
    if (!canRun || running) return;
    stopRef.current = false;
    setRunning(true);
    setError("");
    setLogs([]);
    setGraph(null);
    setProgress({ done: 0, total: 0 });
    const labels = new Map(companyAgents.map((agent) => [agent.id, agentCard(agent).name] as const));
    const names = Object.fromEntries(labels);
    try {
      setPhase("Diseñando problemas");
      const groups = await Promise.all(
        readySeeds.map(async (seedId) => {
          const total = Number(scores[seedId]);
          const problems = await problemsFor(seedId, total, labels);
          return problems.map((problem) => ({
            seedId,
            scenarioHint: problem.scenarioHint,
            agentIds: participantIds(companyAgents, seedId),
          }));
        }),
      );
      const jobs = groups.flat();
      if (jobs.length > 40) throw new Error("Máximo 40 simulaciones por tanda.");
      if (stopRef.current) throw new Error("Detenido");
      setPhase(`Disparando ${jobs.length} simulaciones`);
      log(`Disparando ${jobs.length} simulaci${jobs.length === 1 ? "ón" : "ones"} juntas`);
      setProgress({ done: 0, total: jobs.length });
      const started = await startCharacterizeRuns(
        jobs.map((job) => ({
          agentIds: job.agentIds,
          seedAgentId: job.seedId,
          scenarioHint: job.scenarioHint,
          maxTurnsPerAgent: 5,
        })),
      );
      let done = 0;
      const finished = await Promise.all(
        started.runs.map(async (run, index) => {
          const seedId = jobs[index]!.seedId;
          const name = labels.get(seedId) ?? "Agente";
          log(`${name} · ${run.id} en curso`);
          const result = await waitForRun(run.id, () => stopRef.current);
          done += 1;
          setProgress({ done, total: started.runs.length });
          setPhase(`${done}/${started.runs.length} listas`);
          log(
            `${name} · ${run.id} ${result.status === "failed" ? "falló" : "lista"}`,
            result.status === "failed" ? "err" : "ok",
          );
          return { run: result, seedId };
        }),
      );
      if (stopRef.current) throw new Error("Detenido");
      setPhase("Contando conexiones");
      log("Contando conexiones");
      const summary = await summarizeFlows({
        companyName: company,
        runs: finished.map((row) => ({
          runId: row.run.id,
          seedAgentId: row.seedId,
          names,
        })),
      });
      setGraph(summary.graph);
      log(`Listo. ${summary.graph.nodes.length} nodos, ${summary.graph.edges.length} conexiones.`, "ok");
      setPhase("Listo");
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      if (message === "Detenido") {
        setPhase("Detenido");
        log("Detenido.", "info");
      } else {
        setError(message);
        setPhase("Error");
        log(message, "err");
      }
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
          onChange={(event) => {
            setCompany(event.target.value);
            setSelectedIds([]);
            setBulkScore("");
            setLogs([]);
            setGraph(null);
            setPhase("");
          }}
          disabled={!hasDatabase || loading || companies.length === 0 || running}
        >
          <option value="">{loading ? "Cargando…" : "Elige una empresa"}</option>
          {companies.map(([name, count]) => (
            <option key={name} value={name}>
              {name} · {count} agente{count === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>
      {loading && <LoadingProgress label="Cargando empresas y agentes…" />}
      {!hasDatabase ? <p className="error">Base de datos no disponible: no hay empresas cargadas.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && hasDatabase && !error && companies.length === 0 ? (
        <p className="hint">No hay empresas cargadas. Créalas en Empresa y agentes.</p>
      ) : null}
      <div className="demo-setup-spaces">
        <div
          className="demo-space demo-space-characterize"
          onClick={(event) => {
            if (running) return;
            if (!(event.target as HTMLElement).closest(".demo-agent, .demo-run, .demo-bulk")) setSelectedIds([]);
          }}
        >
          <h2>Caracteriza tu empresa</h2>
          {companyAgents.length > 0 ? (
            <div className="demo-bulk">
              <label className="demo-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={allOn}
                  disabled={running}
                  aria-label="Activar todos"
                  onChange={(event) =>
                    setSelectedIds(event.target.checked ? companyAgents.map((agent) => agent.id) : [])
                  }
                />
                <span className="demo-switch-track" aria-hidden="true" />
              </label>
              <input
                className="demo-agent-score"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                step={1}
                disabled={running}
                aria-label="Número para todos"
                value={bulkScore}
                onChange={(event) => applyBulk(event.target.value)}
              />
            </div>
          ) : null}
          {companyAgents.length > 0 ? (
            <ul className="demo-roster">
              {companyAgents.map((agent) => {
                const card = agentCard(agent);
                const selected = selectedIds.includes(agent.id);
                return (
                  <li key={agent.id} className={selected ? "demo-agent selected" : "demo-agent"}>
                    <button
                      type="button"
                      className="demo-agent-pick"
                      aria-pressed={selected}
                      disabled={running}
                      onClick={() =>
                        setSelectedIds((prev) =>
                          prev.includes(agent.id) ? prev.filter((id) => id !== agent.id) : [...prev, agent.id],
                        )
                      }
                    >
                      <PersonBadge />
                      <h3 className="demo-agent-name">{card.name}</h3>
                      {card.title ? <p className="demo-agent-title">{card.title}</p> : null}
                      {card.fn ? <p className="demo-agent-fn">{card.fn}</p> : null}
                    </button>
                    {selected ? (
                      <input
                        className="demo-agent-score"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={100}
                        step={1}
                        disabled={running}
                        autoFocus={selectedIds[selectedIds.length - 1] === agent.id}
                        aria-label={`Número de problemas para ${card.name}`}
                        value={scores[agent.id] ?? ""}
                        onChange={(event) => {
                          const raw = event.target.value;
                          if (raw === "") {
                            setScores((prev) => ({ ...prev, [agent.id]: "" }));
                            return;
                          }
                          if (!/^\d+$/.test(raw)) return;
                          const value = Number(raw);
                          if (value < 1 || value > 100) return;
                          setScores((prev) => ({ ...prev, [agent.id]: String(value) }));
                        }}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {companyAgents.length > 0 ? (
            <div className="demo-run">
              <p className="demo-run-note">
                {hasApiKey
                  ? "El número es cuántos problemas distintos parte ese agente. Todas las simulaciones salen juntas. Al terminar, el grafo muestra cada conexión y su peso."
                  : "Falta la API key: no se pueden generar problemas."}
              </p>
              <div className="demo-run-actions">
                <button type="button" className="btn" disabled={!canRun || running} onClick={() => void runCharacterization()}>
                  {running ? phase || "Generando…" : "Generar problemas"}
                </button>
                {running ? (
                  <button type="button" className="btn ghost" onClick={() => { stopRef.current = true; }}>
                    Detener
                  </button>
                ) : null}
              </div>
              {logs.length > 0 ? (
                <div className="demo-console">
                  <p>Consola{progress.total > 0 ? ` · ${progress.done}/${progress.total}` : ""}</p>
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
              {graph && graph.nodes.length > 0 ? <FlowGraphView graph={graph} files={txtFiles} /> : null}
            </div>
          ) : null}
        </div>
        <div className="demo-space demo-space-evaluate">
          <h2>Evalúa los agentes en solitario</h2>
          {company ? (
            <>
              <DemoAgentAssessment key={company} agents={companyAgents} hasApiKey={hasApiKey} />
              <CompanyTxtFiles
                company={company}
                agents={companyAgents}
                onSaved={() => {
                  setFilesTick((tick) => tick + 1);
                  listAgents().then(setAgents).catch((err) => setError(err instanceof Error ? err.message : String(err)));
                }}
              />
            </>
          ) : <p className="demo-run-note">Selecciona una empresa para evaluar sus agentes.</p>}
        </div>
      </div>
    </section>
  );
}
