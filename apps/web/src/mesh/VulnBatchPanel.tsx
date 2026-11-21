import { useEffect, useRef, useState } from "react";
import {
  VULN_CATEGORIES,
  meanVulnScore,
  type AgentOrigin,
  type VulnBatch,
  type VulnBatchEstimate,
  type VulnBatchResult,
  type VulnCategory,
} from "@sandbox/shared";
import {
  estimateVulnBatch,
  finishVulnBatch,
  listAgents,
  listVulnBatches,
  reportVulnBatchAgent,
  startVulnBatch,
  type StoredAgent,
} from "../api";
import { runAgentVulnPipeline, runPool } from "./vulnPipeline";
import { areaLabel } from "../generator/labels";

const ORIGIN_LABEL: Record<AgentOrigin, string> = {
  manual: "Creados por mí",
  enterprise: "Generados (creador de empresas)",
  seed: "Roster de ejemplo (seed)",
  test: "De prueba",
};

/** Above this upper bound the button asks before spending. */
const CONFIRM_ABOVE_USD = 10;

const CATEGORY_SHORT: Record<VulnCategory, string> = {
  instruction_override: "Override",
  indirect_injection: "Iny. indirecta",
  tool_misuse: "Mal uso tools",
  data_exfiltration: "Exfiltración",
  social_engineering: "Ing. social",
  secret_handling: "Secretos",
};

type LogLine = { text: string; tone: "ok" | "warn" | "err" | "info" };
type LiveState = "queued" | "running" | "ok" | "failed";

const STATE_LABEL: Record<LiveState | "pending", string> = {
  queued: "En cola",
  pending: "Pendiente",
  running: "Evaluando…",
  ok: "Listo",
  failed: "Falló",
};

function tone(score: number): string {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

function Delta({ before, after }: { before: number | undefined; after: number }) {
  if (before === undefined) return null;
  const d = after - before;
  if (d === 0) return <small className="vb-delta">±0</small>;
  // Higher score = more vulnerable, so a rise is bad.
  return <small className={`vb-delta ${d > 0 ? "worse" : "better"}`}>{d > 0 ? `+${d}` : `−${-d}`}</small>;
}

function ScoreCell({ result, category }: { result: VulnBatchResult; category: VulnCategory }) {
  if (!result.scores) return <td className="vb-cell empty">—</td>;
  const score = result.scores[category];
  return (
    <td className={`vb-cell tone-${tone(score)}`}>
      <strong>{score}</strong>
      <Delta before={result.previousScores?.[category]} after={score} />
    </td>
  );
}

export function VulnBatchPanel({
  hasApiKey,
  onOpenEvals,
}: {
  hasApiKey: boolean;
  onOpenEvals: (agentId: string) => void;
}) {
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [iterations, setIterations] = useState(1);
  const [maxTurns, setMaxTurns] = useState(6);
  const [concurrency, setConcurrency] = useState(2);
  // Default: only the agents made by hand in the agent creator.
  const [origin, setOrigin] = useState<AgentOrigin>("manual");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [estimate, setEstimate] = useState<VulnBatchEstimate | null>(null);
  const [batches, setBatches] = useState<VulnBatch[]>([]);
  const [shownId, setShownId] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, LiveState>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const stopRef = useRef(false);
  const consoleRef = useRef<HTMLPreElement>(null);

  function log(text: string, toneName: LogLine["tone"] = "info") {
    setLogs((prev) => [...prev.slice(-300), { text, tone: toneName }]);
  }

  function upsertBatch(batch: VulnBatch) {
    setBatches((prev) => [batch, ...prev.filter((b) => b.id !== batch.id)]);
  }

  useEffect(() => {
    listAgents().then(setAgents).catch(() => setError("No se pudieron cargar los agentes."));
    listVulnBatches()
      .then((list) => {
        setBatches(list);
        setShownId((id) => id ?? list[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  const pool = agents.filter((a) => a.origin === origin);
  const selected = pool.filter((a) => checked.has(a.id));
  const agentIds = selected.map((a) => a.id);
  const originCounts = agents.reduce<Partial<Record<AgentOrigin, number>>>((acc, a) => {
    acc[a.origin] = (acc[a.origin] ?? 0) + 1;
    return acc;
  }, {});

  // Changing the group (or reloading agents) ticks every agent in it.
  useEffect(() => {
    setChecked(new Set(agents.filter((a) => a.origin === origin).map((a) => a.id)));
  }, [agents, origin]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (selected.length === 0) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    estimateVulnBatch({ agentIds, iterations, maxTurnsPerAgent: maxTurns, concurrency })
      .then((e) => !cancelled && setEstimate(e))
      .catch(() => !cancelled && setEstimate(null));
    return () => {
      cancelled = true;
    };
    // agentIds is derived from agents + origin + checked.
  }, [agents, origin, checked, iterations, maxTurns, concurrency]);

  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  async function runAll() {
    if (running || !hasApiKey || selected.length === 0) return;
    if (
      estimate &&
      estimate.approxMaxUsd > CONFIRM_ABOVE_USD &&
      !window.confirm(
        `Vas a evaluar ${estimate.agents} agentes (${estimate.runs} corridas). Costo máximo estimado: US$ ${estimate.approxMaxUsd.toFixed(2)}. ¿Continuar?`,
      )
    ) {
      return;
    }
    stopRef.current = false;
    setRunning(true);
    setError("");
    setLogs([]);
    let batch: VulnBatch;
    try {
      batch = await startVulnBatch({ agentIds, iterations, maxTurnsPerAgent: maxTurns, concurrency });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRunning(false);
      return;
    }
    upsertBatch(batch);
    setShownId(batch.id);
    setLive(Object.fromEntries(batch.results.map((r) => [r.agentId, "queued" as LiveState])));
    log(`Lote ${batch.id}: ${batch.results.length} agentes, ${concurrency} a la vez`);

    // An object, so TypeScript does not narrow it to null across the async workers.
    const halt: { fatal: string | null } = { fatal: null };
    const shouldStop = () => stopRef.current || halt.fatal !== null;

    await runPool(
      batch.results,
      concurrency,
      async (result) => {
        const name = result.agentName;
        setLive((prev) => ({ ...prev, [result.agentId]: "running" }));
        log(`▶ ${name}`);
        const outcome = await runAgentVulnPipeline({
          agentId: result.agentId,
          iterations,
          maxTurnsPerAgent: maxTurns,
          shouldStop,
          log: (line, t) => log(`  ${name}: ${line}`, t ?? "info"),
        });
        if (!outcome.ok && outcome.fatal) halt.fatal = outcome.error;
        try {
          const updated = await reportVulnBatchAgent(batch.id, result.agentId, outcome.ok
            ? { status: "ok" }
            : { status: "failed", error: outcome.error });
          upsertBatch(updated);
          const row = updated.results.find((r) => r.agentId === result.agentId);
          const state: LiveState = row?.status === "ok" ? "ok" : "failed";
          setLive((prev) => ({ ...prev, [result.agentId]: state }));
          log(
            state === "ok"
              ? `✔ ${name}: media ${row?.scores ? meanVulnScore(row.scores) : "?"}${outcome.ok && outcome.failedRuns ? ` (${outcome.failedRuns} corridas fallidas)` : ""}`
              : `✘ ${name}: ${row?.error ?? (outcome.ok ? "sin assessment" : outcome.error)}`,
            state === "ok" ? "ok" : "err",
          );
        } catch (err) {
          setLive((prev) => ({ ...prev, [result.agentId]: "failed" }));
          log(`✘ ${name}: no se pudo guardar (${err instanceof Error ? err.message : String(err)})`, "err");
        }
      },
      shouldStop,
    );

    const status = halt.fatal ? "failed" : stopRef.current ? "stopped" : "completed";
    if (halt.fatal) {
      setError(halt.fatal);
      log(`Lote detenido: ${halt.fatal}`, "err");
    }
    try {
      upsertBatch(await finishVulnBatch(batch.id, status));
    } catch {
      log("No se pudo cerrar el lote en el servidor.", "warn");
    }
    log(status === "completed" ? "Lote completo." : "Lote detenido; se guardó lo terminado.", status === "completed" ? "ok" : "warn");
    setRunning(false);
    stopRef.current = false;
  }

  function stop() {
    if (!running) return;
    stopRef.current = true;
    log("Deteniendo: los agentes en curso terminan su paso actual y se scorean con lo que tengan.", "warn");
  }

  const shown = batches.find((b) => b.id === shownId) ?? null;
  const isLive = running && shown?.id === batches[0]?.id;
  const finished = shown?.results.filter((r) => r.status !== "pending").length ?? 0;

  return (
    <section className="vb-card">
      <div className="vb-head">
        <div>
          <span className="mesh-label">PASO 0 · EVALUACIÓN MASIVA</span>
          <h2>Evaluar mis agentes</h2>
          <p className="mesh-vuln-muted">
            Corre los 6 ataques de vulnerabilidad (diseño → corridas en solitario → puntaje) para los agentes que marques y
            guarda una foto del lote, con los puntajes de antes y de después. Por defecto solo los que creaste en el
            Creador de agentes.
          </p>
        </div>
        <div className="vb-actions">
          {running ? (
            <button type="button" className="btn mesh-evals-stop" onClick={stop}>
              Detener
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => void runAll()}
              disabled={!hasApiKey || selected.length === 0}
              title={!hasApiKey ? "La API no tiene ANTHROPIC_API_KEY" : undefined}
            >
              Evaluar {selected.length} {selected.length === 1 ? "agente" : "agentes"}
            </button>
          )}
        </div>
      </div>

      <div className="vb-controls">
        <label>
          Grupo
          <select value={origin} disabled={running} onChange={(e) => setOrigin(e.target.value as AgentOrigin)}>
            {(Object.keys(ORIGIN_LABEL) as AgentOrigin[])
              .filter((o) => o === "manual" || originCounts[o])
              .map((o) => (
                <option key={o} value={o}>
                  {ORIGIN_LABEL[o]} ({originCounts[o] ?? 0})
                </option>
              ))}
          </select>
        </label>
        <label>
          Rondas por agente
          <input type="number" min={1} max={3} value={iterations} disabled={running}
            onChange={(e) => setIterations(Math.min(3, Math.max(1, Number(e.target.value) || 1)))} />
        </label>
        <label>
          Turnos máx. por corrida
          <input type="number" min={1} max={12} value={maxTurns} disabled={running}
            onChange={(e) => setMaxTurns(Math.min(12, Math.max(1, Number(e.target.value) || 6)))} />
        </label>
        <label>
          Agentes en paralelo
          <input type="number" min={1} max={4} value={concurrency} disabled={running}
            onChange={(e) => setConcurrency(Math.min(4, Math.max(1, Number(e.target.value) || 2)))} />
        </label>
        {estimate && (
          <p className="vb-estimate">
            {estimate.agents} agentes · {estimate.runs} corridas · hasta {estimate.maxModelCalls} llamadas al modelo ·{" "}
            <strong>≤ US$ {estimate.approxMaxUsd.toFixed(2)}</strong> <small>(cota alta)</small>
          </p>
        )}
      </div>
      <div className="vb-picker">
        <div className="vb-picker-head">
          <span>
            {selected.length} de {pool.length} marcados
          </span>
          <button type="button" className="btn ghost" disabled={running} onClick={() => setChecked(new Set(pool.map((a) => a.id)))}>
            Todos
          </button>
          <button type="button" className="btn ghost" disabled={running} onClick={() => setChecked(new Set())}>
            Ninguno
          </button>
        </div>
        {pool.length === 0 ? (
          <p className="mesh-vuln-muted">
            {origin === "manual"
              ? "Aún no creaste agentes. Usa Creador de agentes y vuelve aquí."
              : "No hay agentes en este grupo."}
          </p>
        ) : (
          <ul className="vb-picker-list">
            {pool.map((a) => (
              <li key={a.id}>
                <label>
                  <input type="checkbox" checked={checked.has(a.id)} disabled={running} onChange={() => toggle(a.id)} />
                  <span>{a.name}</span>
                  <small>
                    {a.title} · {areaLabel(a.areaId)}
                  </small>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!hasApiKey && <p className="mesh-vuln-muted">Sin ANTHROPIC_API_KEY en la API: no se pueden lanzar evaluaciones.</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {batches.length > 0 && (
        <div className="vb-history">
          <label>
            Lote
            <select value={shownId ?? ""} onChange={(e) => setShownId(e.target.value)} disabled={running}>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {new Date(b.createdAt).toLocaleString()} · {b.status} · {b.results.filter((r) => r.status === "ok").length}/{b.results.length}
                </option>
              ))}
            </select>
          </label>
          {shown && <span className="mesh-vuln-muted">{finished}/{shown.results.length} terminados</span>}
        </div>
      )}

      {shown && (
        <div className="vb-table-wrap">
          <table className="vb-table">
            <thead>
              <tr>
                <th>Agente</th>
                <th>Estado</th>
                {VULN_CATEGORIES.map((c) => <th key={c}>{CATEGORY_SHORT[c]}</th>)}
                <th>Media</th>
              </tr>
            </thead>
            <tbody>
              {shown.results.map((r) => {
                const state: LiveState | "pending" = isLive ? live[r.agentId] ?? r.status : r.status;
                return (
                  <tr key={r.agentId}>
                    <td>
                      <button type="button" className="vb-agent" onClick={() => onOpenEvals(r.agentId)} disabled={running}>
                        {r.agentName}
                      </button>
                    </td>
                    <td className={`vb-state ${state}`} title={r.error ?? undefined}>{STATE_LABEL[state]}</td>
                    {VULN_CATEGORIES.map((c) => <ScoreCell key={c} result={r} category={c} />)}
                    {r.scores ? (
                      <td className={`vb-cell tone-${tone(meanVulnScore(r.scores))}`}>
                        <strong>{meanVulnScore(r.scores)}</strong>
                        <Delta
                          before={r.previousScores ? meanVulnScore(r.previousScores) : undefined}
                          after={meanVulnScore(r.scores)}
                        />
                      </td>
                    ) : (
                      <td className="vb-cell empty">—</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mesh-vuln-meta">
            Puntaje 1–100, más alto = más vulnerable. La diferencia compara con el assessment guardado antes del lote. Un
            solo lote es una muestra pequeña: trata las diferencias de pocos puntos como ruido.
          </p>
        </div>
      )}

      {logs.length > 0 && (
        <div className="mesh-evals-console-wrap">
          <div className="mesh-evals-console-head">
            <span>Consola del lote</span>
            <span>{running ? "En curso" : "Terminado"}</span>
          </div>
          <pre className="mesh-evals-console" ref={consoleRef}>
            {logs.map((l, i) => (
              <div key={i} className={`log-${l.tone}`}>{l.text}</div>
            ))}
          </pre>
        </div>
      )}
    </section>
  );
}
