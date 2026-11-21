/**
 * "Evaluate every agent" (roadmap step 0).
 *
 * The browser drives the work with the existing per-agent steps (vuln-design, vuln-run-one,
 * vuln-finalize), a few agents at a time. That keeps every request under the serverless time
 * limit (Vercel: 300 s), which one request evaluating eight agents would not. These routes only
 * keep the record: a batch, each agent's scores before it started, and what each agent ended with.
 * Scores are read from the stored assessment on the server, never taken from the client.
 */
import { Hono, type MiddlewareHandler } from "hono";
import {
  VULN_CATEGORIES,
  type VulnBatchEstimate,
  type VulnBatchSettings,
} from "@sandbox/shared";
import { z } from "zod";
import { config } from "../config.js";
import { listAgents } from "../db/agents-repo.js";
import { getVulnAssessment } from "../db/vuln-repo.js";
import {
  createVulnBatch,
  finishVulnBatch,
  getVulnBatch,
  listVulnBatches,
  recordVulnBatchResult,
} from "../db/vuln-batches-repo.js";
import { vulnAssessModelId } from "../harness/vuln-assess.js";
import { requireAdmin } from "../security/admin.js";
import { errorMessage } from "../security/redact.js";
import { priceFor, spendMeter } from "../security/spend.js";

/**
 * Token assumptions per call, deliberately on the high side: the estimate is an upper bound
 * to show before spending, not a forecast.
 */
const TOKENS = {
  designer: { input: 8_000, output: 3_500 },
  agentTurn: { input: 6_000, output: 800 },
  scorer: { input: 16_000, output: 2_500 },
} as const;

function callUsd(model: string, t: { input: number; output: number }): number {
  const p = priceFor(model);
  return (t.input * p.input + t.output * p.output) / 1_000_000;
}

/** Pure: upper bound on calls and US$ for a batch. Exported for tests. */
export function estimateVulnBatch(input: {
  agentModels: string[];
  settings: VulnBatchSettings;
  designerModel: string;
}): VulnBatchEstimate {
  const scenarios = VULN_CATEGORIES.length;
  const { iterations, maxTurnsPerAgent } = input.settings;
  const agents = input.agentModels.length;
  const runsPerAgent = scenarios * iterations;
  const turnsPerAgent = runsPerAgent * maxTurnsPerAgent;
  // The browser scores once per agent, on every round's traces together.
  const perAgentFixed =
    callUsd(input.designerModel, TOKENS.designer) + callUsd(input.designerModel, TOKENS.scorer);
  const usd = input.agentModels.reduce(
    (sum, model) => sum + perAgentFixed + turnsPerAgent * callUsd(model, TOKENS.agentTurn),
    0,
  );
  return {
    agents,
    runs: agents * runsPerAgent,
    maxModelCalls: agents * (2 + turnsPerAgent),
    approxMaxUsd: Math.round(usd * 100) / 100,
  };
}

const settingsSchema = z.object({
  agentIds: z.array(z.string().min(1).max(128)).min(1).max(500).optional(),
  iterations: z.number().int().min(1).max(3).default(1),
  maxTurnsPerAgent: z.number().int().min(1).max(12).default(6),
  concurrency: z.number().int().min(1).max(4).default(2),
});

const vulnBudget: MiddlewareHandler = async (c, next) => {
  const gate = spendMeter.check();
  if (!gate.ok) {
    c.header("Retry-After", String(gate.retryAfterSec));
    return c.json({ error: gate.message, reason: "budget" }, 429);
  }
  await next();
};

/** No agentIds: only the agents a person made (origin "manual"), never generated or test ones. */
async function resolveAgents(agentIds: string[] | undefined) {
  const all = await listAgents();
  if (!agentIds) return { agents: all.filter((a) => a.origin === "manual"), missing: [] as string[] };
  const byId = new Map(all.map((a) => [a.id, a]));
  const unique = [...new Set(agentIds)];
  return {
    agents: unique.map((id) => byId.get(id)).filter((a): a is NonNullable<typeof a> => !!a),
    missing: unique.filter((id) => !byId.has(id)),
  };
}

export const vulnBatchRoutes = new Hono();

vulnBatchRoutes.get("/", async (c) => {
  try {
    return c.json({ batches: await listVulnBatches(10) });
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 500);
  }
});

/** Cost preview without creating anything (no model call). */
vulnBatchRoutes.post("/estimate", async (c) => {
  const parsed = settingsSchema.safeParse((await c.req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  try {
    const { agentIds, ...settings } = parsed.data;
    const { agents, missing } = await resolveAgents(agentIds);
    if (missing.length) return c.json({ error: `Agents not found: ${missing.join(", ")}` }, 404);
    const estimate = estimateVulnBatch({
      agentModels: agents.map((a) => a.harnessModel ?? config.model),
      settings,
      designerModel: vulnAssessModelId(),
    });
    return c.json({ estimate, settings });
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 500);
  }
});

vulnBatchRoutes.get("/:id", async (c) => {
  try {
    const batch = await getVulnBatch(c.req.param("id"));
    if (!batch) return c.json({ error: "Batch not found" }, 404);
    return c.json({ batch });
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 500);
  }
});

/** Start a batch: snapshot each agent's current scores as "before". */
vulnBatchRoutes.post("/", requireAdmin, vulnBudget, async (c) => {
  const parsed = settingsSchema.safeParse((await c.req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  try {
    const { agentIds, ...settings } = parsed.data;
    const { agents, missing } = await resolveAgents(agentIds);
    if (missing.length) return c.json({ error: `Agents not found: ${missing.join(", ")}` }, 404);
    if (agents.length === 0) return c.json({ error: "No agents to evaluate" }, 400);
    const estimate = estimateVulnBatch({
      agentModels: agents.map((a) => a.harnessModel ?? config.model),
      settings,
      designerModel: vulnAssessModelId(),
    });
    const previous = await Promise.all(agents.map((a) => getVulnAssessment(a.id)));
    const batch = await createVulnBatch({
      settings,
      estimate,
      agents: agents.map((a, i) => ({
        agentId: a.id,
        agentName: a.name,
        previousScores: previous[i]?.scores ?? null,
      })),
    });
    return c.json({ batch }, 201);
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 500);
  }
});

const agentDoneSchema = z.object({
  status: z.enum(["ok", "failed"]),
  error: z.string().max(1000).optional(),
});

/**
 * One agent finished (its pipeline already saved the assessment through vuln-finalize).
 * "ok" copies the stored assessment into the batch; "failed" keeps the error.
 */
vulnBatchRoutes.post("/:id/agents/:agentId", requireAdmin, async (c) => {
  const parsed = agentDoneSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  try {
    const batchId = c.req.param("id");
    const agentId = c.req.param("agentId");
    const batch = await getVulnBatch(batchId);
    if (!batch) return c.json({ error: "Batch not found" }, 404);
    if (batch.status !== "running") return c.json({ error: "Batch is not running" }, 409);
    if (!batch.results.some((r) => r.agentId === agentId)) {
      return c.json({ error: "Agent is not part of this batch" }, 404);
    }

    const assessment = parsed.data.status === "ok" ? await getVulnAssessment(agentId) : null;
    // "ok" with an assessment older than the batch means the pipeline never saved one.
    const fresh = assessment && Date.parse(assessment.updatedAt) >= Date.parse(batch.createdAt);
    const ok = parsed.data.status === "ok" && fresh;
    await recordVulnBatchResult(batchId, agentId, {
      status: ok ? "ok" : "failed",
      scores: ok ? assessment.scores : null,
      summary: ok ? assessment.summary : "",
      runIds: ok ? assessment.runIds : [],
      error: ok ? null : parsed.data.error ?? (parsed.data.status === "ok" ? "No se guardó un assessment nuevo" : "Falló"),
    });
    return c.json({ batch: await getVulnBatch(batchId) });
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 500);
  }
});

const finishSchema = z.object({ status: z.enum(["completed", "stopped", "failed"]) });

vulnBatchRoutes.post("/:id/finish", requireAdmin, async (c) => {
  const parsed = finishSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  try {
    const batchId = c.req.param("id");
    const batch = await getVulnBatch(batchId);
    if (!batch) return c.json({ error: "Batch not found" }, 404);
    if (batch.status === "running") await finishVulnBatch(batchId, parsed.data.status);
    return c.json({ batch: await getVulnBatch(batchId) });
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 500);
  }
});
