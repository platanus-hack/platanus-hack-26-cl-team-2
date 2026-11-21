/** The process-wide demo guard and its Hono helpers (wiring only; logic in demo-guard.ts). */
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";
import { config } from "../config.js";
import { activeRunCount } from "../harness/orchestrator.js";
import { clientIp, DemoGuard, type GuardResult } from "./demo-guard.js";

export const demoGuard = new DemoGuard(
  {
    perIpPerMinute: config.rateLimitPerMinute,
    maxRunsPerDay: config.maxRunsPerDay,
    maxConcurrentRuns: config.maxConcurrentRuns,
    maxJudgeCallsPerDay: config.maxJudgeCallsPerDay,
  },
  activeRunCount,
);

export function requestIp(c: Context): string {
  let remote: string | undefined;
  try {
    remote = getConnInfo(c).remote.address;
  } catch {
    remote = undefined; // app.request() in tests has no socket
  }
  return clientIp({
    trustedHeaderValue: config.clientIpHeader ? c.req.header(config.clientIpHeader) : undefined,
    forwardedFor: c.req.header("x-forwarded-for"),
    remoteAddress: remote,
    trustedHops: config.trustProxyHops,
  });
}

/** null when allowed; otherwise the 429 response to return. */
export function denyIfOverBudget(c: Context, result: GuardResult) {
  if (result.ok) return null;
  c.header("Retry-After", String(result.retryAfterSec));
  return c.json({ error: result.message, reason: result.reason }, 429);
}
