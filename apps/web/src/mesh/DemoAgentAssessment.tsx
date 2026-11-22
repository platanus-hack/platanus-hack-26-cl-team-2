import { useEffect, useState } from "react";
import { VULN_CATEGORIES, evaluationJobActive, type AgentVulnAssessment, type EvaluationJob, type EvaluationJobStatus, type VulnCategory } from "@sandbox/shared";
import { cancelEvaluationJob, getVulnAssessment, listEvaluationJobs, startEvaluationJob, type StoredAgent } from "../api";
import { areaLabel } from "../generator/labels";
import { LoadingProgress } from "../LoadingProgress";

const labels: Record<VulnCategory, string> = {
  instruction_override: "Reemplazo de instrucciones", indirect_injection: "Inyección indirecta",
  tool_misuse: "Abuso de herramientas", data_exfiltration: "Exfiltración de datos",
  social_engineering: "Ingeniería social", secret_handling: "Manejo de secretos",
};
function agentFace(agent: StoredAgent): { name: string; role: string } {
  const raw = agent.name.trim();
  const [person, ...rest] = raw.split(/\s+[—–-]\s+/);
  const fromName = rest.join(" — ").trim();
  const stored = agent.title.trim();
  const role = stored && stored !== raw && stored !== person ? stored : fromName;
  return { name: person || raw, role };
}

const jobLabels: Record<EvaluationJobStatus, string> = {
  queued: "En cola", running: "Analizando", cancelling: "Deteniendo",
  completed: "Completado", failed: "Falló o fue interrumpido", cancelled: "Detenido",
};

/** The browser only schedules jobs and polls; the server worker owns the execution. */
export function DemoAgentAssessment({ agents, hasApiKey }: { agents: StoredAgent[]; hasApiKey: boolean }) {
  const [assessments, setAssessments] = useState<Record<string, AgentVulnAssessment | null>>({});
  const [jobs, setJobs] = useState<EvaluationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [pollError, setPollError] = useState("");
  const [iterations, setIterations] = useState(1);
  const company = agents[0]?.orgHints?.companyName ?? "";

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const results = await listEvaluationJobs();
        if (!cancelled) { setJobs(results.filter((j) => j.company === company)); setPollError(""); }
      } catch (err) {
        if (!cancelled) setPollError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) { setQueueLoading(false); timer = setTimeout(() => void poll(), 2500); }
      }
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [company]);

  // Reload durable attributes when a job changes state, including when returning to this page.
  const resultsVersion = jobs.map((j) => `${j.id}:${j.status}`).join("|");
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(agents.map(async (agent) => [agent.id, await getVulnAssessment(agent.id)] as const))
      .then((entries) => { if (!cancelled) setAssessments(Object.fromEntries(entries)); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agents, resultsVersion]);

  async function schedule(roster: StoredAgent[]) {
    if (actionBusy) return;
    setActionBusy(true); setError("");
    try {
      const job = await startEvaluationJob(roster.map((a) => a.id), iterations);
      setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setActionBusy(false); }
  }
  async function cancel(id: string) {
    setActionBusy(true); setError("");
    try {
      const job = await cancelEvaluationJob(id);
      setJobs((prev) => prev.map((j) => j.id === id ? job : j));
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setActionBusy(false); }
  }
  const activeJobs = jobs.filter((j) => evaluationJobActive(j.status));
  const busyAgent = (id: string) => activeJobs.some((j) => j.agents.some((a) => a.id === id));
  const classificationFor = (agent: StoredAgent) => assessments[agent.id]?.designerBrief?.classification;
  const areaFor = (agent: StoredAgent) => classificationFor(agent)?.areaId ?? agent.areaId;
  return <div className="demo-assessment">
    <div className="demo-eval-controls">
      <label>Repeticiones<input type="number" min={1} max={3} value={iterations} disabled={actionBusy} onChange={(e) => setIterations(Math.max(1, Math.min(3, Number(e.target.value) || 1)))} /></label>
      <button className="btn" type="button" disabled={actionBusy || queueLoading || !hasApiKey || !agents.length || agents.length > 24 || agents.some((a) => busyAgent(a.id))} onClick={() => void schedule(agents)}>Analizar todos</button>
    </div>
    {!hasApiKey && <p className="error">Falta configurar la API key para ejecutar pruebas.</p>}
    {(loading || queueLoading) && <LoadingProgress label="Recuperando análisis y atributos guardados…" />}
    {actionBusy && <LoadingProgress label="Actualizando la cola de análisis…" />}
    {pollError && <p className="error" role="alert">No se pudo actualizar el avance: {pollError}. Reintentando; el worker sigue ejecutándose si está activo.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {jobs.length > 0 && <section><h3>Análisis en segundo plano</h3>{jobs.map((job) => <article className="demo-agent-card" key={job.id}>
      <header><div><strong>{jobLabels[job.status]}</strong><p>{job.agents.map((a) => a.name).join(", ")}</p></div>
        {evaluationJobActive(job.status) && <button className="btn ghost" disabled={actionBusy || job.status === "cancelling"} onClick={() => void cancel(job.id)}>Detener</button>}
      </header>
      {job.status === "queued" ? <LoadingProgress label="En cola: esperando al worker de análisis…" />
        : job.status === "running" || job.status === "cancelling" ? <LoadingProgress label={job.status === "cancelling" ? "Deteniendo después del paso actual…" : job.phase} value={job.completedSteps} total={job.totalSteps} />
        : <p>{job.phase} · {job.completedSteps}/{job.totalSteps} pasos</p>}
      <small>Creado: {new Date(job.createdAt).toLocaleString("es-CL")} · {job.id}</small>
      <details><summary>Registro y estado por agente</summary><ul>{Object.entries(job.agentStatus).map(([id, status]) => <li key={id}>{status}</li>)}</ul><pre className="demo-assessment-log">{job.logs.join("\n") || "Esperando ejecución"}</pre></details>
    </article>)}</section>}
    <ul className="demo-eval-grid">
      {agents.map((agent) => {
        const assessment = assessments[agent.id];
        const card = agentFace(agent);
        const classified = classificationFor(agent);
        return <li key={agent.id} className="demo-eval-card">
          <h3 className="demo-agent-name">{card.name}</h3>
          {card.role ? <p className="demo-agent-title">{card.role}</p> : null}
          <p className="demo-agent-fn">{areaLabel(areaFor(agent))}</p>
          <div className="demo-eval-body">
            <details><summary>Descripción</summary><pre>{agent.systemContext}</pre></details>
            {classified ? <p><strong>{classified.function}</strong><br />{classified.rationale}</p> : <p className="hint">Función pendiente de clasificación.</p>}
            <p>Herramientas: {agent.harnessTools.join(", ") || "Sin herramientas"}</p>
            {assessment ? <><p>{assessment.summary}</p>
              <div className="demo-attributes"><table><thead><tr><th>Atributo</th><th>Vulnerabilidad</th><th>Evidencia</th></tr></thead><tbody>
                {VULN_CATEGORIES.map((cat) => <tr key={cat}><th scope="row">{labels[cat]}</th><td><meter min={1} max={100} value={assessment.scores[cat]} /> {assessment.scores[cat]}/100</td><td>{assessment.categoryNotes[cat] || "Sin observación"}</td></tr>)}
              </tbody></table></div>
            </> : <p className="hint">Sin evaluar.</p>}
          </div>
          <button className="btn ghost" type="button" disabled={actionBusy || queueLoading || !hasApiKey || busyAgent(agent.id)} onClick={() => void schedule([agent])}>{busyAgent(agent.id) ? "Análisis pendiente" : "Analizar"}</button>
        </li>;
      })}
    </ul>
  </div>;
}
