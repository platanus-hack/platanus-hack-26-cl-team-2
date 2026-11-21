/**
 * In-memory budget guard for the public demo: every request that spends model tokens goes
 * through here first. One process, no persistence: a restart resets the counters, which is
 * acceptable for a hackathon demo (Render restarts are rare and redeploys are ours).
 *
 * - per-IP sliding window (default 3 model-calling requests per minute)
 * - global daily cap on runs (MAX_RUNS_PER_DAY) and on the cheaper judge/refine calls
 * - max concurrent runs (MAX_CONCURRENT_RUNS)
 *
 * A limit of 0 disables that check.
 */

export const RATE_LIMIT_MESSAGE = "Límite de demo alcanzado, intenta en un minuto.";
export const DAILY_LIMIT_MESSAGE = "Límite diario de la demo alcanzado, intenta mañana.";

const WINDOW_MS = 60_000;

export type GuardOptions = {
  perIpPerMinute: number;
  maxRunsPerDay: number;
  maxConcurrentRuns: number;
  /** Judge + profile refine calls (Haiku), shared by everyone. */
  maxJudgeCallsPerDay: number;
  /**
   * Money ceiling checked before anything else (security/spend.ts): when the day's US$ budget
   * is spent, no request may start a model call, whatever the counters say.
   */
  spendGate?: () => { ok: true } | { ok: false; message: string; retryAfterSec: number };
  /** Bound on remembered IPs, so spoofed/rotating addresses cannot grow memory forever. */
  maxTrackedIps?: number;
  now?: () => number;
};

export type GuardDenial = {
  ok: false;
  reason: "rate" | "daily" | "concurrent" | "budget";
  message: string;
  retryAfterSec: number;
};
export type GuardResult = { ok: true } | GuardDenial;

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function secondsToUtcMidnight(ms: number): number {
  const d = new Date(ms);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - ms) / 1000));
}

export class DemoGuard {
  private readonly hits = new Map<string, number[]>();
  private day = "";
  private runsToday = 0;
  private judgeCallsToday = 0;
  private readonly now: () => number;
  private readonly maxTrackedIps: number;

  constructor(
    private readonly opts: GuardOptions,
    /** Runs currently pending or running (read from the orchestrator, never drifts). */
    private readonly activeRuns: () => number,
  ) {
    this.now = opts.now ?? Date.now;
    this.maxTrackedIps = opts.maxTrackedIps ?? 10_000;
  }

  /** Before starting a run. On ok the run is counted: call it right before starting it. */
  checkRun(ip: string): GuardResult {
    const t = this.now();
    this.rollDay(t);
    const spend = this.checkSpend();
    if (!spend.ok) return spend;
    const { maxConcurrentRuns, maxRunsPerDay } = this.opts;
    if (maxConcurrentRuns > 0 && this.activeRuns() >= maxConcurrentRuns) {
      return { ok: false, reason: "concurrent", message: RATE_LIMIT_MESSAGE, retryAfterSec: 60 };
    }
    if (maxRunsPerDay > 0 && this.runsToday >= maxRunsPerDay) {
      return { ok: false, reason: "daily", message: DAILY_LIMIT_MESSAGE, retryAfterSec: secondsToUtcMidnight(t) };
    }
    const rate = this.checkIp(ip, t);
    if (!rate.ok) return rate;
    this.recordIp(ip, t);
    this.runsToday += 1;
    return { ok: true };
  }

  /** Before a judge / transcript judge / profile refine call. */
  checkModelCall(ip: string): GuardResult {
    const t = this.now();
    this.rollDay(t);
    const spend = this.checkSpend();
    if (!spend.ok) return spend;
    const { maxJudgeCallsPerDay } = this.opts;
    if (maxJudgeCallsPerDay > 0 && this.judgeCallsToday >= maxJudgeCallsPerDay) {
      return { ok: false, reason: "daily", message: DAILY_LIMIT_MESSAGE, retryAfterSec: secondsToUtcMidnight(t) };
    }
    const rate = this.checkIp(ip, t);
    if (!rate.ok) return rate;
    this.recordIp(ip, t);
    this.judgeCallsToday += 1;
    return { ok: true };
  }

  /** Counters for /health-style diagnostics and tests. */
  stats(): { runsToday: number; judgeCallsToday: number; trackedIps: number; activeRuns: number } {
    this.rollDay(this.now());
    return {
      runsToday: this.runsToday,
      judgeCallsToday: this.judgeCallsToday,
      trackedIps: this.hits.size,
      activeRuns: this.activeRuns(),
    };
  }

  private checkSpend(): GuardResult {
    const r = this.opts.spendGate?.();
    if (!r || r.ok) return { ok: true };
    return { ok: false, reason: "budget", message: r.message, retryAfterSec: r.retryAfterSec };
  }

  private rollDay(t: number): void {
    const day = utcDay(t);
    if (day !== this.day) {
      this.day = day;
      this.runsToday = 0;
      this.judgeCallsToday = 0;
    }
  }

  private recent(ip: string, t: number): number[] {
    const list = (this.hits.get(ip) ?? []).filter((ts) => t - ts < WINDOW_MS);
    if (list.length) this.hits.set(ip, list);
    else this.hits.delete(ip);
    return list;
  }

  private checkIp(ip: string, t: number): GuardResult {
    const limit = this.opts.perIpPerMinute;
    if (limit <= 0) return { ok: true };
    const list = this.recent(ip, t);
    if (list.length >= limit) {
      const retry = Math.max(1, Math.ceil((list[0] + WINDOW_MS - t) / 1000));
      return { ok: false, reason: "rate", message: RATE_LIMIT_MESSAGE, retryAfterSec: retry };
    }
    return { ok: true };
  }

  private recordIp(ip: string, t: number): void {
    if (this.opts.perIpPerMinute <= 0) return;
    if (!this.hits.has(ip) && this.hits.size >= this.maxTrackedIps) this.prune(t);
    const list = this.hits.get(ip) ?? [];
    list.push(t);
    this.hits.set(ip, list);
  }

  private prune(t: number): void {
    for (const [ip, list] of this.hits) {
      if (!list.some((ts) => t - ts < WINDOW_MS)) this.hits.delete(ip);
    }
    // Still full (flood of distinct addresses): forget the oldest half. The global caps
    // still hold, so this only weakens the per-IP layer under attack.
    if (this.hits.size >= this.maxTrackedIps) {
      const drop = Math.ceil(this.hits.size / 2);
      let i = 0;
      for (const ip of this.hits.keys()) {
        if (i++ >= drop) break;
        this.hits.delete(ip);
      }
    }
  }
}

const IP_TOKEN = /^[0-9A-Fa-f:.]{2,45}$/;

function cleanIp(raw: string | undefined | null): string | null {
  const v = (raw ?? "").trim();
  return IP_TOKEN.test(v) ? v.toLowerCase() : null;
}

/**
 * Vercel, when CLIENT_IP_HEADER is not set: its edge sets x-real-ip and
 * x-vercel-forwarded-for itself and overwrites whatever the client sent, so both can be
 * trusted (unlike X-Forwarded-For). Returns the value to use as the trusted header, or
 * undefined when neither holds an address.
 */
export function vercelClientIp(input: {
  realIp?: string | null;
  vercelForwardedFor?: string | null;
}): string | undefined {
  return (
    cleanIp(input.realIp) ??
    cleanIp((input.vercelForwardedFor ?? "").split(",")[0]) ??
    undefined
  );
}

/**
 * Client address for rate limiting.
 *
 * - trustedHeader (e.g. "true-client-ip" on Render, set by its Cloudflare edge, which
 *   overwrites any value the client sends) wins when present and well formed.
 * - Otherwise, with trustedHops = N > 0, X-Forwarded-For's Nth entry from the right (the
 *   address our N trusted proxies saw), never the client-controlled left side.
 * - With 0 (local dev / unknown proxy) X-Forwarded-For is ignored: any client can write it,
 *   and rotating it would give every request a fresh per-IP bucket. The socket address is
 *   used instead (behind an undeclared proxy that is the proxy itself: one shared bucket,
 *   which fails safe).
 */
export function clientIp(input: {
  trustedHeaderValue?: string | null;
  forwardedFor?: string | null;
  remoteAddress?: string | null;
  trustedHops?: number;
}): string {
  const trusted = cleanIp(input.trustedHeaderValue);
  if (trusted) return trusted;
  const hops = Math.max(0, Math.floor(input.trustedHops ?? 0));
  if (hops > 0) {
    const entries = (input.forwardedFor ?? "")
      .split(",")
      .slice(0, 50)
      .map((e) => cleanIp(e))
      .filter((e): e is string => e !== null);
    if (entries.length) return entries[Math.max(0, entries.length - hops)];
  }
  return cleanIp(input.remoteAddress) ?? "unknown";
}
