/**
 * The published batch result: the last `pnpm --filter @sandbox/api batch` run, committed to git
 * (apps/api/results/batch-latest.json) so the deployed app can show it. Raw files with full
 * error text stay in apps/api/data/ (git-ignored).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BatchResults, BatchRow, BatchSummary } from "@sandbox/shared";

/** apps/api/results, resolved from this file rather than process.cwd(): Render runs from apps/api,
 * but Vercel runs the function from the repo root. */
const RESULTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../results");

/** Read lazily, so a BATCH_RESULTS_PATH loaded from .env (by config.ts) is honoured. */
export function batchResultsPath(): string {
  return process.env.BATCH_RESULTS_PATH?.trim() || resolve(RESULTS_DIR, "batch-latest.json");
}

/** Pure: what goes into the committed file. Per-run error text is dropped (it can echo provider details). */
export function toPublished(results: BatchResults): BatchResults {
  return { ...results, rows: results.rows.map(({ error: _error, ...row }) => row) };
}

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Pure: coerce a parsed file into the shape the web app relies on (older files lack some fields). */
export function normalizeBatchResults(data: unknown): BatchResults {
  const r = obj(data);
  if (!r || !Array.isArray(r.summary) || !Array.isArray(r.rows)) throw new Error("Invalid batch results file");
  const summary: BatchSummary[] = r.summary.flatMap((x) => {
    const s = obj(x);
    if (!s || typeof s.kind !== "string" || typeof s.fixes !== "string") return [];
    return [{
      kind: s.kind, fixes: s.fixes, runs: num(s.runs), failed: num(s.failed),
      reachedFinance: num(s.reachedFinance), warningAtFinance: num(s.warningAtFinance),
      agentWarnedAtFinance: num(s.agentWarnedAtFinance), dangerousAttempted: num(s.dangerousAttempted),
      failedDangerous: num(s.failedDangerous), refunds: num(s.refunds), held: num(s.held),
    }];
  });
  const rows: BatchRow[] = r.rows.flatMap((x) => {
    const row = obj(x);
    if (!row || typeof row.emailId !== "string" || typeof row.fixes !== "string") return [];
    return [{ ...(row as BatchRow), kind: str(row.kind, "attack"), rep: num(row.rep), status: str(row.status, "failed") }];
  });
  return {
    createdAt: str(r.createdAt),
    file: str(r.file, "?"),
    model: str(r.model, "?"),
    agentIds: Array.isArray(r.agentIds) ? r.agentIds.filter((a): a is string => typeof a === "string") : [],
    seedAgentId: str(r.seedAgentId, "?"),
    financeId: str(r.financeId, "?"),
    maxTurns: num(r.maxTurns),
    reps: num(r.reps),
    ...(typeof r.jobs === "number" ? { jobs: r.jobs } : {}),
    ...(typeof r.limit === "number" ? { limit: r.limit } : {}),
    summary,
    rows,
  };
}

/**
 * Published result sets the web app can ask for (GET /api/batch-results?set=…). "latest" is the
 * last `batch` run; the others are named files next to it, e.g. the business-fraud evals
 * (email-harness/scenarios/redteam_business.json) in results/batch-business.json.
 */
export const BATCH_RESULT_SETS = ["latest", "business", "org20"] as const;
export type BatchResultSet = (typeof BATCH_RESULT_SETS)[number];

export function isBatchResultSet(value: string): value is BatchResultSet {
  return (BATCH_RESULT_SETS as readonly string[]).includes(value);
}

export function batchResultSetPath(set: BatchResultSet): string {
  const latest = batchResultsPath();
  return set === "latest" ? latest : resolve(dirname(latest), `batch-${set}.json`);
}

/** The published result, or null when no batch has been published yet. Throws on a malformed file. */
export function readBatchResults(path = batchResultsPath()): BatchResults | null {
  if (!existsSync(path)) return null;
  return normalizeBatchResults(JSON.parse(readFileSync(path, "utf-8")));
}
