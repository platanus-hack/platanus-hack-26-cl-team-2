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

const databaseUrl = resolveDatabaseUrl();
const dbDriver = resolveDriver(databaseUrl);

export const config = {
  port: Number(process.env.PORT ?? 8787),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  anthropicApiKey: normalizeApiKey(process.env.ANTHROPIC_API_KEY),
  model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
  maxTurnsPerAgent: Number(process.env.MAX_TURNS_PER_AGENT ?? 12),
  databaseUrl,
  dbDriver,
  sqlitePath: dbDriver === "sqlite" ? sqlitePathFromUrl(databaseUrl) : "",
};

export function assertApiKeyConfigured(): void {
  if (!config.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY missing. Copy .env.example to .env and paste your key.",
    );
  }
}
