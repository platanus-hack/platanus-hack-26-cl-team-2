/**
 * Traces of the runs behind the published batch results, committed next to them
 * (results/traces.json), so the web app can replay any published run on a machine whose local
 * database never ran it: GET /api/runs/:id falls back to this file when the run isn't stored.
 *
 *   pnpm --filter @sandbox/api results:traces     (also refreshed by every published batch)
 *
 * Provider error text is dropped, as in the published batch rows.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { TraceEvent } from "@sandbox/shared";
import { BATCH_RESULT_SETS, batchResultSetPath, batchResultsPath, readBatchResults } from "./batch-results.js";
import { loadRun } from "./db/runs-repo.js";
import type { InternalRun } from "./harness/orchestrator.js";

type Stored = { run: InternalRun; events: TraceEvent[] };

export function tracesPath(): string {
  return resolve(dirname(batchResultsPath()), "traces.json");
}

/** Pure: a stored run as it goes into the committed file (no provider error text). */
export function toPublishedTrace({ run, events }: Stored): Stored {
  const { error: _error, ...rest } = run;
  return {
    run: rest as InternalRun,
    events: events.map((e) => (e.type === "run.failed" ? { ...e, payload: {} } : e)),
  };
}

let cache: { path: string; mtime: number; runs: Record<string, Stored> } | null = null;

/** A published run by id, or undefined. Re-reads the file only when it changed. */
export function loadPublishedRun(id: string): Stored | undefined {
  const path = tracesPath();
  if (!existsSync(path)) return undefined;
  try {
    const mtime = statSync(path).mtimeMs;
    if (!cache || cache.path !== path || cache.mtime !== mtime) {
      cache = { path, mtime, runs: JSON.parse(readFileSync(path, "utf-8")) as Record<string, Stored> };
    }
    return Object.hasOwn(cache.runs, id) ? cache.runs[id] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes results/traces.json with every run referenced by a published result set, taken from the
 * local database. Runs missing locally keep the copy already in the file. Returns counts.
 */
export async function exportPublishedTraces(): Promise<{ runs: number; missing: string[] }> {
  const previous: Record<string, Stored> = existsSync(tracesPath())
    ? (JSON.parse(readFileSync(tracesPath(), "utf-8")) as Record<string, Stored>)
    : {};
  const out: Record<string, Stored> = {};
  const missing: string[] = [];
  for (const set of BATCH_RESULT_SETS) {
    const results = readBatchResults(batchResultSetPath(set));
    for (const row of results?.rows ?? []) {
      if (!row.runId || out[row.runId]) continue;
      const stored = await loadRun(row.runId);
      if (stored) out[row.runId] = toPublishedTrace(stored);
      else if (previous[row.runId]) out[row.runId] = previous[row.runId];
      else missing.push(row.runId);
    }
  }
  writeFileSync(tracesPath(), `${JSON.stringify(out)}\n`);
  return { runs: Object.keys(out).length, missing };
}

if (process.argv[1]?.endsWith("published-traces.ts")) {
  exportPublishedTraces()
    .then(({ runs, missing }) => {
      console.log(`[traces] wrote ${tracesPath()}: ${runs} runs`);
      if (missing.length) console.log(`[traces] not in this database, left out: ${missing.join(", ")}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
