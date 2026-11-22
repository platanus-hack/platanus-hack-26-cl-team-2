import { Hono } from "hono";
import {
  AREA_LIST,
  composeProfile,
  profileToAgentSpecInput,
  profileToSystemPrompt,
  type AgentProfile,
  type AreaId,
  type Motivation,
  type Proactivity,
  type Seniority,
} from "@sandbox/shared";
import { z } from "zod";
import { listAgents, getAgent, upsertAgent } from "../db/agents-repo.js";
import { refineModelId, refineProfileWithHaiku } from "./refine.js";
import { requireAdmin } from "../security/admin.js";
import { demoGuard, denyIfOverBudget, requestIp } from "../security/budget.js";
import { errorMessage } from "../security/redact.js";
import { modelErrorStatus } from "../security/spend.js";

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

const composeSchema = z.object({
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
  name: z.string().min(1).max(64).optional(),
  orgHints: z
    .object({
      companyName: z.string().max(120).optional(),
      industry: z.string().max(120).optional(),
      notes: z.string().max(400).optional(),
    })
    .optional(),
  refine: z.boolean().optional().default(true),
});

const refineSchema = z.object({
  profile: z.object({
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
    // 36000: a direct-prompt agent keeps company context plus its prompt here.
    systemContext: z.string().min(1).max(36000),
    operatingStyle: z.array(z.string().max(600)).max(12),
    goalTemplate: z.string().max(2000),
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
  }),
});

export const profileRoutes = new Hono();

profileRoutes.get("/areas", (c) => c.json({ areas: AREA_LIST }));

profileRoutes.post("/compose", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = composeSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }

  const { areaId, knobs, name, orgHints, refine } = parsed.data;
  let profile = composeProfile({
    areaId: areaId as AreaId,
    knobs: {
      seniority: knobs.seniority as Seniority,
      motivation: knobs.motivation as Motivation,
      proactivity: knobs.proactivity as Proactivity,
    },
    name,
    orgHints,
  });
  if (orgHints) profile = { ...profile, orgHints };

  let refineError: string | undefined;
  // refine=true calls the model: same per-IP and daily budget as the judge. When over budget
  // the deterministic profile is still returned, with the limit message as refineError.
  const budget = refine ? demoGuard.checkModelCall(requestIp(c)) : null;
  if (budget && !budget.ok) {
    refineError = budget.message;
  } else if (refine) {
    try {
      profile = await refineProfileWithHaiku(profile);
    } catch (err) {
      refineError = errorMessage(err);
    }
  }

  return c.json({
    profile,
    projection: {
      agentSpecInput: profileToAgentSpecInput(profile),
      systemPrompt: profileToSystemPrompt(profile),
    },
    refineModel: refineModelId(),
    refineError,
  });
});

profileRoutes.post("/refine", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = refineSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }

  if (parsed.data.profile.orgHints?.notes === "mesh:prompt-only") {
    return c.json({ error: "Los perfiles de prompt directo no se refinan con plantillas. Edita su prompt original." }, 400);
  }
  const denied = denyIfOverBudget(c, demoGuard.checkModelCall(requestIp(c)));
  if (denied) return denied;
  try {
    const profile = await refineProfileWithHaiku(
      parsed.data.profile as AgentProfile,
    );
    return c.json({
      profile,
      projection: {
        agentSpecInput: profileToAgentSpecInput(profile),
        systemPrompt: profileToSystemPrompt(profile),
      },
      refineModel: refineModelId(),
    });
  } catch (err) {
    const message = errorMessage(err);
    const status = modelErrorStatus(err, message);
    return c.json({ error: message }, status);
  }
});

/** Persist profile (SQLite local / Postgres prod). */
profileRoutes.post("/save", requireAdmin, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = refineSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }

  try {
    const profile = parsed.data.profile as AgentProfile;
    const agent = await upsertAgent(profile, {
      orgHints: profile.orgHints ?? null,
      origin: "manual",
      ...(profile.orgHints?.notes === "mesh:prompt-only" ? { harnessTools: ["done", "send_message", "read_inbox"] } : {}),
    });
    return c.json({ ok: true, profile: agent, agent });
  } catch (err) {
    return c.json(
      { error: errorMessage(err) },
      500,
    );
  }
});

profileRoutes.get("/saved", async (c) => {
  try {
    const agentsList = await listAgents();
    return c.json({ profiles: agentsList, agents: agentsList });
  } catch (err) {
    return c.json(
      { error: errorMessage(err) },
      500,
    );
  }
});

profileRoutes.get("/saved/:id", async (c) => {
  try {
    const agent = await getAgent(c.req.param("id"));
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    return c.json({
      profile: agent,
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
