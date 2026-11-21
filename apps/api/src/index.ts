import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { config } from "./config.js";
import { traceBus } from "./events.js";
import { judgeRun, judgeTranscript } from "./harness/judge.js";
import {
  createAndStartRun,
  createAndStartStoredRun,
  evaluateInternalRun,
  getInternalRun,
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
});

const app = new Hono();

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

app.get("/api/runs", (c) => c.json({ runs: listRuns() }));

/** Emails from email-harness/scenarios, with the deterministic sender check pre-computed. */
app.get("/api/email-scenarios", (c) => c.json(listEmailScenarios()));

app.get("/api/runs/:id", (c) => {
  const run = getRun(c.req.param("id"));
  if (!run) return c.json({ error: "Run not found" }, 404);
  const internal = getInternalRun(run.id);
  return c.json({
    run,
    events: traceBus.history(run.id),
    judgment: internal?.judgment ?? null,
    evaluation: internal ? evaluateInternalRun(internal) : null,
  });
});

app.post("/api/runs/:id/judge", async (c) => {
  const internal = getInternalRun(c.req.param("id"));
  if (!internal) return c.json({ error: "Run not found" }, 404);
  if (internal.status !== "completed" && internal.status !== "failed") {
    return c.json({ error: "Run still in progress" }, 409);
  }
  const evaluation = evaluateInternalRun(internal);
  if (internal.judgment) {
    return c.json({ judgment: internal.judgment, evaluation, cached: true });
  }

  try {
    const judgment = await judgeRun({
      scenario: internal.scenarioHint ?? "",
      seedAgentId: internal.seedAgentId ?? internal.agents[0]?.id ?? "",
      roster: internal.roster ?? [],
      events: traceBus.history(internal.id),
      email: internal.email,
      evaluation,
    });
    setRunJudgment(internal.id, judgment);
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
    const run = createAndStartRun(parsed.data);
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

app.get("/api/runs/:id/events", (c) => {
  const runId = c.req.param("id");
  const run = getRun(runId);
  if (!run) return c.json({ error: "Run not found" }, 404);

  return streamSSE(c, async (stream) => {
    const history = traceBus.history(runId);
    for (const event of history) {
      await stream.writeSSE({
        event: "trace",
        data: JSON.stringify(event),
        id: event.id,
      });
    }

    let closed = false;
    const unsubscribe = traceBus.subscribe(runId, (event) => {
      if (closed) return;
      void stream.writeSSE({
        event: "trace",
        data: JSON.stringify(event),
        id: event.id,
      });

      if (
        event.type === "run.completed" ||
        event.type === "run.failed"
      ) {
        closed = true;
        unsubscribe();
        void stream.close();
      }
    });

    // Keep alive until run ends or client disconnects.
    while (!closed) {
      await stream.sleep(15_000);
      if (closed) break;
      await stream.writeSSE({ event: "ping", data: "{}" });
      const current = getRun(runId);
      if (
        current &&
        (current.status === "completed" || current.status === "failed")
      ) {
        closed = true;
        unsubscribe();
        break;
      }
    }

    unsubscribe();
  });
});

serve({ fetch: app.fetch, port: config.port }, async (info) => {
  const db = await pingDatabase();
  console.log(`[api] http://localhost:${info.port}`);
  console.log(
    `[api] ANTHROPIC_API_KEY ${config.anthropicApiKey ? "loaded" : "MISSING — set .env"}`,
  );
  console.log(
    `[api] DB ${db.driver}${db.ok ? " ok" : ` FAIL: ${db.error}`}${
      config.dbDriver === "sqlite" ? ` (${config.sqlitePath})` : ""
    }`,
  );
});
