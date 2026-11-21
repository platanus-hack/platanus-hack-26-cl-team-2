import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { app } from "./app.js";
import { config } from "./config.js";
import { pingDatabase } from "./db/client.js";
import { errorMessage } from "./security/redact.js";
import { startEvaluationWorker } from "./evaluation-jobs/worker.js";

/**
 * Production (Render): serve the built web app from the same server, so the page and the
 * API share one URL and the web's relative /api and /health calls work without CORS.
 * Locally there is no apps/web/dist, so Vite's dev server keeps doing this.
 */
const webDist = resolve(process.cwd(), process.env.WEB_DIST_DIR ?? "../web/dist");
if (existsSync(resolve(webDist, "index.html"))) {
  const root = relative(process.cwd(), webDist) || ".";
  app.use("/*", serveStatic({ root }));
  // Client-side routes fall back to index.html; unknown /api paths stay 404.
  app.get("*", async (c, next) => {
    // Missing files (e.g. an old hashed asset after a deploy) must 404, not return HTML.
    if (c.req.path.startsWith("/api/") || /\.[A-Za-z0-9]+$/.test(c.req.path)) return next();
    return serveStatic({ path: `${root}/index.html` })(c, next);
  });
  console.log(`[api] serving web app from ${webDist}`);
}

serve({ fetch: app.fetch, port: config.port }, async (info) => {
  const db = await pingDatabase();
  if (db.ok && process.env.EVALUATION_WORKER_DISABLED !== "1") startEvaluationWorker();
  console.log(`[api] http://localhost:${info.port}`);
  console.log(
    `[api] ANTHROPIC_API_KEY ${config.anthropicApiKey ? "loaded" : "MISSING — set .env"} · ${
      config.anthropicBaseUrl ? "via ANTHROPIC_BASE_URL (proxy)" : "direct to api.anthropic.com"
    }`,
  );
  console.log(
    `[api] DB ${db.driver}${db.ok ? " ok" : ` FAIL: ${errorMessage(db.error)}`}${
      config.dbDriver === "sqlite" ? ` (${config.sqlitePath})` : ""
    }`,
  );
  console.log(
    `[api] demo guard: ${config.rateLimitPerMinute}/min per IP · ${config.maxRunsPerDay} runs/day · ` +
      `${config.maxConcurrentRuns} concurrent · ${config.maxJudgeCallsPerDay} judge+refine/day · ` +
      `max ${config.maxTurnsPerAgent} turns/agent · ` +
      `${config.maxSpendUsdPerDay > 0 ? `US$${config.maxSpendUsdPerDay}/day spend cap` : "no spend cap"} · writes ${
        config.adminToken
          ? "need x-admin-token"
          : config.adminFailClosed
            ? "BLOCKED (deployed without ADMIN_TOKEN)"
            : "open (no ADMIN_TOKEN)"
      }`,
  );
});
