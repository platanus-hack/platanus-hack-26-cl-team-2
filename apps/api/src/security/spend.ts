/**
 * Daily spend cap in US dollars, measured from the `usage` every model response reports.
 *
 * The demo guard counts requests (runs, judge calls), but a request's cost is unbounded by
 * that count: a run with 8 agents that never call `done` costs ~50x a 2-agent run that ends
 * fast, and a 200k-character transcript costs ~1000x a profile refine. This meter counts
 * what was actually spent and refuses new model calls once the day's budget is gone, so the
 * worst case is bounded in money, whatever the request mix or how many IPs send it.
 *
 * In memory, one process: a restart or redeploy resets it (like the demo guard), so the
 * real ceiling is MAX_SPEND_USD_PER_DAY per process start. Off by default; the HTTP server
 * turns it on (index.ts), CLI scripts (batch, MCP quick test) are deliberate spend.
 */

export const SPEND_LIMIT_MESSAGE = "Presupuesto diario de la demo agotado, intenta mañana.";

/** The subset of Messages API `usage` we price. Nullable like the SDK type. */
export type TokenUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

type Price = { input: number; output: number };

/**
 * US$ per million tokens (Anthropic first-party rates). Anything not listed, older Opus 4 /
 * 4.1 included, gets a high price so the meter over-counts rather than under-counts.
 */
const PRICES: Array<[RegExp, Price]> = [
  [/haiku-4/, { input: 1, output: 5 }],
  [/sonnet-4/, { input: 3, output: 15 }],
  [/opus-4-[5-8]/, { input: 5, output: 25 }],
];
const UNKNOWN_MODEL_PRICE: Price = { input: 15, output: 75 };
const CACHE_WRITE_FACTOR = 1.25;
const CACHE_READ_FACTOR = 0.1;

export function priceFor(model: string): Price {
  for (const [re, price] of PRICES) if (re.test(model)) return price;
  return UNKNOWN_MODEL_PRICE;
}

const n = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;

/** Pure: cost in US$ of one response. */
export function costUsd(model: string, usage: TokenUsage | null | undefined): number {
  if (!usage) return 0;
  const p = priceFor(model);
  const inputEquivalent =
    n(usage.input_tokens) +
    n(usage.cache_creation_input_tokens) * CACHE_WRITE_FACTOR +
    n(usage.cache_read_input_tokens) * CACHE_READ_FACTOR;
  return (inputEquivalent * p.input + n(usage.output_tokens) * p.output) / 1_000_000;
}

export type SpendCheck = { ok: true } | { ok: false; message: string; retryAfterSec: number };

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function secondsToUtcMidnight(ms: number): number {
  const d = new Date(ms);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - ms) / 1000));
}

export class SpendMeter {
  private day = "";
  private spentUsd = 0;
  private calls = 0;
  private limitUsd: number;
  private readonly now: () => number;

  /** limitUsd <= 0 disables the cap (spend is still counted). */
  constructor(opts: { limitUsd?: number; now?: () => number } = {}) {
    this.limitUsd = opts.limitUsd ?? 0;
    this.now = opts.now ?? Date.now;
  }

  setLimit(limitUsd: number): void {
    this.limitUsd = Number.isFinite(limitUsd) ? limitUsd : 0;
  }

  /**
   * Before a model call. Calls already in flight when the budget runs out still finish, so
   * the day can overshoot by the cost of those calls (a few concurrent runs' worth of one turn).
   */
  check(): SpendCheck {
    const t = this.now();
    this.rollDay(t);
    if (this.limitUsd > 0 && this.spentUsd >= this.limitUsd) {
      return { ok: false, message: SPEND_LIMIT_MESSAGE, retryAfterSec: secondsToUtcMidnight(t) };
    }
    return { ok: true };
  }

  record(model: string, usage: TokenUsage | null | undefined): void {
    this.rollDay(this.now());
    this.spentUsd += costUsd(model, usage);
    this.calls += 1;
  }

  stats(): { day: string; spentUsd: number; limitUsd: number; calls: number } {
    this.rollDay(this.now());
    return { day: this.day, spentUsd: this.spentUsd, limitUsd: this.limitUsd, calls: this.calls };
  }

  private rollDay(t: number): void {
    const day = utcDay(t);
    if (day !== this.day) {
      this.day = day;
      this.spentUsd = 0;
      this.calls = 0;
    }
  }
}

/** Thrown instead of calling the model when the day's budget is spent. */
export class SpendLimitError extends Error {
  constructor(message = SPEND_LIMIT_MESSAGE) {
    super(message);
    this.name = "SpendLimitError";
  }
}

/** HTTP status for a failed model call: 429 out of budget, 503 no key, 502 provider error. */
export function modelErrorStatus(err: unknown, message: string): 429 | 502 | 503 {
  if (err instanceof SpendLimitError) return 429;
  return message.includes("ANTHROPIC_API_KEY") ? 503 : 502;
}

/** Process-wide meter used by anthropicClient(). Disabled until the server sets a limit. */
export const spendMeter = new SpendMeter();
