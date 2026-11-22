import { Hono } from "hono";
import { z } from "zod";
import { chainFromHops, graphFromIdChains } from "@sandbox/shared";
import { designEverydayProblems } from "../harness/characterize.js";
import { prepareStoredRun, startPreparedRun } from "../harness/orchestrator.js";
import { getFlowGraph, saveFlowGraph } from "../db/flow-graph-repo.js";
import { loadRun } from "../db/runs-repo.js";
import { demoGuard, denyIfOverBudget, requestIp } from "../security/budget.js";
import { errorMessage } from "../security/redact.js";
import { modelErrorStatus, spendMeter } from "../security/spend.js";

export const characterizeRoutes = new Hono();

const id = z.string().min(1).max(128);

characterizeRoutes.post("/problems", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = z
    .object({
      seedAgentId: id,
      agentIds: z.array(id).min(1).max(8),
      count: z.number().int().min(1).max(5),
      avoidTitles: z.array(z.string().max(120)).max(24).optional(),
    })
    .safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Cuerpo inválido", details: parsed.error.flatten() }, 400);
  }
  const denied = denyIfOverBudget(c, demoGuard.checkModelCall(requestIp(c)));
  if (denied) return denied;
  try {
    const result = await designEverydayProblems(parsed.data);
    return c.json(result);
  } catch (err) {
    const message = errorMessage(err);
    const status = message.includes("no encontrado") || message.includes("semilla") ? 400 : modelErrorStatus(err, message);
    return c.json({ error: message }, status);
  }
});

const runBody = z.object({
  agentIds: z.array(id).min(1).max(8),
  seedAgentId: id,
  scenarioHint: z.string().min(20).max(2000),
  maxTurnsPerAgent: z.number().int().min(1).max(12).optional(),
});

/** Start every case at once. One request, so the per-minute gate does not serialize them. */
characterizeRoutes.post("/runs", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = z.object({ runs: z.array(runBody).min(1).max(40) }).safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Cuerpo inválido. Máximo 40 simulaciones por tanda.", details: parsed.error.flatten() }, 400);
  }
  const spend = spendMeter.check();
  if (!spend.ok) return c.json({ error: spend.message }, 429);
  try {
    const prepared = await Promise.all(
      parsed.data.runs.map((run) => prepareStoredRun({ ...run, maxTurnsPerAgent: run.maxTurnsPerAgent ?? 5 })),
    );
    const runs = await Promise.all(prepared.map((run) => startPreparedRun(run)));
    return c.json({ runs }, 201);
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, modelErrorStatus(err, message));
  }
});

const flowBody = z.object({
  companyName: z.string().min(1).max(120),
  runs: z
    .array(
      z.object({
        runId: z.string().min(1).max(80),
        seedAgentId: id,
        names: z.record(z.string().min(1).max(80), z.string().max(80)),
      }),
    )
    .min(1)
    .max(40),
});

characterizeRoutes.get("/graph", async (c) => {
  const companyName = c.req.query("company")?.trim() ?? "";
  if (!companyName) return c.json({ error: "Falta la empresa" }, 400);
  try {
    const graph = await getFlowGraph(companyName);
    return c.json({ graph });
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 500);
  }
});

/** When every case is finished: directed graph, saved for that company. */
characterizeRoutes.post("/flows", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = flowBody.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Cuerpo inválido", details: parsed.error.flatten() }, 400);
  }
  try {
    const labels: Record<string, string> = {};
    const idChains: string[][] = [];
    for (const row of parsed.data.runs) {
      Object.assign(labels, row.names);
      const stored = await loadRun(row.runId);
      if (!stored) throw new Error(`Ejecución no encontrada: ${row.runId}`);
      const hops = stored.events.flatMap((event) => {
        if (event.type !== "agent.message_sent") return [];
        const message = event.payload.message as { fromAgentId?: string; toAgentId?: string } | undefined;
        if (!message?.fromAgentId || !message.toAgentId) return [];
        return [{ from: message.fromAgentId, to: message.toAgentId }];
      });
      idChains.push(chainFromHops(row.seedAgentId, hops));
    }
    const graph = await saveFlowGraph(graphFromIdChains(parsed.data.companyName, idChains, labels));
    return c.json({ graph });
  } catch (err) {
    const message = errorMessage(err);
    const status = message.includes("no encontrada") ? 404 : 500;
    return c.json({ error: message }, status);
  }
});
