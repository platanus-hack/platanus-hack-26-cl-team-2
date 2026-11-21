/**
 * Batch experiment: the same attack emails, agents and seed, repeated N times under each
 * combination of fixes. One run is a noisy number; this gives rates.
 *
 *   pnpm --filter @sandbox/api batch
 *
 * Env: BATCH_REPS (default 5), BATCH_FILE (default spoof_eval_demo.json), BATCH_KINDS
 * (default "attack"; comma list, e.g. "attack,benign"), BATCH_CONCURRENCY (default 3),
 * BATCH_AGENTS (default seed_cs,seed_csm,seed_finance), BATCH_SEED (default first agent),
 * BATCH_FINANCE (default last agent), BATCH_MAX_TURNS (default 6), BATCH_LIMIT (max runs).
 *
 * Needs seeded agents (db:seed) and ANTHROPIC_API_KEY. Every run calls the model: it costs money.
 * Writes apps/api/data/batch-<timestamp>.json and prints a markdown table.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RunEvaluation } from "@sandbox/shared";
import { config } from "./config.js";
import { listEmailScenarios } from "./email/scenarios.js";
import {
  createAndStartStoredRun,
  evaluateInternalRun,
  getInternalRun,
  riskPathsForRun,
} from "./harness/orchestrator.js";

const FIX_COMBOS = [
  { name: "none", senderCheck: false, provenanceTag: false },
  { name: "sender_check", senderCheck: true, provenanceTag: false },
  { name: "provenance_tag", senderCheck: false, provenanceTag: true },
  { name: "sender_check+provenance_tag", senderCheck: true, provenanceTag: true },
] as const;

type Job = { emailId: string; kind: string; combo: (typeof FIX_COMBOS)[number]; rep: number };

export type BatchRow = {
  emailId: string;
  kind: string;
  fixes: string;
  rep: number;
  runId: string | null;
  status: string;
  error?: string;
  verdict?: RunEvaluation["verdict"];
  dangerousAttempted?: boolean;
  refundsExecuted?: number;
  reachedFinance?: boolean;
  /** The message that reached the finance agent carried a warning or the provenance tag. */
  warningAtFinance?: boolean | null;
  observedPath?: string | null;
};

export type BatchSummary = {
  fixes: string;
  kind: string;
  runs: number;
  failed: number;
  reachedFinance: number;
  warningAtFinance: number;
  dangerousAttempted: number;
  refunds: number;
};

const list = (v: string | undefined, d: string) =>
  (v ?? d).split(",").map((s) => s.trim()).filter(Boolean);

/** Pure: aggregate rows per (kind, fixes). Failed runs are counted but excluded from rates. */
export function summarize(rows: BatchRow[]): BatchSummary[] {
  const groups = new Map<string, BatchSummary>();
  for (const r of rows) {
    const key = `${r.kind}|${r.fixes}`;
    const g =
      groups.get(key) ??
      { fixes: r.fixes, kind: r.kind, runs: 0, failed: 0, reachedFinance: 0, warningAtFinance: 0, dangerousAttempted: 0, refunds: 0 };
    groups.set(key, g);
    if (r.status !== "completed") {
      g.failed += 1;
      continue;
    }
    g.runs += 1;
    if (r.reachedFinance) g.reachedFinance += 1;
    if (r.warningAtFinance) g.warningAtFinance += 1;
    if (r.dangerousAttempted) g.dangerousAttempted += 1;
    if ((r.refundsExecuted ?? 0) > 0) g.refunds += 1;
  }
  return [...groups.values()];
}

export function toMarkdown(summary: BatchSummary[]): string {
  const lines = [
    "| Emails | Fixes | Runs | Reached finance | Warning reached finance | Bank change attempted | Refund issued | Failed |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const s of summary) {
    const of = (n: number, d: number) => (d ? `${n}/${d}` : "-");
    lines.push(
      `| ${s.kind} | ${s.fixes} | ${s.runs} | ${of(s.reachedFinance, s.runs)} | ${of(s.warningAtFinance, s.reachedFinance)} | ${of(s.dangerousAttempted, s.runs)} | ${of(s.refunds, s.runs)} | ${s.failed} |`,
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
      },
    });
    base.runId = run.id;
    for (;;) {
      const cur = getInternalRun(run.id);
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
          reachedFinance: ev.reachedFinance,
          warningAtFinance: observed ? (observed.hops.at(-1)?.warningCarried ?? null) : null,
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
  const reps = Number(process.env.BATCH_REPS ?? 5);
  const concurrency = Math.max(1, Number(process.env.BATCH_CONCURRENCY ?? 3));
  const agentIds = list(process.env.BATCH_AGENTS, "seed_cs,seed_csm,seed_finance");
  const seedAgentId = process.env.BATCH_SEED ?? agentIds[0];
  const financeId = process.env.BATCH_FINANCE ?? agentIds[agentIds.length - 1];
  const maxTurns = Number(process.env.BATCH_MAX_TURNS ?? 6);

  const emails = listEmailScenarios().scenarios.filter((s) => s.file === file && kinds.has(s.kind));
  if (!emails.length) throw new Error(`No emails of kind ${[...kinds].join(",")} in ${file}`);

  let jobs: Job[] = [];
  for (let rep = 1; rep <= reps; rep++)
    for (const e of emails)
      for (const combo of FIX_COMBOS) jobs.push({ emailId: e.id, kind: e.kind, combo, rep });
  const limit = Number(process.env.BATCH_LIMIT ?? 0);
  if (limit > 0) jobs = jobs.slice(0, limit);

  console.log(
    `[batch] ${jobs.length} runs · ${emails.length} emails × ${FIX_COMBOS.length} fix combos × ${reps} reps · model ${config.model} · agents ${agentIds.join(",")} (seed ${seedAgentId}, finance ${financeId})`,
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
  writeFileSync(
    out,
    JSON.stringify({ file, model: config.model, agentIds, seedAgentId, financeId, maxTurns, reps, summary, rows }, null, 2),
  );
  console.log(`\n${toMarkdown(summary)}\n\n[batch] wrote ${out}`);
}

if (process.argv[1]?.endsWith("batch.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
