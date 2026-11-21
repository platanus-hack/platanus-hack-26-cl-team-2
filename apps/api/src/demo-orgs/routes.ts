import { Hono } from "hono";
import { z } from "zod";
import {
  getCurrentDemoOrg,
  getDemoOrg,
  listDemoOrgs,
  patchDemoOrgContext,
  saveDemoOrg,
} from "../db/demo-orgs-repo.js";

const saveSchema = z.object({
  companyName: z.string().max(120).optional(),
  context: z.string().min(1).max(20_000),
  agents: z
    .array(
      z.object({
        name: z.string().min(1).max(64),
        prompt: z.string().min(1).max(12_000),
      }),
    )
    .min(1)
    .max(24),
  files: z
    .array(
      z.object({
        filename: z.string().min(1).max(120),
        content: z.string().max(200_000),
        label: z.string().max(120).optional(),
        readAgentNames: z.array(z.string().max(64)).max(24).default([]),
        writeAgentNames: z.array(z.string().max(64)).max(24).default([]),
      }),
    )
    .max(24)
    .optional(),
});

export const demoOrgRoutes = new Hono();

demoOrgRoutes.get("/", async (c) => {
  try {
    const orgs = await listDemoOrgs();
    return c.json({ orgs });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

demoOrgRoutes.get("/current", async (c) => {
  try {
    const current = await getCurrentDemoOrg();
    if (!current) return c.json({ org: null, agents: [] });
    return c.json(current);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

demoOrgRoutes.patch("/current/context", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = z
    .object({ context: z.string().min(1).max(20_000) })
    .safeParse(json);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      400,
    );
  }
  try {
    const result = await patchDemoOrgContext(parsed.data.context);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      message.includes("No DEMO") || message.includes("required") ? 400 : 500;
    return c.json({ error: message }, status);
  }
});

demoOrgRoutes.get("/:id", async (c) => {
  try {
    const org = await getDemoOrg(c.req.param("id"));
    if (!org) return c.json({ error: "Demo org not found" }, 404);
    return c.json({ org });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

demoOrgRoutes.post("/", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = saveSchema.safeParse(json);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      400,
    );
  }

  try {
    const result = await saveDemoOrg(parsed.data);
    return c.json(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      message.includes("required") || message.includes("needs a name")
        ? 400
        : 500;
    return c.json({ error: message }, status);
  }
});
