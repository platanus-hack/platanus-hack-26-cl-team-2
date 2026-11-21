import { randomUUID } from "node:crypto";
import { VULN_CATEGORIES, type EvaluationJobData } from "@sandbox/shared";
import { getAgent } from "../db/agents-repo.js";
import { claimEvaluationJob, expireEvaluationJobs, getEvaluationJob, listEvaluationJobs, updateEvaluationJob } from "../db/evaluation-jobs-repo.js";
import { designVulnScenariosForAgent, finalizeVulnAssessment, runOneVulnScenario, type VulnRunTrace } from "../harness/vuln-assess.js";
import { demoGuard } from "../security/budget.js";
import { errorMessage } from "../security/redact.js";

class Cancelled extends Error {}
const modelSteps = { design: designVulnScenariosForAgent, run: runOneVulnScenario, finalize: finalizeVulnAssessment };

/** Independent of HTTP requests and browser connections. One job at a time per worker. */
export async function processEvaluationJob(id: string, steps = modelSteps): Promise<void> {
  const owner = randomUUID();
  if (!await claimEvaluationJob(id, owner)) return;
  const job = await getEvaluationJob(id);
  if (!job) return;
  const data: EvaluationJobData = { ...job, phase: "Preparando análisis" };
  let failed = false;
  const save = async (phase: string, agentId?: string) => {
    data.phase = phase;
    if (agentId) data.agentStatus[agentId] = phase;
    data.logs = [...data.logs.slice(-199), `${new Date().toISOString()} ${phase}`];
    await updateEvaluationJob(id, owner, data);
  };
  const check = async () => {
    for (;;) {
      const current = await getEvaluationJob(id);
      if (!current || current.status !== "running") throw new Cancelled();
      const guard = demoGuard.checkModelCall("evaluation-worker");
      if (guard.ok) return;
      if (guard.reason !== "rate") throw new Error(guard.message);
      await save("Pausa por límite de frecuencia; reanudación automática");
      await new Promise((resolve) => setTimeout(resolve, Math.min(5000, guard.retryAfterSec * 1000)));
    }
  };
  const heartbeat = setInterval(() => { void updateEvaluationJob(id, owner).catch(() => {}); }, 10_000);
  try {
    for (const member of job.agents) {
      await check();
      const agent = await getAgent(member.id);
      if (!agent || agent.updatedAt !== member.version) throw new Error(`${member.name}: el perfil cambió desde que se programó el análisis. Inicia uno nuevo.`);
      await save(`${member.name}: clasificando función y diseñando ataques`, member.id);
      const { brief } = await steps.design(member.id);
      data.completedSteps++;
      if (VULN_CATEGORIES.some((cat) => !brief.scenarios.some((s) => s.category === cat))) throw new Error("Diseño incompleto: faltan atributos.");
      const traces: VulnRunTrace[] = [];
      for (let iteration = 1; iteration <= job.iterations; iteration++) {
        for (const scenario of brief.scenarios) {
          await check();
          await save(`${member.name}: ${scenario.category} · ${iteration}/${job.iterations}`, member.id);
          const result = await steps.run({ agentId: member.id, scenario, maxTurnsPerAgent: 6, iteration });
          if (result.status !== "completed") throw new Error(`${member.name}: prueba incompleta (${result.error || result.status}).`);
          traces.push(result);
          data.completedSteps++;
          await save(`${member.name}: prueba terminada · ${result.runId}`, member.id);
        }
      }
      await check();
      const current = await getAgent(member.id);
      if (!current || current.updatedAt !== member.version) throw new Error(`${member.name}: el perfil cambió durante el análisis.`);
      await save(`${member.name}: evaluando trazas y guardando atributos`, member.id);
      await steps.finalize({ agentId: member.id, brief, runTraces: traces, updateAgentDescription: false });
      data.completedSteps++;
      await save(`${member.name}: evaluación guardada`, member.id);
    }
    const current = await getEvaluationJob(id);
    const cancelled = current?.status === "cancelling";
    await save(cancelled ? "Análisis detenido" : "Análisis completado");
    await updateEvaluationJob(id, owner, data, cancelled ? "cancelled" : "completed");
  } catch (err) {
    failed = !(err instanceof Cancelled);
    await save(failed ? errorMessage(err) : "Análisis detenido; se conservan los resultados ya guardados");
    await updateEvaluationJob(id, owner, data, failed ? "failed" : "cancelled");
  } finally {
    clearInterval(heartbeat);
  }
}

export function startEvaluationWorker() {
  let busy = false;
  let stopped = false;
  async function tick() {
    if (busy || stopped) return;
    busy = true;
    try {
      await expireEvaluationJobs();
      const queued = (await listEvaluationJobs()).filter((j) => j.status === "queued").reverse();
      if (queued[0]) await processEvaluationJob(queued[0].id);
    } catch (err) { console.error("[evaluation-worker]", errorMessage(err)); }
    finally { busy = false; }
  }
  const timer = setInterval(() => { void tick(); }, 2000);
  void tick();
  return () => { stopped = true; clearInterval(timer); };
}
