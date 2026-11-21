import { Hono, type MiddlewareHandler } from "hono";
import {
  isVulnCategory,
  profileToAgentSpecInput,
  profileToSystemPrompt,
  VULN_CATEGORIES,
  type AgentProfile,
  type VulnCategory,
  type VulnDesignerBrief,
} from "@sandbox/shared";
import { z } from "zod";
import {
  addContextFile,
  deleteAgent,
  deleteContextFile,
  getAgent,
  listAgents,
  upsertAgent,
} from "../db/agents-repo.js";
import { buildInvokePayload } from "../db/invoke.js";
import { getVulnAssessment } from "../db/vuln-repo.js";
import {
  assessAgentVulnerabilities,
  designVulnScenariosForAgent,
  finalizeVulnAssessment,
  runOneVulnScenario,
  type VulnRunTrace,
} from "../harness/vuln-assess.js";
import { requireAdmin } from "../security/admin.js";
import { errorMessage } from "../security/redact.js";
import { SpendLimitError, spendMeter } from "../security/spend.js";

const knobsSchema = z.object({
  seniority: z.enum(["junior", "mid", "senior", "staff"]),
  motivation: z.enum([
    "quality",
    "speed",
    "compliance",
    "impact",
    "recognition",
  ]),
  proactivity: z.enum(["low", "medium", "high"]),
});

const profileSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  areaId: z.enum([
    "gtm",
    "csm",
    "cs",
    "engineering",
    "product_design",
    "data",
    "it",
    "finance",
  ]),
  knobs: knobsSchema,
  // 12000: a direct-prompt agent keeps its whole prompt here (PromptAgent's limit).
  systemContext: z.string().min(1).max(12000),
  operatingStyle: z.array(z.string().max(600)).min(1).max(12),
  goalTemplate: z.string().min(1).max(2000),
  rawCompose: z
    .object({
      systemContext: z.string().max(8000),
      operatingStyle: z.array(z.string().max(600)).max(12),
      goalTemplate: z.string().max(2000),
    })
    .optional(),
  refinedByModel: z.boolean().optional(),
  orgHints: z
    .object({
      companyName: z.string().max(120).optional(),
      industry: z.string().max(120).optional(),
      notes: z.string().max(400).optional(),
    })
    .optional(),
  createdAt: z.string().max(64),
});

const upsertSchema = z.object({
  profile: profileSchema,
  harnessTools: z.array(z.string().max(64)).max(32).optional(),
  harnessModel: z.string().max(128).nullable().optional(),
});

const contextFileSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.string().min(1).max(64).optional(),
  content: z.string().min(1).max(200_000),
});

export const agentRoutes = new Hono();

agentRoutes.get("/", async (c) => {
  try {
    const agents = await listAgents();
    return c.json({ agents });
  } catch (err) {
    return c.json(
      { error: errorMessage(err) },
      500,
    );
  }
});

agentRoutes.get("/:id", async (c) => {
  try {
    const agent = await getAgent(c.req.param("id"));
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    return c.json({
      agent,
      projection: {
        agentSpecInput: profileToAgentSpecInput(agent),
        systemPrompt: profileToSystemPrompt(agent),
      },
    });
  } catch (err) {
    return c.json(
      { error: errorMessage(err) },
      500,
    );
  }
});

agentRoutes.get("/:id/invoke", async (c) => {
  try {
    const agent = await getAgent(c.req.param("id"));
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    return c.json(buildInvokePayload(agent));
  } catch (err) {
    return c.json(
      { error: errorMessage(err) },
      500,
    );
  }
});

agentRoutes.get("/:id/vuln-assessment", async (c) => {
  try {
    const agent = await getAgent(c.req.param("id"));
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    const assessment = await getVulnAssessment(agent.id);
    return c.json({ assessment });
  } catch (err) {
    return c.json(
      { error: errorMessage(err) },
      500,
    );
  }
});

const assessSchema = z.object({
  maxTurnsPerAgent: z.number().int().min(1).max(20).optional(),
  maxScenarios: z.number().int().min(1).max(6).optional(),
});

function vulnErrorStatus(message: string, err?: unknown): 400 | 404 | 429 | 500 {
  if (err instanceof SpendLimitError) return 429;
  if (message === "Agent not found") return 404;
  if (message.includes("ANTHROPIC_API_KEY") || message.includes("No run traces")) {
    return 400;
  }
  return 500;
}

/**
 * The eval pipeline (design, solo runs, scoring) stores an assessment and may rewrite the
 * agent's notes, so it needs the admin check like every other write. One click makes dozens
 * of model calls, so the per-IP request limit does not fit; the daily US$ cap still applies
 * (checked here first, and again on every model call by anthropicClient()).
 */
const vulnBudget: MiddlewareHandler = async (c, next) => {
  const gate = spendMeter.check();
  if (!gate.ok) {
    c.header("Retry-After", String(gate.retryAfterSec));
    return c.json({ error: gate.message, reason: "budget" }, 429);
  }
  await next();
};

/** Design + run solo exploit evals; upserts assessment (uses prior as feedback). */
agentRoutes.post("/:id/vuln-assess", requireAdmin, vulnBudget, async (c) => {
  const json = await c.req.json().catch(() => ({}));
  const parsed = assessSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }

  try {
    const agent = await getAgent(c.req.param("id"));
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    const assessment = await assessAgentVulnerabilities(agent.id, parsed.data);
    return c.json({ assessment }, 200);
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, vulnErrorStatus(message, err));
  }
});

/** Step 1: LLM designs one scenario per vulnerability category. */
agentRoutes.post("/:id/vuln-design", requireAdmin, vulnBudget, async (c) => {
  try {
    const { agent, brief } = await designVulnScenariosForAgent(c.req.param("id"));
    return c.json({
      agentId: agent.id,
      brief,
      categories: VULN_CATEGORIES,
    });
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, vulnErrorStatus(message, err));
  }
});

const runOneSchema = z.object({
  category: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  scenarioHint: z.string().min(20).max(4000),
  grantFinanceTools: z.boolean().optional(),
  rationale: z.string().max(800).optional(),
  maxTurnsPerAgent: z.number().int().min(1).max(20).optional(),
  iteration: z.number().int().min(1).max(20).optional(),
});

/** Step 2: run a single solo scenario for one category. */
agentRoutes.post("/:id/vuln-run-one", requireAdmin, vulnBudget, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = runOneSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }
  if (!isVulnCategory(parsed.data.category)) {
    return c.json({ error: "Invalid category" }, 400);
  }
  const category = parsed.data.category as VulnCategory;

  try {
    const result = await runOneVulnScenario({
      agentId: c.req.param("id"),
      scenario: {
        category,
        title: parsed.data.title ?? category,
        scenarioHint: parsed.data.scenarioHint,
        grantFinanceTools: Boolean(parsed.data.grantFinanceTools),
        rationale: parsed.data.rationale ?? "",
      },
      maxTurnsPerAgent: parsed.data.maxTurnsPerAgent,
      iteration: parsed.data.iteration,
    });
    return c.json({ result });
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, vulnErrorStatus(message, err));
  }
});

const finalizeSchema = z.object({
  brief: z.object({
    scenarios: z
      .array(
        z.object({
          category: z.string(),
          title: z.string(),
          scenarioHint: z.string(),
          grantFinanceTools: z.boolean(),
          rationale: z.string(),
        }),
      )
      .min(1),
  }),
  runTraces: z
    .array(
      z.object({
        category: z.string(),
        runId: z.string(),
        status: z.string(),
        error: z.string().optional(),
        trace: z.string(),
        iteration: z.number().optional(),
      }),
    )
    .min(1),
  updateAgentDescription: z.boolean().optional(),
});

/** Step 3: score accumulated traces, upsert assessment, optionally rewrite agent notes. */
agentRoutes.post("/:id/vuln-finalize", requireAdmin, vulnBudget, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = finalizeSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }

  const brief: VulnDesignerBrief = {
    scenarios: parsed.data.brief.scenarios
      .filter((s) => isVulnCategory(s.category))
      .map((s) => ({
        category: s.category as VulnCategory,
        title: s.title,
        scenarioHint: s.scenarioHint,
        grantFinanceTools: s.grantFinanceTools,
        rationale: s.rationale,
      })),
  };
  const runTraces: VulnRunTrace[] = parsed.data.runTraces
    .filter((t) => isVulnCategory(t.category))
    .map((t) => ({
      category: t.category as VulnCategory,
      runId: t.runId,
      status: t.status,
      error: t.error,
      trace: t.trace,
      iteration: t.iteration,
    }));

  try {
    const result = await finalizeVulnAssessment({
      agentId: c.req.param("id"),
      brief,
      runTraces,
      updateAgentDescription: parsed.data.updateAgentDescription,
    });
    return c.json(result);
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, vulnErrorStatus(message, err));
  }
});

agentRoutes.put("/", requireAdmin, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }

  try {
    const profile = parsed.data.profile as AgentProfile;
    const agent = await upsertAgent(profile, {
      harnessTools: parsed.data.harnessTools,
      harnessModel: parsed.data.harnessModel,
      orgHints: profile.orgHints ?? null,
    });
    return c.json({ agent }, 200);
  } catch (err) {
    return c.json(
      { error: errorMessage(err) },
      500,
    );
  }
});

agentRoutes.delete("/:id", requireAdmin, async (c) => {
  try {
    const ok = await deleteAgent(c.req.param("id"));
    if (!ok) return c.json({ error: "Agent not found" }, 404);
    return c.json({ ok: true });
  } catch (err) {
    return c.json(
      { error: errorMessage(err) },
      500,
    );
  }
});

agentRoutes.post("/:id/context-files", requireAdmin, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = contextFileSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }

  try {
    const file = await addContextFile({
      agentId: c.req.param("id"),
      ...parsed.data,
    });
    return c.json({ file }, 201);
  } catch (err) {
    const message = errorMessage(err);
    const status = message === "Agent not found" ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

agentRoutes.delete("/:id/context-files/:fileId", requireAdmin, async (c) => {
  try {
    const ok = await deleteContextFile(
      c.req.param("id"),
      c.req.param("fileId"),
    );
    if (!ok) return c.json({ error: "Context file not found" }, 404);
    return c.json({ ok: true });
  } catch (err) {
    return c.json(
      { error: errorMessage(err) },
      500,
    );
  }
});
