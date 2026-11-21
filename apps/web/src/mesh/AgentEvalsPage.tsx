import { useEffect, useRef, useState } from "react";
import {
  VULN_CATEGORIES,
  type AgentVulnAssessment,
  type VulnCategory,
  type VulnDesignerBrief,
  type VulnScores,
} from "@sandbox/shared";
import {
  designVulnScenarios,
  finalizeVulnAssessment,
  getAgent,
  getVulnAssessment,
  runOneVulnScenario,
  type StoredAgent,
  type VulnRunTraceDto,
} from "../api";

const CATEGORY_LABELS: Record<VulnCategory, string> = {
  instruction_override: "Override de instrucciones",
  indirect_injection: "Inyección indirecta",
  tool_misuse: "Mal uso de tools",
  data_exfiltration: "Exfiltración de datos",
  social_engineering: "Ingeniería social",
  secret_handling: "Manejo de secretos",
};

type LogLine = { ts: string; text: string; tone?: "info" | "ok" | "warn" | "err" };

function scoreTone(score: number): string {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

function formatDelta(prev: VulnScores | null, next: VulnScores): string {
  return VULN_CATEGORIES.map((cat) => {
    const before = prev?.[cat];
    const after = next[cat];
    if (before == null) return `${cat}=${after}`;
    const d = after - before;
    const sign = d > 0 ? `+${d}` : `${d}`;
    return `${cat} ${before}→${after} (${sign})`;
  }).join(" · ");
}

export function AgentEvalsPage({
  agentId,
  hasApiKey,
  onBack,
}: {
  agentId: string;
  hasApiKey: boolean;
  onBack: () => void;
}) {
  const [agent, setAgent] = useState<StoredAgent | null>(null);
  const [assessment, setAssessment] = useState<AgentVulnAssessment | null>(null);
  const [iterations, setIterations] = useState(1);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [error, setError] = useState("");
  const stopRef = useRef(false);
  const consoleRef = useRef<HTMLPreElement>(null);

  function log(text: string, tone: LogLine["tone"] = "info") {
    const line = { ts: new Date().toLocaleTimeString("es-CL"), text, tone };
    setLogs((prev) => [...prev, line]);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([getAgent(agentId), getVulnAssessment(agentId)])
      .then(([a, v]) => {
        if (cancelled) return;
        setAgent(a);
        setAssessment(v);
      })
      .catch((failure) => {
        if (!cancelled) {
          setError(
            failure instanceof Error ? failure.message : "No se pudo cargar el agente",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  async function runPipeline() {
    if (!agent || running || !hasApiKey) return;
    stopRef.current = false;
    setRunning(true);
    setError("");
    setLogs([]);
    const iters = Math.min(10, Math.max(1, iterations));
    const traces: VulnRunTraceDto[] = [];
    let brief: VulnDesignerBrief | null = null;
    let lastAssessment = assessment;

    try {
      setPhase("Diseñando escenarios…");
      log(`Diseñando escenarios adversariales para ${agent.name}…`);
      const designed = await designVulnScenarios(agentId);
      if (stopRef.current) {
        log("Stop solicitado durante el diseño — sin traces para scorear.", "warn");
        return;
      }
      brief = designed.brief;
      log(
        `Listo: ${brief.scenarios.length} escenarios (${brief.scenarios.map((s) => s.category).join(", ")})`,
        "ok",
      );

      for (let iter = 1; iter <= iters; iter++) {
        if (stopRef.current) break;
        setPhase(`Iteración ${iter}/${iters}`);
        log(`── Iteración ${iter}/${iters} ──`);

        for (const scenario of brief.scenarios) {
          if (stopRef.current) break;
          const label = CATEGORY_LABELS[scenario.category] ?? scenario.category;
          setPhase(`Iter ${iter}: ${label}`);
          log(`[${label}] ${scenario.title}`);
          log(`  hint: ${scenario.scenarioHint.slice(0, 140).replace(/\s+/g, " ")}…`);

          try {
            const result = await runOneVulnScenario(agentId, {
              category: scenario.category,
              title: scenario.title,
              scenarioHint: scenario.scenarioHint,
              grantFinanceTools: scenario.grantFinanceTools,
              rationale: scenario.rationale,
              maxTurnsPerAgent: 6,
              iteration: iter,
            });
            traces.push(result);
            log(
              `  run ${result.runId} → ${result.status}${result.error ? ` (${result.error})` : ""}`,
              result.status === "failed" ? "err" : "ok",
            );
            if (result.trace) {
              const preview = result.trace.split("\n").slice(0, 4).join(" | ");
              log(`  trace: ${preview.slice(0, 220)}`);
            }
          } catch (failure) {
            const msg =
              failure instanceof Error ? failure.message : String(failure);
            log(`  ERROR en ${label}: ${msg}`, "err");
          }
        }

        if (traces.length === 0) {
          log("Sin traces aún; no se puede scorear esta iteración.", "warn");
          continue;
        }

        if (stopRef.current) {
          log("Stop: scoreando con lo acumulado hasta ahora…", "warn");
        } else {
          log(`Scoreando iteración ${iter} con ${traces.length} traces…`);
        }
        setPhase(`Scoreando iteración ${iter}…`);

        const finalized = await finalizeVulnAssessment(agentId, {
          brief,
          runTraces: traces,
          updateAgentDescription: true,
        });
        lastAssessment = finalized.assessment;
        setAssessment(finalized.assessment);
        log(`Scores: ${formatDelta(finalized.previousScores, finalized.assessment.scores)}`, "ok");
        log(`Resumen: ${finalized.assessment.summary}`);
        if (finalized.descriptionUpdated) {
          log(
            "Cambio detectado → descripción natural del agente actualizada (orgHints.notes).",
            "ok",
          );
          setAgent((prev) =>
            prev
              ? {
                  ...prev,
                  orgHints: {
                    ...(prev.orgHints ?? {}),
                    notes: finalized.assessment.summary,
                  },
                }
              : prev,
          );
        } else {
          log("Sin cambio significativo de scores; descripción del agente intacta.");
        }

        if (stopRef.current) break;
      }

      if (stopRef.current) {
        log("Pipeline detenido. Se conservó el último assessment persistido.", "warn");
      } else {
        log("Pipeline completo.", "ok");
      }
      setPhase(lastAssessment ? "Listo" : "Detenido");
    } catch (failure) {
      const msg = failure instanceof Error ? failure.message : String(failure);
      setError(msg);
      log(`FATAL: ${msg}`, "err");
      setPhase("Error");

      if (brief && traces.length > 0) {
        try {
          log("Intentando guardar assessment parcial…", "warn");
          const finalized = await finalizeVulnAssessment(agentId, {
            brief,
            runTraces: traces,
            updateAgentDescription: true,
          });
          setAssessment(finalized.assessment);
          log("Assessment parcial guardado.", "ok");
        } catch {
          log("No se pudo guardar el assessment parcial.", "err");
        }
      }
    } finally {
      setRunning(false);
      stopRef.current = false;
    }
  }

  function requestStop() {
    if (!running) return;
    stopRef.current = true;
    log("STOP solicitado — se corta tras el paso en curso y se scorea lo acumulado.", "warn");
    setPhase("Deteniendo…");
  }

  if (loading) {
    return (
      <div className="mesh-evals">
        <p className="mesh-vuln-muted">Cargando agente…</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="mesh-evals">
        <p className="error" role="alert">
          {error || "Agente no encontrado"}
        </p>
        <button type="button" className="btn ghost" onClick={onBack}>
          ← Volver
        </button>
      </div>
    );
  }

  const characterization =
    assessment?.summary ||
    agent.orgHints?.notes ||
    "Aún no hay una caracterización de seguridad generada para este agente.";

  return (
    <div className="mesh-evals">
      <div className="mesh-evals-top">
        <button type="button" className="btn ghost" onClick={onBack} disabled={running}>
          ← Organización
        </button>
        <span className="mesh-pill">{running ? phase || "En curso" : "Evals de vulnerabilidad"}</span>
      </div>

      <div className="mesh-evals-grid">
        <section className="mesh-evals-card">
          <span className="mesh-label">Agente</span>
          <h2>{agent.name}</h2>
          <p className="mesh-evals-meta">
            {agent.title} · {agent.areaId} · {agent.knobs.seniority} ·{" "}
            {agent.knobs.motivation} · proactividad {agent.knobs.proactivity}
          </p>
          <h3>Caracterización</h3>
          <p className="mesh-vuln-summary">{characterization}</p>
          <h3>Goal</h3>
          <p>{agent.goalTemplate}</p>
          <h3>Estilo</h3>
          <ul className="mesh-evals-style">
            {agent.operatingStyle.slice(0, 6).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h3>Tools</h3>
          <div className="mesh-tags">
            {agent.harnessTools.length ? (
              agent.harnessTools.map((tool) => <code key={tool}>{tool}</code>)
            ) : (
              <p>Sin tools</p>
            )}
          </div>
        </section>

        <section className="mesh-evals-card">
          <h3>Scores actuales</h3>
          {assessment ? (
            <ul className="mesh-vuln-scores">
              {VULN_CATEGORIES.map((category) => {
                const score = assessment.scores[category];
                return (
                  <li key={category} className={`tone-${scoreTone(score)}`}>
                    <span>{CATEGORY_LABELS[category]}</span>
                    <strong>{score}</strong>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mesh-vuln-muted">
              Aún no se generan scores. Configura iteraciones y dale play.
            </p>
          )}

          <div className="mesh-evals-controls">
            <label>
              Iteraciones por atributo
              <input
                type="number"
                min={1}
                max={10}
                value={iterations}
                disabled={running}
                onChange={(event) =>
                  setIterations(Number(event.target.value) || 1)
                }
              />
            </label>
            <div className="mesh-evals-actions">
              <button
                type="button"
                className="btn"
                disabled={running || !hasApiKey}
                onClick={() => void runPipeline()}
                title={
                  hasApiKey
                    ? "Diseñar, correr y scorear"
                    : "Falta ANTHROPIC_API_KEY"
                }
              >
                {running ? "▶ En curso…" : "▶ Play"}
              </button>
              <button
                type="button"
                className="btn ghost mesh-evals-stop"
                disabled={!running}
                onClick={requestStop}
              >
                ■ Stop
              </button>
            </div>
          </div>
          {!hasApiKey ? (
            <p className="mesh-vuln-muted">Configura ANTHROPIC_API_KEY en la API.</p>
          ) : (
            <p className="mesh-vuln-muted">
              Cada iteración corre las 6 categorías en solo-run, scorea, y si los
              scores cambian actualiza la descripción natural del agente.
            </p>
          )}
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      </div>

      <section className="mesh-evals-console-wrap">
        <div className="mesh-evals-console-head">
          <span className="mesh-label">Consola</span>
          <span>{phase || (logs.length ? "—" : "En espera")}</span>
        </div>
        <pre className="mesh-evals-console" ref={consoleRef} aria-live="polite">
          {logs.length === 0
            ? "# La ejecución paso a paso aparecerá aquí.\n# Play → design → runs → score por iteración."
            : logs.map((line, index) => (
                <span key={`${line.ts}-${index}`} className={`log-${line.tone ?? "info"}`}>
                  [{line.ts}] {line.text}
                  {"\n"}
                </span>
              ))}
        </pre>
      </section>
    </div>
  );
}
