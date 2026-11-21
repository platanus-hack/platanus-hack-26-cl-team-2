/** The process-wide demo guard and its Hono helpers (wiring only; logic in demo-guard.ts). */
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";
import { config } from "../config.js";
import { activeRunCount } from "../harness/orchestrator.js";
import { clientIp, DemoGuard, vercelClientIp, type GuardResult } from "./demo-guard.js";
import { spendMeter } from "./spend.js";

// Only the HTTP server loads this module, so only it enforces the daily US$ cap
// (CLI scripts like batch and the MCP quick test are deliberate spend).
spendMeter.setLimit(config.maxSpendUsdPerDay);

export const demoGuard = new DemoGuard(
  {
    perIpPerMinute: config.rateLimitPerMinute,
    maxRunsPerDay: config.maxRunsPerDay,
    maxConcurrentRuns: config.maxConcurrentRuns,
    maxJudgeCallsPerDay: config.maxJudgeCallsPerDay,
    spendGate: () => spendMeter.check(),
  },
  activeRunCount,
);

let warnedMissingIpHeader = false;

export function requestIp(c: Context): string {
  let remote: string | undefined;
  try {
    remote = getConnInfo(c).remote.address;
  } catch {
    remote = undefined; // app.request() in tests has no socket
  }
  const trusted = config.clientIpHeader
    ? c.req.header(config.clientIpHeader)
    : config.onVercel
      ? vercelClientIp({
          realIp: c.req.header("x-real-ip"),
          vercelForwardedFor: c.req.header("x-vercel-forwarded-for"),
        })
      : undefined;
  if (config.clientIpHeader && !trusted && !config.trustProxyHops && !warnedMissingIpHeader) {
    // Without it every visitor falls back to the proxy's socket address: one shared bucket.
    warnedMissingIpHeader = true;
    console.warn(
      `[api] request without ${config.clientIpHeader}: per-IP limit falls back to the socket ` +
        "address (shared by everyone behind the proxy). Set CLIENT_IP_HEADER or TRUST_PROXY_HOPS.",
    );
  }
  return clientIp({
    trustedHeaderValue: trusted,
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
