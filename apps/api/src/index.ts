import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { config } from "./config.js";
import { traceBus } from "./events.js";
import { createAndStartRun, getRun, listRuns } from "./harness/orchestrator.js";

const createRunSchema = z.object({
  agents: z
    .tuple([
      z.object({
        name: z.string().min(1).max(64),
        role: z.string().min(1).max(500),
        goal: z.string().min(1).max(1000),
      }),
      z.object({
        name: z.string().min(1).max(64),
        role: z.string().min(1).max(500),
        goal: z.string().min(1).max(1000),
      }),
    ]),
  maxTurnsPerAgent: z.number().int().min(1).max(30).optional(),
});

const app = new Hono();

app.use(
  "*",
  cors({
    origin: config.webOrigin,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    hasApiKey: Boolean(config.anthropicApiKey),
    model: config.model,
  }),
);

app.get("/api/runs", (c) => c.json({ runs: listRuns() }));

app.get("/api/runs/:id", (c) => {
  const run = getRun(c.req.param("id"));
  if (!run) return c.json({ error: "Run not found" }, 404);
  return c.json({ run, events: traceBus.history(run.id) });
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

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[api] http://localhost:${info.port}`);
  console.log(
    `[api] ANTHROPIC_API_KEY ${config.anthropicApiKey ? "loaded" : "MISSING — set .env"}`,
  );
});
