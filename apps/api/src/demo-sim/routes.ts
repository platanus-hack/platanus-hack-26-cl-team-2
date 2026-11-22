import { Hono } from "hono";
import { z } from "zod";
import type { DemoSimDesign, FlowGraphEdge } from "@sandbox/shared";
import { ensureCompanyTxtFiles } from "../harness/company-files.js";
import { applyPathBias, deepenRiskPrompt, designRiskPrompts, evaluateRiskRun, loadCompanySim } from "../harness/demo-sim.js";
import { listDemoSimFindings, saveDemoSimFinding } from "../db/demo-sim-repo.js";
import { prepareStoredRun, startPreparedRun } from "../harness/orchestrator.js";
import { demoGuard, denyIfOverBudget, requestIp } from "../security/budget.js";
import { errorMessage } from "../security/redact.js";
import { modelErrorStatus, spendMeter } from "../security/spend.js";

export const demoSimRoutes = new Hono();

const id = z.string().min(1).max(128);

const actionBody = z.object({
  kind: z.enum(["scenarioHint", "peerMessage"]),
  label: z.string().max(120),
  seedAgentId: id,
  scenarioHint: z.string().max(2000).optional(),
  peerMessage: z.object({
    fromAgentId: id,
    toAgentId: id,
    body: z.string().min(20).max(4000),
  }).optional(),
});

const designBody = z.object({
  attackSurface: z.string().max(2000),
  successCriteria: z.string().max(1200),
  rationale: z.string().max(1200),
  actions: z.array(actionBody).length(1),
});

function statusFor(err: unknown, message: string): 400 | 429 | 502 | 503 {
  if (/Falta la empresa|al menos 2|antes de simular|no encontr/.test(message)) return 400;
  return modelErrorStatus(err, message);
}

demoSimRoutes.post("/design", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = z.object({
    companyName: z.string().min(1).max(120),
    objective: z.string().min(20).max(2000),
    pathSteps: z.number().int().min(1).max(12).optional(),
  }).safeParse(json);
  if (!parsed.success) return c.json({ error: "Cuerpo inválido" }, 400);
  const denied = denyIfOverBudget(c, demoGuard.checkModelCall(requestIp(c)));
  if (denied) return denied;
  try {
    return c.json(await designRiskPrompts(parsed.data.companyName, parsed.data.objective, parsed.data.pathSteps));
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, statusFor(err, message));
  }
});

/** One prompt. The path preference is added to this run and not saved on the agent. */
demoSimRoutes.post("/runs", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = z.object({
    companyName: z.string().min(1).max(120),
    actions: z.array(actionBody).length(1),
  }).safeParse(json);
  if (!parsed.success) return c.json({ error: "Cuerpo inválido", details: parsed.error.flatten() }, 400);
  const spend = spendMeter.check();
  if (!spend.ok) return c.json({ error: spend.message }, 429);
  try {
    await ensureCompanyTxtFiles(parsed.data.companyName);
    const bundle = await loadCompanySim(parsed.data.companyName);
    const ids = bundle.agents.map((agent) => agent.id);
    const edges: FlowGraphEdge[] = bundle.graph.edges;
    const prepared = await Promise.all(parsed.data.actions.map((action) => {
      const peer = action.kind === "peerMessage" ? action.peerMessage : undefined;
      const required = [peer?.fromAgentId, peer?.toAgentId ?? action.seedAgentId].filter((agentId): agentId is string => Boolean(agentId));
      const agentIds = [...required, ...ids.filter((agentId) => !required.includes(agentId))].slice(0, 8);
      return prepareStoredRun({
        agentIds,
        seedAgentId: peer?.toAgentId ?? action.seedAgentId,
        maxTurnsPerAgent: 5,
        scenarioHint: peer ? undefined : action.scenarioHint,
        peerMessage: peer,
      });
    }));
    const biased = prepared.map((run) => ({ ...run, agents: applyPathBias(run.agents, edges) }));
    const runs = await Promise.all(biased.map((run) => startPreparedRun(run)));
    return c.json({ runs }, 201);
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, statusFor(err, message));
  }
});

demoSimRoutes.post("/evaluate", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = z.object({
    companyName: z.string().min(1).max(120),
    design: designBody,
    runIds: z.array(z.string().min(1).max(80)).length(1),
  }).safeParse(json);
  if (!parsed.success) return c.json({ error: "Cuerpo inválido" }, 400);
  const denied = denyIfOverBudget(c, demoGuard.checkModelCall(requestIp(c)));
  if (denied) return denied;
  try {
    const design = parsed.data.design as DemoSimDesign;
    return c.json(await evaluateRiskRun({ companyName: parsed.data.companyName, design, runIds: parsed.data.runIds }));
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, statusFor(err, message));
  }
});

const evaluationBody = z.object({
  empty: z.boolean(),
  surface: z.string().max(2500),
  failuresAmplifications: z.array(z.string().max(500)).max(12),
  actionableRemediations: z.array(z.string().max(500)).max(12),
  scoreSummary: z.string().max(1500),
});

demoSimRoutes.post("/deepen", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = z.object({
    companyName: z.string().min(1).max(120),
    prompt: z.string().min(20).max(4000),
    seedAgentId: id.optional(),
    attackSurface: z.string().max(2000).optional(),
    runId: z.string().min(1).max(80).optional(),
    evaluation: evaluationBody,
  }).safeParse(json);
  if (!parsed.success) return c.json({ error: "Cuerpo inválido" }, 400);
  const denied = denyIfOverBudget(c, demoGuard.checkModelCall(requestIp(c)));
  if (denied) return denied;
  try {
    return c.json(await deepenRiskPrompt(parsed.data));
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, statusFor(err, message));
  }
});

const findingBody = z.object({
  companyName: z.string().min(1).max(120),
  prompt: z.string().min(20).max(4000),
  attackSurface: z.string().max(2000),
  runId: z.string().min(1).max(80),
  evaluation: evaluationBody,
  allowEmpty: z.boolean().optional(),
});

demoSimRoutes.get("/findings", async (c) => {
  try {
    return c.json({ findings: await listDemoSimFindings() });
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 500);
  }
});

demoSimRoutes.post("/findings", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = findingBody.safeParse(json);
  if (!parsed.success) return c.json({ error: "Cuerpo inválido" }, 400);
  try {
    return c.json({ finding: await saveDemoSimFinding(parsed.data) }, 201);
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, statusFor(err, message));
  }
});
