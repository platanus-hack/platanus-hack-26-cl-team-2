import { Hono } from "hono";
import { z } from "zod";
import type { DemoChainAttackDesign, DemoChainEval } from "@sandbox/shared";
import {
  patchDemoOrgCommTrends,
  patchDemoOrgContext,
} from "../db/demo-orgs-repo.js";
import {
  analyzeCommPatterns,
  designBusinessScenario,
  patternsToMarkdown,
} from "../harness/demo-comm-learn.js";
import {
  designChainAttack,
  diagnoseChainAttack,
  evaluateChainAttack,
} from "../harness/demo-chain-attack.js";

export const demoPipelineRoutes = new Hono();

function errStatus(message: string): 400 | 404 | 500 {
  if (
    message.includes("No DEMO") ||
    message.includes("not found") ||
    message.includes("Need at least")
  ) {
    return message.includes("not found") ? 404 : 400;
  }
  if (message.includes("ANTHROPIC_API_KEY") || message.includes("required")) {
    return 400;
  }
  return 500;
}

demoPipelineRoutes.post("/comm-learn/design", async (c) => {
  const json = await c.req.json().catch(() => ({}));
  const parsed = z
    .object({ avoidTitles: z.array(z.string().max(120)).max(12).optional() })
    .safeParse(json ?? {});
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }
  try {
    const result = await designBusinessScenario(parsed.data);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, errStatus(message));
  }
});

demoPipelineRoutes.post("/comm-learn/analyze", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = z.object({ runId: z.string().min(1).max(80) }).safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }
  try {
    const result = await analyzeCommPatterns(parsed.data);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, errStatus(message));
  }
});

const finalizeSchema = z.object({
  patternsBatches: z
    .array(
      z.object({
        edges: z
          .array(
            z.object({
              from: z.string().min(1).max(80),
              to: z.string().min(1).max(80),
              about: z.string().min(1).max(400),
              frequencyHint: z.string().max(80),
            }),
          )
          .max(40),
        notes: z.string().max(2000),
      }),
    )
    .min(1)
    .max(20),
});

demoPipelineRoutes.post("/comm-learn/finalize", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = finalizeSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }
  try {
    const trendsMarkdown = patternsToMarkdown(parsed.data.patternsBatches);
    const result = await patchDemoOrgCommTrends(trendsMarkdown);
    return c.json({
      org: result.org,
      agents: result.agents,
      trendsBlock: result.trendsBlock,
      trendsMarkdown,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, errStatus(message));
  }
});

demoPipelineRoutes.post("/chain-attack/design", async (c) => {
  const json = await c.req.json().catch(() => ({}));
  const parsed = z
    .object({ hackPrompt: z.string().max(4000).optional() })
    .safeParse(json ?? {});
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }
  try {
    const result = await designChainAttack(parsed.data);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, errStatus(message));
  }
});

const chainActionSchema = z.object({
  kind: z.enum(["scenarioHint", "peerMessage"]),
  label: z.string().max(120),
  seedAgentId: z.string().min(1).max(80),
  scenarioHint: z.string().max(2000).optional(),
  peerMessage: z
    .object({
      fromAgentId: z.string().min(1).max(80),
      toAgentId: z.string().min(1).max(80),
      body: z.string().min(1).max(4000),
    })
    .optional(),
});

const designSchema = z.object({
  attackSurface: z.string().min(1).max(2000),
  actions: z.array(chainActionSchema).min(1).max(4),
  successCriteria: z.string().max(1200),
  rationale: z.string().max(1200),
});

demoPipelineRoutes.post("/chain-attack/evaluate", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = z
    .object({
      design: designSchema,
      runIds: z.array(z.string().min(1).max(80)).min(1).max(4),
    })
    .safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }
  try {
    const result = await evaluateChainAttack({
      design: parsed.data.design as DemoChainAttackDesign,
      runIds: parsed.data.runIds,
    });
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, errStatus(message));
  }
});

demoPipelineRoutes.post("/chain-attack/diagnose", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = z
    .object({
      design: designSchema,
      evaluation: z.object({
        empty: z.boolean(),
        surface: z.string().max(2500),
        failuresAmplifications: z.array(z.string().max(500)).max(12),
        actionableRemediations: z.array(z.string().max(500)).max(12),
        scoreSummary: z.string().max(1500),
      }),
      llmLog: z.string().min(1).max(20_000),
      hackPrompt: z.string().max(4000).optional(),
    })
    .safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }
  try {
    const result = await diagnoseChainAttack({
      design: parsed.data.design as DemoChainAttackDesign,
      evaluation: parsed.data.evaluation as DemoChainEval,
      llmLog: parsed.data.llmLog,
      hackPrompt: parsed.data.hackPrompt,
    });
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, errStatus(message));
  }
});

/** Also expose context patch under the pipeline namespace for the UI. */
demoPipelineRoutes.patch("/context", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = z.object({ context: z.string().min(1).max(20_000) }).safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }
  try {
    const result = await patchDemoOrgContext(parsed.data.context);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, errStatus(message));
  }
});
