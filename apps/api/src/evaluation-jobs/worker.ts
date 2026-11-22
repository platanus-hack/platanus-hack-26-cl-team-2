import { randomUUID } from "node:crypto";
import { VULN_CATEGORIES, type EvaluationJobData } from "@sandbox/shared";
import { getAgent } from "../db/agents-repo.js";
import { claimEvaluationJob, expireEvaluationJobs, getEvaluationJob, listEvaluationJobs, updateEvaluationJob } from "../db/evaluation-jobs-repo.js";
import { takeJobApiKey, withUserApiKey } from "../user-api-key.js";
import { designVulnScenariosForAgent, finalizeVulnAssessment, runOneVulnScenario, type VulnRunTrace } from "../harness/vuln-assess.js";
import { demoGuard } from "../security/budget.js";
import { errorMessage } from "../security/redact.js";

class Cancelled extends Error {}
const modelSteps = { design: designVulnScenariosForAgent, run: runOneVulnScenario, finalize: finalizeVulnAssessment };

/** One in-flight write at a time, so parallel agents share one job record. */
function exclusive<T>(tail: { current: Promise<void> }, fn: () => Promise<T>): Promise<T> {
  const run = tail.current.then(fn, fn);
  tail.current = run.then(() => undefined, () => undefined);
  return run;
}

/** Independent of HTTP requests and browser connections. One job at a time per worker. Agents in that job run together; each agent's iterations stay in order. */
export async function processEvaluationJob(id: string, steps = modelSteps): Promise<void> {
  const owner = randomUUID();
  if (!await claimEvaluationJob(id, owner)) return;
  const job = await getEvaluationJob(id);
  if (!job) return;
  const data: EvaluationJobData = { ...job, phase: "Preparando análisis" };
  const tail = { current: Promise.resolve() };
  let stop: Error | null = null;
  let failed = false;
  const write = (phase: string, agentId?: string, step = false, jobPhase = phase) => exclusive(tail, async () => {
    if (step) data.completedSteps++;
    if (agentId) data.agentStatus[agentId] = phase;
    data.phase = jobPhase;
    data.logs = [...data.logs.slice(-199), `${new Date().toISOString()} ${phase}`];
    await updateEvaluationJob(id, owner, data);
  });
  const parallelPhase = job.agents.length > 1 ? `Analizando ${job.agents.length} agentes en paralelo` : undefined;
  const record = (phase: string, agentId?: string, step = false) => write(phase, agentId, step, parallelPhase ?? phase);
  const check = async () => {
    for (;;) {
      const waitMs = await exclusive(tail, async () => {
        if (stop) throw stop;
        const current = await getEvaluationJob(id);
        if (!current || current.status !== "running") {
          stop = new Cancelled();
          throw stop;
        }
        const guard = demoGuard.checkModelCall("evaluation-worker");
        if (guard.ok) return 0;
        if (guard.reason !== "rate") {
          stop = new Error(guard.message);
          throw stop;
        }
        data.phase = "Pausa por límite de frecuencia; reanudación automática";
        data.logs = [...data.logs.slice(-199), `${new Date().toISOString()} ${data.phase}`];
        await updateEvaluationJob(id, owner, data);
        return Math.min(5000, guard.retryAfterSec * 1000);
      });
      if (waitMs === 0) return;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  };
  const heartbeat = setInterval(() => { void exclusive(tail, () => updateEvaluationJob(id, owner)).catch(() => {}); }, 10_000);
  const runMember = async (member: EvaluationJobData["agents"][number]) => {
    await check();
    const agent = await getAgent(member.id);
    if (!agent || agent.updatedAt !== member.version) throw new Error(`${member.name}: el perfil cambió desde que se programó el análisis. Inicia uno nuevo.`);
    await record(`${member.name}: clasificando función y diseñando ataques`, member.id);
    const { brief } = await steps.design(member.id);
    await record(`${member.name}: ataques diseñados`, member.id, true);
    if (VULN_CATEGORIES.some((cat) => !brief.scenarios.some((s) => s.category === cat))) throw new Error("Diseño incompleto: faltan atributos.");
    const traces: VulnRunTrace[] = [];
    for (let iteration = 1; iteration <= job.iterations; iteration++) {
      for (const scenario of brief.scenarios) {
        await check();
        await record(`${member.name}: ${scenario.category} · ${iteration}/${job.iterations}`, member.id);
        const result = await steps.run({ agentId: member.id, scenario, maxTurnsPerAgent: 6, iteration });
        if (result.status !== "completed") throw new Error(`${member.name}: prueba incompleta (${result.error || result.status}).`);
        traces.push(result);
        await record(`${member.name}: prueba terminada · ${result.runId}`, member.id, true);
      }
    }
    await check();
    const current = await getAgent(member.id);
    if (!current || current.updatedAt !== member.version) throw new Error(`${member.name}: el perfil cambió durante el análisis.`);
    await record(`${member.name}: evaluando trazas y guardando atributos`, member.id);
    await steps.finalize({ agentId: member.id, brief, runTraces: traces, updateAgentDescription: false });
    await record(`${member.name}: evaluación guardada`, member.id, true);
  };
  try {
    const results = await Promise.allSettled(job.agents.map((member) => runMember(member).catch(async (err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      await exclusive(tail, async () => { if (!stop) stop = error; });
      throw stop ?? error;
    })));
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected && rejected.status === "rejected") throw rejected.reason;
    const current = await getEvaluationJob(id);
    const cancelled = current?.status === "cancelling";
    await write(cancelled ? "Análisis detenido" : "Análisis completado");
    await updateEvaluationJob(id, owner, data, cancelled ? "cancelled" : "completed");
  } catch (err) {
    failed = !(err instanceof Cancelled);
    await write(failed ? errorMessage(err) : "Análisis detenido; se conservan los resultados ya guardados");
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
      if (queued[0]) await withUserApiKey(takeJobApiKey(queued[0].id), () => processEvaluationJob(queued[0].id));
    } catch (err) { console.error("[evaluation-worker]", errorMessage(err)); }
    finally { busy = false; }
  }
  const timer = setInterval(() => { void tick(); }, 2000);
  void tick();
  return () => { stopped = true; clearInterval(timer); };
}
