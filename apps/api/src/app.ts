import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { config } from "./config.js";
import { loadRun } from "./db/runs-repo.js";
import { judgeRun, judgeTranscript } from "./harness/judge.js";
import {
  createAndStartRun,
  createAndStartStoredRun,
  evaluateInternalRun,
  getRun,
  listRuns,
  setRunJudgment,
} from "./harness/orchestrator.js";
import { agentRoutes } from "./agents/routes.js";
import { pingDatabase } from "./db/client.js";
import { listEmailScenarios } from "./email/scenarios.js";
import { enterpriseRoutes } from "./enterprise/routes.js";
import { profileRoutes } from "./profiles/routes.js";
import { refineModelId } from "./profiles/refine.js";
import { MOCK_DB_CATALOG } from "./harness/mock-db.js";

const createRunSchema = z.object({
  agents: z
    .tuple([
      z.object({
        name: z.string().min(1).max(64),
        role: z.string().min(1).max(16000),
        goal: z.string().min(1).max(2000),
      }),
      z.object({
        name: z.string().min(1).max(64),
        role: z.string().min(1).max(16000),
        goal: z.string().min(1).max(2000),
      }),
    ]),
  maxTurnsPerAgent: z.number().int().min(1).max(30).optional(),
});

const createStoredRunSchema = z.object({
  agentIds: z.array(z.string().min(1)).min(2).max(8),
  seedAgentId: z.string().min(1),
  maxTurnsPerAgent: z.number().int().min(1).max(30).optional(),
  scenarioHint: z.string().max(2000).optional(),
  emailScenario: z
    .object({
      file: z.string().regex(/^[A-Za-z0-9_.-]+\.json$/),
      id: z.string().min(1).max(200),
      senderCheck: z.boolean().optional(),
    })
    .optional(),
  financeAgentIds: z.array(z.string().min(1)).max(8).optional(),
  peerMessage: z.object({
    fromAgentId: z.string().min(1),
    toAgentId: z.string().min(1),
    body: z.string().min(1).max(4000),
  }).optional(),
});

const app = new Hono();

app.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

app.use(
  "*",
  cors({
    origin: config.webOrigin,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/health", async (c) => {
  const db = await pingDatabase();
  return c.json({
    ok: true,
    hasApiKey: Boolean(config.anthropicApiKey),
    hasDatabase: db.ok,
    dbDriver: config.dbDriver,
    database: db,
    model: config.model,
    refineModel: refineModelId(),
  });
});

app.route("/api/profiles", profileRoutes);
app.route("/api/agents", agentRoutes);
app.route("/api/enterprise", enterpriseRoutes);

app.get("/api/runs", async (c) => c.json({ runs: await listRuns() }));

/** Emails from email-harness/scenarios, with the deterministic sender check pre-computed. */
app.get("/api/email-scenarios", (c) => c.json(listEmailScenarios()));
app.get("/api/mock-db", (c) => c.json({
  databases: Object.entries(MOCK_DB_CATALOG).map(([tool, meta]) => ({ tool, file: meta.file, label: meta.label, sensitivity: meta.sensitivity, kind: "tool" })),
}));

app.get("/api/runs/:id", async (c) => {
  const stored = await loadRun(c.req.param("id"));
  if (!stored) return c.json({ error: "Run not found" }, 404);
  const run = await getRun(stored.run.id);
  const internal = stored.run;
  return c.json({
    run,
    events: stored.events,
    judgment: internal?.judgment ?? null,
    evaluation: evaluateInternalRun(internal, stored.events),
  });
});

app.post("/api/runs/:id/judge", async (c) => {
  const stored = await loadRun(c.req.param("id"));
  const internal = stored?.run;
  if (!internal) return c.json({ error: "Run not found" }, 404);
  if (internal.status !== "completed" && internal.status !== "failed") {
    return c.json({ error: "Run still in progress" }, 409);
  }
  const evaluation = evaluateInternalRun(internal, stored!.events);
  if (internal.judgment) {
    return c.json({ judgment: internal.judgment, evaluation, cached: true });
  }

  try {
    const judgment = await judgeRun({
      scenario: internal.peerMessage
        ? `Injected peer message ${internal.peerMessage.fromAgentId} → ${internal.peerMessage.toAgentId}:\n${internal.peerMessage.body}`
        : internal.scenarioHint ?? "",
      seedAgentId: internal.seedAgentId ?? internal.agents[0]?.id ?? "",
      roster: internal.roster ?? [],
      events: stored!.events,
      email: internal.email,
      evaluation,
    });
    await setRunJudgment(internal.id, judgment);
    return c.json({ judgment, evaluation, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 502;
    return c.json({ error: message }, status);
  }
});

const judgeTranscriptSchema = z.object({
  transcript: z.string().min(20).max(200_000),
  scenario: z.string().max(8000).optional(),
  agentsNote: z.string().max(8000).optional(),
});

app.post("/api/judge/transcript", async (c) => {
  const json = await c.req.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return c.json({ error: "Expected JSON body with transcript" }, 400);
  }
  const parsed = judgeTranscriptSchema.safeParse(json);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const fieldMsg = Object.entries(flat.fieldErrors)
      .map(([k, v]) => `${k}: ${(v ?? []).join(", ")}`)
      .join("; ");
    return c.json(
      {
        error: fieldMsg || "Invalid body (need transcript string)",
        details: flat,
      },
      400,
    );
  }

  try {
    const judgment = await judgeTranscript(parsed.data);
    return c.json({ judgment });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 502;
    return c.json({ error: message }, status);
  }
});

app.post("/api/runs", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createRunSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }

  try {
    const run = await createAndStartRun(parsed.data);
    return c.json({ run }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return c.json({ error: message }, status);
  }
});

app.post("/api/runs/from-stored", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createStoredRunSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }

  try {
    const run = await createAndStartStoredRun(parsed.data);
    return c.json({ run }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("ANTHROPIC_API_KEY")) {
      return c.json({ error: message }, 503);
    }
    if (message.includes("not found") || message.includes("ENOENT")) {
      return c.json({ error: message }, 404);
    }
    if (
      message.includes("Invalid scenario file") ||
      message.includes("JSON") ||
      message.includes("financeAgentIds")
    ) {
      return c.json({ error: message }, 400);
    }
    if (message.includes("different")) {
      return c.json({ error: message }, 400);
    }
    return c.json({ error: message }, 500);
  }
});

app.get("/api/runs/:id/events", async (c) => {
  const runId = c.req.param("id");
  if (!await loadRun(runId)) return c.json({ error: "Run not found" }, 404);
  return streamSSE(c, async stream => {
    const sent = new Set<string>();
    let aborted = false;
    stream.onAbort(() => { aborted = true; });
    const deadline = Date.now() + 20_000;
    while (!aborted && Date.now() < deadline) {
      const snapshot = await loadRun(runId);
      if (!snapshot) break;
      for (const event of snapshot.events) {
        if (sent.has(event.id)) continue;
        await stream.writeSSE({ event: "trace", data: JSON.stringify(event), id: event.id });
        sent.add(event.id);
      }
      if (["completed", "failed", "stopped"].includes(snapshot.run.status)) break;
      await stream.writeSSE({ event: "ping", data: "{}" });
      await stream.sleep(1000);
    }
  });
});

export default app;
