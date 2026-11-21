import { Hono } from "hono";
import {
  profileToAgentSpecInput,
  profileToSystemPrompt,
  type AgentProfile,
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
  id: z.string().min(1),
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
  systemContext: z.string().min(1),
  operatingStyle: z.array(z.string()).min(1),
  goalTemplate: z.string().min(1),
  rawCompose: z
    .object({
      systemContext: z.string(),
      operatingStyle: z.array(z.string()),
      goalTemplate: z.string(),
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
  createdAt: z.string(),
});

const upsertSchema = z.object({
  profile: profileSchema,
  harnessTools: z.array(z.string()).optional(),
  harnessModel: z.string().nullable().optional(),
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
      { error: err instanceof Error ? err.message : String(err) },
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
      { error: err instanceof Error ? err.message : String(err) },
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
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

agentRoutes.put("/", async (c) => {
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
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

agentRoutes.delete("/:id", async (c) => {
  try {
    const ok = await deleteAgent(c.req.param("id"));
    if (!ok) return c.json({ error: "Agent not found" }, 404);
    return c.json({ ok: true });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

agentRoutes.post("/:id/context-files", async (c) => {
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
    const message = err instanceof Error ? err.message : String(err);
    const status = message === "Agent not found" ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

agentRoutes.delete("/:id/context-files/:fileId", async (c) => {
  try {
    const ok = await deleteContextFile(
      c.req.param("id"),
      c.req.param("fileId"),
    );
    if (!ok) return c.json({ error: "Context file not found" }, 404);
    return c.json({ ok: true });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
