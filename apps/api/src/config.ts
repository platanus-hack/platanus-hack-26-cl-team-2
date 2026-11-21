import { config as loadEnv } from "dotenv";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv();

function normalizeApiKey(raw: string | undefined): string {
  const key = (raw ?? "").trim();
  if (!key) return "";
  if (key === "sk-ant-..." || key.endsWith("...")) return "";
  return key;
}

function defaultSqliteUrl(): string {
  const path = resolve(process.cwd(), "data/sandbox.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  return `file:${path}`;
}

function resolveDatabaseUrl(): string {
  const raw = (process.env.DATABASE_URL ?? "").trim();
  if (!raw && process.env.VERCEL) throw new Error("DATABASE_URL debe configurarse con Postgres en Vercel.");
  if (!raw) return defaultSqliteUrl();
  if (process.env.VERCEL && !/^postgres(ql)?:\/\//.test(raw)) throw new Error("Vercel requiere una conexión Postgres, no SQLite.");
  return raw;
}

export type DbDriver = "postgres" | "sqlite";

function resolveDriver(url: string): DbDriver {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgres";
  }
  return "sqlite";
}

function sqlitePathFromUrl(url: string): string {
  if (url.startsWith("file:")) {
    const rest = url.slice("file:".length);
    return rest.startsWith("/") || /^[A-Za-z]:/.test(rest)
      ? rest
      : resolve(process.cwd(), rest);
  }
  return resolve(process.cwd(), url || "data/sandbox.sqlite");
}

/** Non-negative integer env var; 0 disables the limit it controls. */
function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** Non-negative number env var (decimals allowed, e.g. dollars); 0 disables the limit. */
function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function flagEnv(name: string): boolean {
  return ["1", "true", "yes"].includes((process.env[name] ?? "").trim().toLowerCase());
}

const databaseUrl = resolveDatabaseUrl();
const dbDriver = resolveDriver(databaseUrl);

export const config = {
  port: Number(process.env.PORT ?? 8787),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  anthropicApiKey: normalizeApiKey(process.env.ANTHROPIC_API_KEY),
  /** Hackathon proxy (or any gateway). Every model call goes through anthropicClient(). */
  anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL?.trim() || undefined,
  model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
  /** Default AND ceiling: a request may ask for fewer turns, never more. */
  maxTurnsPerAgent: Math.max(1, intEnv("MAX_TURNS_PER_AGENT", 12)),
  // --- public-demo guard (see security/demo-guard.ts); 0 disables a limit ---
  rateLimitPerMinute: intEnv("RATE_LIMIT_PER_MINUTE", 3),
  maxRunsPerDay: intEnv("MAX_RUNS_PER_DAY", 40),
  maxConcurrentRuns: intEnv("MAX_CONCURRENT_RUNS", 3),
  maxJudgeCallsPerDay: intEnv("MAX_JUDGE_CALLS_PER_DAY", 200),
  /**
   * US$ the server may spend per UTC day, measured from response usage (security/spend.ts).
   * The hard money ceiling behind the request counters above; 0 disables it.
   */
  maxSpendUsdPerDay: numEnv("MAX_SPEND_USD_PER_DAY", 5),
  /** Finished runs kept in memory (oldest evicted first). */
  maxStoredRuns: Math.max(1, intEnv("MAX_STORED_RUNS", 200)),
  /** Total saved agents; enterprise generate refuses to go past it. */
  maxStoredAgents: intEnv("MAX_STORED_AGENTS", 2000),
  /**
   * Header holding the real client IP. On Render (RENDER=true) its Cloudflare edge sets
   * True-Client-IP and overwrites client values; X-Forwarded-For keeps spoofed entries.
   */
  clientIpHeader:
    process.env.CLIENT_IP_HEADER?.trim().toLowerCase() ||
    (process.env.RENDER ? "true-client-ip" : ""),
  /** Proxies that append to X-Forwarded-For; 0 = ignore it and use the socket address. */
  trustProxyHops: intEnv("TRUST_PROXY_HOPS", 0),
  /** When set, writes (agents, context files, saved profiles, persisted fleets) need x-admin-token. */
  adminToken: process.env.ADMIN_TOKEN?.trim() || undefined,
  /**
   * Deployed (RENDER) or REQUIRE_ADMIN_TOKEN=1: a missing ADMIN_TOKEN blocks writes instead of
   * opening them, so a forgotten dashboard variable cannot leave the public store writable.
   */
  adminFailClosed: Boolean(process.env.RENDER?.trim()) || flagEnv("REQUIRE_ADMIN_TOKEN"),
  /** Git-ignored real-mailbox scenario files are hidden from the HTTP API unless this is set. */
  allowRealEmailFiles: flagEnv("ALLOW_REAL_EMAIL_FILES"),
  databaseUrl,
  dbDriver,
  sqlitePath: dbDriver === "sqlite" ? sqlitePathFromUrl(databaseUrl) : "",
};

export function assertApiKeyConfigured(): void {
  if (!config.anthropicApiKey) {
    throw new Error(
      "Falta ANTHROPIC_API_KEY. Copia .env.example a .env y pega tu key.",
    );
  }
}
