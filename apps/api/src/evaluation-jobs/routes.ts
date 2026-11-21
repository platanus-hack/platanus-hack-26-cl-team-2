import { Hono } from "hono";
import { z } from "zod";
import { evaluationJobActive } from "@sandbox/shared";
import { assertApiKeyConfigured } from "../config.js";
import { getAgent } from "../db/agents-repo.js";
import { cancelEvaluationJob, createEvaluationJob, getEvaluationJob, listEvaluationJobs } from "../db/evaluation-jobs-repo.js";
import { requireAdmin } from "../security/admin.js";
import { demoGuard, denyIfOverBudget, requestIp } from "../security/budget.js";

export const evaluationJobRoutes = new Hono();
evaluationJobRoutes.use("*", requireAdmin);
evaluationJobRoutes.get("/", async (c) => c.json({ jobs: await listEvaluationJobs() }));
evaluationJobRoutes.get("/:id", async (c) => {
  const job = await getEvaluationJob(c.req.param("id"));
  return job ? c.json({ job }) : c.json({ error: "Análisis no encontrado" }, 404);
});
evaluationJobRoutes.post("/:id/cancel", async (c) => {
  if (!await getEvaluationJob(c.req.param("id"))) return c.json({ error: "Análisis no encontrado" }, 404);
  await cancelEvaluationJob(c.req.param("id"));
  return c.json({ job: await getEvaluationJob(c.req.param("id")) });
});
evaluationJobRoutes.post("/", async (c) => {
  const input = z.object({ agentIds: z.array(z.string().min(1).max(128)).min(1).max(24), iterations: z.number().int().min(1).max(3) }).safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: "Selecciona entre 1 y 24 agentes y entre 1 y 3 repeticiones." }, 400);
  const denied = denyIfOverBudget(c, demoGuard.checkModelCall(requestIp(c)));
  if (denied) return denied;
  assertApiKeyConfigured();
  const ids = [...new Set(input.data.agentIds)];
  const roster = await Promise.all(ids.map(getAgent));
  if (roster.some((a) => !a)) return c.json({ error: "Uno de los agentes ya no existe." }, 404);
  const agents = roster.filter((a): a is NonNullable<typeof a> => !!a);
  const company = agents[0].orgHints?.companyName ?? "";
  if (agents.some((a) => (a.orgHints?.companyName ?? "") !== company)) return c.json({ error: "Selecciona agentes de una misma empresa." }, 400);
  const jobs = await listEvaluationJobs();
  if (jobs.some((job) => evaluationJobActive(job.status) && job.agents.some((a) => ids.includes(a.id)))) return c.json({ error: "Hay un análisis pendiente para alguno de estos agentes." }, 409);
  if (jobs.filter((job) => evaluationJobActive(job.status)).length >= 20) return c.json({ error: "Cola llena. Espera a que finalice un análisis." }, 429);
  const job = await createEvaluationJob({
    company, iterations: input.data.iterations,
    agents: agents.map((a) => ({ id: a.id, name: a.name, version: a.updatedAt })),
    completedSteps: 0, totalSteps: agents.length * (2 + 6 * input.data.iterations),
    phase: "En cola", agentStatus: {}, logs: [],
  });
  return c.json({ job }, 202);
});
