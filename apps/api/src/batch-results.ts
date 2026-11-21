/**
 * The published batch result: the last `pnpm --filter @sandbox/api batch` run, committed to git
 * (apps/api/results/batch-latest.json) so the deployed app can show it. Raw files with full
 * error text stay in apps/api/data/ (git-ignored).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BatchResults } from "@sandbox/shared";

export const BATCH_RESULTS_PATH =
  process.env.BATCH_RESULTS_PATH?.trim() || resolve(process.cwd(), "results/batch-latest.json");

/** Pure: what goes into the committed file. Per-run error text is dropped (it can echo provider details). */
export function toPublished(results: BatchResults): BatchResults {
  return { ...results, rows: results.rows.map(({ error: _error, ...row }) => row) };
}

/** The published result, or null when no batch has been published yet. Throws on a malformed file. */
export function readBatchResults(path = BATCH_RESULTS_PATH): BatchResults | null {
  if (!existsSync(path)) return null;
  const data: unknown = JSON.parse(readFileSync(path, "utf-8"));
  const r = data as Partial<BatchResults> | null;
  if (!r || typeof r !== "object" || !Array.isArray(r.summary) || !Array.isArray(r.rows)) {
    throw new Error("Invalid batch results file");
  }
  return r as BatchResults;
}
