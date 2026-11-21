import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { assertApiKeyConfigured, config } from "./config.js";
import { traceBus } from "./events.js";
import { judgeRun, judgeTranscript, type RunJudgment } from "./harness/judge.js";
import {
  createAndStartRun,
  evaluateInternalRun,
  getInternalRun,
  getRun,
  listRuns,
  prepareStoredRun,
  previewRiskPaths,
  riskPathsForRun,
  setRunJudgment,
  startPreparedRun,
} from "./harness/orchestrator.js";
import { agentRoutes } from "./agents/routes.js";
import { readBatchResults } from "./batch-results.js";
import { pingDatabase } from "./db/client.js";
import { isRealMailFile, listEmailScenarios } from "./email/scenarios.js";
import { enterpriseRoutes } from "./enterprise/routes.js";
import { profileRoutes } from "./profiles/routes.js";
import { refineModelId } from "./profiles/refine.js";
import { ADMIN_HEADER } from "./security/admin.js";
import { demoGuard, denyIfOverBudget, requestIp } from "./security/budget.js";
import { errorMessage } from "./security/redact.js";
import { modelErrorStatus } from "./security/spend.js";

const REAL_MAIL_DENIED =
  "Este archivo de correos es solo local (ALLOW_REAL_EMAIL_FILES no está activo).";

const id = z.string().min(1).max(128);

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

const emailScenarioSchema = z.object({
  file: z.string().regex(/^[A-Za-z0-9_.-]+\.json$/),
  id: z.string().min(1).max(200),
  senderCheck: z.boolean().optional(),
  provenanceTag: z.boolean().optional(),
  approvalGate: z.boolean().optional(),
});

const createStoredRunSchema = z.object({
  agentIds: z.array(id).min(2).max(8),
  seedAgentId: id,
  maxTurnsPerAgent: z.number().int().min(1).max(30).optional(),
  scenarioHint: z.string().max(2000).optional(),
  emailScenario: emailScenarioSchema.optional(),
  financeAgentIds: z.array(id).max(8).optional(),
});

const riskPathsSchema = z.object({
  agentIds: z.array(id).min(1).max(8),
  seedAgentId: id,
  financeAgentIds: z.array(id).max(8).optional(),
  emailScenario: emailScenarioSchema.optional(),
});

export const app = new Hono();

/**
 * Last resort for anything a route did not catch: a JSON 500 with secrets stripped, instead of
 * Hono's plain-text "Internal Server Error". HTTPException keeps its own response (e.g. 413).
 */
export function handleUnexpectedError(err: unknown, c: Context): Response {
  if (err instanceof HTTPException) return err.getResponse();
  const message = errorMessage(err);
  console.error("[api] unhandled error:", message);
  return c.json({ error: message }, 500);
}

app.onError(handleUnexpectedError);

/** Pure: HTTP status for an error thrown while preparing or starting a stored-agents run. */
export function storedRunErrorStatus(message: string): 400 | 404 | 500 | 503 {
  if (message.includes("ANTHROPIC_API_KEY")) return 503;
  if (message.includes("not found") || message.includes("ENOENT")) return 404;
  if (
    message.includes("Invalid scenario file") ||
    message.includes("JSON") ||
    message.includes("financeAgentIds") ||
    message.includes("different") ||
    // Bad selection: the request is wrong, not the server.
    message.includes("seedAgentId must be one of the selected agents") ||
    message.includes("Select at least 2 agents")
  ) {
    return 400;
  }
  return 500;
}

app.use(
  "*",
  cors({
    origin: config.webOrigin,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", ADMIN_HEADER],
  }),
);

/** Largest legit body: a pasted transcript (200k chars) or a context file (200k chars). */
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ error: "Cuerpo de la petición demasiado grande (máx. 1 MB)." }, 413),
  }),
);

/**
 * CSRF: c.req.json() also parses text/plain bodies, and a text/plain POST is a CORS "simple"
 * request (no preflight), so any website could make a visitor's browser start runs. Requiring
 * application/json forces a preflight, which CORS only allows from WEB_ORIGIN.
 * PUT and DELETE are never "simple", so they are always preflighted.
 */
app.use("/api/*", async (c, next) => {
  if (c.req.method === "POST") {
    const type = (c.req.header("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (type !== "application/json") {
      return c.json({ error: "Content-Type debe ser application/json." }, 415);
    }
  }
  await next();
});

app.get("/health", async (c) => {
  const db = await pingDatabase();
  return c.json({
    ok: true,
    hasApiKey: Boolean(config.anthropicApiKey),
    viaProxy: Boolean(config.anthropicBaseUrl),
    hasDatabase: db.ok,
    dbDriver: config.dbDriver,
    database: db.ok ? db : { ...db, error: db.error ? errorMessage(db.error) : undefined },
    model: config.model,
    refineModel: refineModelId(),
    writesNeedAdminToken: Boolean(config.adminToken),
    /** Deployed without ADMIN_TOKEN: writes are blocked for everyone (fail closed). */
    writesDisabled: config.adminFailClosed && !config.adminToken,
  });
});

app.route("/api/profiles", profileRoutes);
app.route("/api/agents", agentRoutes);
app.route("/api/enterprise", enterpriseRoutes);

app.get("/api/runs", (c) => c.json({ runs: listRuns() }));

/** Emails from email-harness/scenarios, with the deterministic sender check pre-computed. */
app.get("/api/email-scenarios", (c) => {
  // No server path in the response, and git-ignored real mailboxes stay local unless allowed.
  const { dir, scenarios, errors } = listEmailScenarios({
    includeRealMail: config.allowRealEmailFiles,
  });
  return c.json({
    scenarios,
    errors: errors.map((e) => e.split(dir).join("email-harness/scenarios")),
  });
});

/** Last published batch experiment (apps/api/results/batch-latest.json), or null if none yet. */
app.get("/api/batch-results", (c) => {
  try {
    return c.json({ results: readBatchResults() });
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 500);
  }
});

app.get("/api/runs/:id", (c) => {
  const run = getRun(c.req.param("id"));
  if (!run) return c.json({ error: "Ejecución no encontrada" }, 404);
  const internal = getInternalRun(run.id);
  return c.json({
    run,
    events: traceBus.history(run.id),
    judgment: internal?.judgment ?? null,
    evaluation: internal ? evaluateInternalRun(internal) : null,
    riskPaths: internal?.email ? riskPathsForRun(internal) : null,
  });
});

/** MESH risk paths for a run setup, before launching it (no model call). */
app.post("/api/risk-paths", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = riskPathsSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }
  if (
    parsed.data.emailScenario &&
    !config.allowRealEmailFiles &&
    isRealMailFile(parsed.data.emailScenario.file)
  ) {
    return c.json({ error: REAL_MAIL_DENIED }, 403);
  }
  try {
    return c.json({ analysis: await previewRiskPaths(parsed.data) });
  } catch (err) {
    const message = errorMessage(err);
    const status =
      message.includes("not found") || message.includes("ENOENT")
        ? 404
        : message.includes("seedAgentId") || message.includes("Invalid scenario file")
          ? 400
          : 500;
    return c.json({ error: message }, status);
  }
});

/** Concurrent judge requests for the same run share one model call (and one budget slot). */
const judgeInFlight = new Map<string, Promise<RunJudgment>>();

app.post("/api/runs/:id/judge", async (c) => {
  const internal = getInternalRun(c.req.param("id"));
  if (!internal) return c.json({ error: "Ejecución no encontrada" }, 404);
  if (internal.status !== "completed" && internal.status !== "failed") {
    return c.json({ error: "La ejecución todavía está en curso" }, 409);
  }
  const evaluation = evaluateInternalRun(internal);
  if (internal.judgment) {
    return c.json({ judgment: internal.judgment, evaluation, cached: true });
  }

  try {
    let pending = judgeInFlight.get(internal.id);
    if (!pending) {
      const denied = denyIfOverBudget(c, demoGuard.checkModelCall(requestIp(c)));
      if (denied) return denied;
      pending = judgeRun({
        scenario: internal.scenarioHint ?? "",
        seedAgentId: internal.seedAgentId ?? internal.agents[0]?.id ?? "",
        roster: internal.roster ?? [],
        events: traceBus.history(internal.id),
        email: internal.email,
        evaluation,
      }).finally(() => judgeInFlight.delete(internal.id));
      judgeInFlight.set(internal.id, pending);
    }
    const judgment = await pending;
    setRunJudgment(internal.id, judgment);
    return c.json({ judgment, evaluation, cached: false });
  } catch (err) {
    const message = errorMessage(err);
    const status = modelErrorStatus(err, message);
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

  const denied = denyIfOverBudget(c, demoGuard.checkModelCall(requestIp(c)));
  if (denied) return denied;
  try {
    const judgment = await judgeTranscript(parsed.data);
    return c.json({ judgment });
  } catch (err) {
    const message = errorMessage(err);
    const status = modelErrorStatus(err, message);
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
    assertApiKeyConfigured();
    const denied = denyIfOverBudget(c, demoGuard.checkRun(requestIp(c)));
    if (denied) return denied;
    const run = createAndStartRun(parsed.data);
    return c.json({ run }, 201);
  } catch (err) {
    const message = errorMessage(err);
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
  if (
    parsed.data.emailScenario &&
    !config.allowRealEmailFiles &&
    isRealMailFile(parsed.data.emailScenario.file)
  ) {
    return c.json({ error: REAL_MAIL_DENIED }, 403);
  }

  try {
    // Validate first (no budget spent on a bad request), then check the budget and start
    // synchronously, so two requests cannot both slip past the concurrency check.
    const prepared = await prepareStoredRun(parsed.data);
    const denied = denyIfOverBudget(c, demoGuard.checkRun(requestIp(c)));
    if (denied) return denied;
    const run = startPreparedRun(prepared);
    return c.json({ run }, 201);
  } catch (err) {
    const message = errorMessage(err);
    return c.json({ error: message }, storedRunErrorStatus(message));
  }
});

app.get("/api/runs/:id/events", (c) => {
  const runId = c.req.param("id");
  const run = getRun(runId);
  if (!run) return c.json({ error: "Ejecución no encontrada" }, 404);

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
