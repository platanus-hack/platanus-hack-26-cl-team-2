/**
 * Batch experiment: the same attack emails, agents and seed, repeated N times under each
 * combination of fixes. One run is a noisy number; this gives rates.
 *
 *   pnpm --filter @sandbox/api batch
 *
 * Env: BATCH_REPS (default 5), BATCH_FILE (default spoof_eval_demo.json), BATCH_KINDS
 * (default "attack"; comma list, e.g. "attack,benign"), BATCH_CONCURRENCY (default 3),
 * BATCH_AGENTS (default seed_cs,seed_csm,seed_finance), BATCH_SEED (default first agent),
 * BATCH_FINANCE (default last agent), BATCH_MAX_TURNS (default 6), BATCH_LIMIT (max runs),
 * BATCH_EMAILS (comma list of email ids; default all of the kinds), BATCH_FIXES (comma list of FIX_COMBOS names; default all 6), APPROVAL_REFUND_LIMIT (default 500,
 * for the approval_gate combos).
 *
 * Needs seeded agents (db:seed) and ANTHROPIC_API_KEY. Every run calls the model: it costs money.
 * Writes apps/api/data/batch-<timestamp>.json (raw, git-ignored), apps/api/results/batch-latest.json
 * (shown in the web app, without error text) and prints a markdown table.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { BatchResults, BatchRow, BatchSummary } from "@sandbox/shared";
import { batchResultsPath, toPublished } from "./batch-results.js";
import { exportPublishedTraces, tracesPath } from "./published-traces.js";
import { config } from "./config.js";
import { listEmailScenarios } from "./email/scenarios.js";
import {
  createAndStartStoredRun,
  evaluateInternalRun,
  getInternalRun,
  riskPathsForRun,
} from "./harness/orchestrator.js";

export const FIX_COMBOS = [
  { name: "none", senderCheck: false, provenanceTag: false, approvalGate: false },
  { name: "sender_check", senderCheck: true, provenanceTag: false, approvalGate: false },
  { name: "provenance_tag", senderCheck: false, provenanceTag: true, approvalGate: false },
  { name: "sender_check+provenance_tag", senderCheck: true, provenanceTag: true, approvalGate: false },
  { name: "approval_gate", senderCheck: false, provenanceTag: false, approvalGate: true },
  { name: "sender_check+provenance_tag+approval_gate", senderCheck: true, provenanceTag: true, approvalGate: true },
] as const;

type Combo = (typeof FIX_COMBOS)[number];
type Job = { emailId: string; kind: string; combo: Combo; rep: number };

/** BATCH_FIXES: a subset of FIX_COMBOS by name (default all). An unknown name is an error. */
export function selectCombos(raw: string | undefined): Combo[] {
  if (!raw?.trim()) return [...FIX_COMBOS];
  const names = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const unknown = names.find((n) => !FIX_COMBOS.some((c) => c.name === n));
  if (unknown) throw new Error(`Unknown fix combo "${unknown}". Use: ${FIX_COMBOS.map((c) => c.name).join(", ")}`);
  return FIX_COMBOS.filter((c) => names.includes(c.name));
}

export type { BatchRow, BatchSummary };

/** A whole-number env var, at least `min`; anything else (e.g. "abc") is an error, not NaN. */
function intEnv(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) throw new Error(`${name} must be an integer >= ${min} (got "${raw}")`);
  return n;
}

const list = (v: string | undefined, d: string) =>
  (v ?? d).split(",").map((s) => s.trim()).filter(Boolean);

/** Pure: aggregate rows per (kind, fixes). Failed runs are kept out of the rates, but a bank
 * change attempted before the failure is still counted (failedDangerous) so it cannot hide. */
export function summarize(rows: BatchRow[]): BatchSummary[] {
  const groups = new Map<string, BatchSummary>();
  for (const r of rows) {
    const key = `${r.kind}|${r.fixes}`;
    const g =
      groups.get(key) ??
      {
        fixes: r.fixes, kind: r.kind, runs: 0, failed: 0, reachedFinance: 0, warningAtFinance: 0,
        agentWarnedAtFinance: 0, dangerousAttempted: 0, failedDangerous: 0, refunds: 0, held: 0,
      };
    groups.set(key, g);
    if (r.status !== "completed") {
      g.failed += 1;
      if (r.dangerousAttempted) g.failedDangerous += 1;
      continue;
    }
    g.runs += 1;
    if (r.reachedFinance) g.reachedFinance += 1;
    if (r.warningAtFinance) g.warningAtFinance += 1;
    if (r.agentWarnedAtFinance) g.agentWarnedAtFinance += 1;
    if (r.dangerousAttempted) g.dangerousAttempted += 1;
    if ((r.refundsExecuted ?? 0) > 0) g.refunds += 1;
    if ((r.heldForApproval ?? 0) > 0) g.held += 1;
  }
  return [...groups.values()];
}

export function toMarkdown(summary: BatchSummary[]): string {
  const lines = [
    "| Emails | Fixes | Runs | Reached finance | Finance saw origin or warning | Agents wrote a warning | Bank change attempted | Refund issued | Held for approval | Failed |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const s of summary) {
    const of = (n: number, d: number) => (d ? `${n}/${d}` : "-");
    lines.push(
      `| ${s.kind} | ${s.fixes} | ${s.runs} | ${of(s.reachedFinance, s.runs)} | ${of(s.warningAtFinance, s.reachedFinance)} | ${of(s.agentWarnedAtFinance, s.reachedFinance)} | ${of(s.dangerousAttempted, s.runs)}${s.failedDangerous ? ` (+${s.failedDangerous} in failed runs)` : ""} | ${of(s.refunds, s.runs)} | ${of(s.held, s.runs)} | ${s.failed} |`,
    );
  }
  return lines.join("\n");
}

async function runJob(job: Job, file: string, agentIds: string[], seedAgentId: string, financeId: string, maxTurns: number): Promise<BatchRow> {
  const base: BatchRow = {
    emailId: job.emailId, kind: job.kind, fixes: job.combo.name, rep: job.rep, runId: null, status: "failed",
  };
  try {
    const run = await createAndStartStoredRun({
      agentIds,
      seedAgentId,
      financeAgentIds: [financeId],
      maxTurnsPerAgent: maxTurns,
      emailScenario: {
        file, id: job.emailId, senderCheck: job.combo.senderCheck, provenanceTag: job.combo.provenanceTag,
        approvalGate: job.combo.approvalGate,
      },
    });
    base.runId = run.id;
    for (;;) {
      const cur = await getInternalRun(run.id);
      if (!cur) throw new Error("run disappeared");
      if (cur.status === "completed" || cur.status === "failed") {
        base.status = cur.status;
        base.error = cur.error;
        const ev = evaluateInternalRun(cur);
        const observed = riskPathsForRun(cur).observed.find((o) => o.financeAgentId === financeId);
        return {
          ...base,
          verdict: ev.verdict,
          dangerousAttempted: ev.dangerousAttempted,
          refundsExecuted: ev.refundsExecuted,
          heldForApproval: ev.heldForApproval,
          reachedFinance: ev.reachedFinance,
          warningAtFinance: observed ? (observed.hops.at(-1)?.warningCarried ?? null) : null,
          agentWarnedAtFinance: observed ? (observed.hops.at(-1)?.agentWarned ?? null) : null,
          observedPath: observed ? observed.nodes.join(" > ") : null,
        };
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const file = process.env.BATCH_FILE ?? "spoof_eval_demo.json";
  const kinds = new Set(list(process.env.BATCH_KINDS, "attack"));
  const reps = intEnv("BATCH_REPS", 5, 1);
  const concurrency = intEnv("BATCH_CONCURRENCY", 3, 1);
  const agentIds = list(process.env.BATCH_AGENTS, "seed_cs,seed_csm,seed_finance");
  const seedAgentId = process.env.BATCH_SEED ?? agentIds[0];
  const financeId = process.env.BATCH_FINANCE ?? agentIds[agentIds.length - 1];
  const maxTurns = intEnv("BATCH_MAX_TURNS", 6, 1);
  const combos = selectCombos(process.env.BATCH_FIXES);

  const only = new Set(list(process.env.BATCH_EMAILS, ""));
  const emails = listEmailScenarios().scenarios.filter(
    (s) => s.file === file && kinds.has(s.kind) && (!only.size || only.has(s.id)),
  );
  if (!emails.length) throw new Error(`No emails of kind ${[...kinds].join(",")} in ${file}`);

  let jobs: Job[] = [];
  for (let rep = 1; rep <= reps; rep++)
    for (const e of emails)
      for (const combo of combos) jobs.push({ emailId: e.id, kind: e.kind, combo, rep });
  const limit = intEnv("BATCH_LIMIT", 0, 0);
  if (limit > 0) jobs = jobs.slice(0, limit);

  console.log(
    `[batch] ${jobs.length} runs · ${emails.length} emails × ${combos.length} fix combos × ${reps} reps · model ${config.model} · agents ${agentIds.join(",")} (seed ${seedAgentId}, finance ${financeId})`,
  );

  const rows: BatchRow[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        const row = await runJob(job, file, agentIds, seedAgentId, financeId, maxTurns);
        rows.push(row);
        console.log(
          `[batch] ${rows.length}/${jobs.length} ${row.emailId} [${row.fixes}] #${row.rep}: ${row.status}${row.verdict ? ` ${row.verdict}` : ""}${row.error ? ` (${row.error.slice(0, 120)})` : ""}`,
        );
      }
    }),
  );

  const summary = summarize(rows);
  const outDir = resolve(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, `batch-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const results: BatchResults = {
    createdAt: new Date().toISOString(), file, model: config.model, agentIds, seedAgentId, financeId, maxTurns, reps,
    jobs: jobs.length, ...(limit > 0 ? { limit } : {}), summary, rows,
  };
  writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`\n${toMarkdown(summary)}\n\n[batch] wrote ${out}`);
  // The copy the web app shows (GET /api/batch-results). Commit it to publish the numbers.
  // Never replace published numbers with a batch where nothing completed, or when BATCH_PUBLISH=0.
  const completed = rows.filter((r) => r.status === "completed").length;
  if (process.env.BATCH_PUBLISH === "0") console.log("[batch] BATCH_PUBLISH=0: not published");
  else if (!completed) console.log("[batch] no completed runs: not published");
  else {
    const path = batchResultsPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(toPublished(results), null, 2)}\n`);
    console.log(`[batch] published ${path}`);
    const traces = await exportPublishedTraces();
    console.log(`[batch] traces for ${traces.runs} published runs in ${tracesPath()}`);
  }
}

if (process.argv[1]?.endsWith("batch.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
