import { Hono } from "hono";
import { z } from "zod";
import { DEMO_SIM_MAX_ACTIONS, type DemoSimDesign, type FlowGraphEdge } from "@sandbox/shared";
import { ensureCompanyTxtFiles } from "../harness/company-files.js";
import {
  applyPathBias,
  deepenRiskPrompt,
  designGuardPatch,
  designRiskPrompts,
  evaluateRiskRun,
  loadCompanySim,
  retestWithPatch,
} from "../harness/demo-sim.js";
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
  scenarioHint: z.string().max(10000).optional(),
  peerMessage: z.object({
    fromAgentId: id,
    toAgentId: id,
    body: z.string().min(20).max(10000),
  }).optional(),
});

const designBody = z.object({
  attackSurface: z.string().max(2000),
  successCriteria: z.string().max(1200),
  rationale: z.string().max(1200),
  actions: z.array(actionBody).min(1).max(DEMO_SIM_MAX_ACTIONS),
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
    pathSteps: z.number().int().min(1).max(1000).optional(),
    approachNotes: z.string().max(4000).optional(),
  }).safeParse(json);
  if (!parsed.success) return c.json({ error: "Cuerpo inválido" }, 400);
  const denied = denyIfOverBudget(c, demoGuard.checkModelCall(requestIp(c)));
  if (denied) return denied;
  try {
    return c.json(await designRiskPrompts(
      parsed.data.companyName,
      parsed.data.objective,
      parsed.data.pathSteps,
      parsed.data.approachNotes,
    ));
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, statusFor(err, message));
  }
});

/** One control-agent burst. Path preference is added for this run only. */
demoSimRoutes.post("/runs", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = z.object({
    companyName: z.string().min(1).max(120),
    actions: z.array(actionBody).min(1).max(DEMO_SIM_MAX_ACTIONS),
    maxTurns: z.number().int().min(1).max(1000).optional(),
  }).safeParse(json);
  if (!parsed.success) return c.json({ error: "Cuerpo inválido", details: parsed.error.flatten() }, 400);
  const spend = spendMeter.check();
  if (!spend.ok) return c.json({ error: spend.message }, 429);
  try {
    await ensureCompanyTxtFiles(parsed.data.companyName);
    const bundle = await loadCompanySim(parsed.data.companyName);
    const ids = bundle.agents.map((agent) => agent.id);
    const edges: FlowGraphEdge[] = bundle.graph.edges;
    const hints = parsed.data.actions.filter((action) => action.kind === "scenarioHint" && (action.scenarioHint ?? "").trim().length >= 20);
    const peers = parsed.data.actions.flatMap((action) => action.kind === "peerMessage" && action.peerMessage ? [action.peerMessage] : []);
    const primaryHint = hints[0];
    const primaryPeer = primaryHint ? undefined : peers[0];
    const openings = hints.slice(primaryHint ? 1 : 0).map((action) => ({
      agentId: action.seedAgentId,
      scenarioHint: action.scenarioHint!.trim(),
    }));
    const extraPeerMessages = primaryHint ? peers : peers.slice(1);
    const required = [
      primaryHint?.seedAgentId,
      primaryPeer?.fromAgentId,
      primaryPeer?.toAgentId,
      ...openings.map((opening) => opening.agentId),
      ...extraPeerMessages.flatMap((message) => [message.fromAgentId, message.toAgentId]),
    ].filter((agentId): agentId is string => Boolean(agentId));
    const agentIds = [...new Set([...required, ...ids])].slice(0, 8);
    const seedAgentId = primaryHint?.seedAgentId ?? primaryPeer?.toAgentId ?? agentIds[0];
    if (!seedAgentId) throw new Error("No salió un mensaje.");
    const turns = Math.min(1000, Math.max(1, parsed.data.maxTurns ?? 5));
    const prepared = await prepareStoredRun({
      agentIds,
      seedAgentId,
      maxTurnsPerAgent: turns,
      scenarioHint: primaryHint?.scenarioHint,
      peerMessage: primaryPeer,
    });
    const run = await startPreparedRun({
      ...prepared,
      maxTurns: turns,
      agents: applyPathBias(prepared.agents, edges),
      // Pasos from the UI is a hard total-turn budget for the whole run, not per agent.
      opts: { ...prepared.opts, openings, extraPeerMessages, maxTotalTurns: turns },
    });
    return c.json({ runs: [run] }, 201);
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, statusFor(err, message));
  }
});

demoSimRoutes.post("/evaluate", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = z.object({
    companyName: z.string().min(1).max(120),
    objective: z.string().min(20).max(2000),
    design: designBody,
    runIds: z.array(z.string().min(1).max(80)).length(1),
  }).safeParse(json);
  if (!parsed.success) return c.json({ error: "Cuerpo inválido" }, 400);
  const denied = denyIfOverBudget(c, demoGuard.checkModelCall(requestIp(c)));
  if (denied) return denied;
  try {
    const design = parsed.data.design as DemoSimDesign;
    return c.json(await evaluateRiskRun({
      companyName: parsed.data.companyName,
      design,
      runIds: parsed.data.runIds,
      objective: parsed.data.objective,
    }));
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
  objectiveScore: z.number().min(0).max(10).optional(),
});

const patchBody = z.object({
  agentId: id,
  agentName: z.string().min(1).max(120),
  reason: z.string().min(1).max(400),
  instruction: z.string().min(12).max(400),
});

demoSimRoutes.post("/deepen", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = z.object({
    companyName: z.string().min(1).max(120),
    objective: z.string().min(20).max(2000),
    approach: z.string().min(20).max(10000),
    seedAgentId: id.optional(),
    attackSurface: z.string().max(2000).optional(),
    runId: z.string().min(1).max(80).optional(),
    evaluation: evaluationBody,
    userApproachNotes: z.string().max(4000).optional(),
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
  prompt: z.string().min(20).max(10000),
  attackSurface: z.string().max(2000),
  runId: z.string().min(1).max(80),
  evaluation: evaluationBody,
  approach: z.string().max(10000).optional(),
  allowEmpty: z.boolean().optional(),
  actions: z.array(actionBody).min(1).max(DEMO_SIM_MAX_ACTIONS).optional(),
  maxTurns: z.number().int().min(1).max(1000).optional(),
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

demoSimRoutes.post("/findings/:id/patch", async (c) => {
  const findingId = c.req.param("id")?.trim() ?? "";
  if (!findingId) return c.json({ error: "Falta el id" }, 400);
  const denied = denyIfOverBudget(c, demoGuard.checkModelCall(requestIp(c)));
  if (denied) return denied;
  try {
    return c.json(await designGuardPatch(findingId));
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, statusFor(err, message));
  }
});

demoSimRoutes.post("/findings/:id/retest", async (c) => {
  const findingId = c.req.param("id")?.trim() ?? "";
  if (!findingId) return c.json({ error: "Falta el id" }, 400);
  const json = await c.req.json().catch(() => null);
  const parsed = z.object({ patches: z.array(patchBody).min(1).max(4) }).safeParse(json);
  if (!parsed.success) return c.json({ error: "Cuerpo inválido" }, 400);
  const spend = spendMeter.check();
  if (!spend.ok) return c.json({ error: spend.message }, 429);
  const denied = denyIfOverBudget(c, demoGuard.checkModelCall(requestIp(c)));
  if (denied) return denied;
  try {
    return c.json(await retestWithPatch({ findingId, patches: parsed.data.patches }));
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, statusFor(err, message));
  }
});
