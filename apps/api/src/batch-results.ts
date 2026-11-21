/**
 * The published batch result: the last `pnpm --filter @sandbox/api batch` run, committed to git
 * (apps/api/results/batch-latest.json) so the deployed app can show it. Raw files with full
 * error text stay in apps/api/data/ (git-ignored).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BatchResults, BatchRow, BatchSummary } from "@sandbox/shared";

/** Read lazily, so a BATCH_RESULTS_PATH loaded from .env (by config.ts) is honoured. */
export function batchResultsPath(): string {
  return process.env.BATCH_RESULTS_PATH?.trim() || resolve(process.cwd(), "results/batch-latest.json");
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
      failedDangerous: num(s.failedDangerous), refunds: num(s.refunds),
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

/** The published result, or null when no batch has been published yet. Throws on a malformed file. */
export function readBatchResults(path = batchResultsPath()): BatchResults | null {
  if (!existsSync(path)) return null;
  return normalizeBatchResults(JSON.parse(readFileSync(path, "utf-8")));
}
