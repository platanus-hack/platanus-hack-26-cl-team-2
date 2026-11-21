/**
 * Bias on vs off experiment (roadmap step 1, "done when"): the same agents and email, N runs
 * with the communication bias in the prompts and N without, interleaved (on, off, on, off…).
 *
 *   pnpm --filter @sandbox/api comm-bias-batch
 *
 * The weights are read once at the start and frozen: these runs are NOT added to them
 * (skipCommRecording), so one run cannot change the next run's prompts.
 *
 * Env: BIAS_AGENTS (comma ids; default Camila, Tomas, Mateo, IT 10), BIAS_SEED (default first),
 * BIAS_FINANCE (comma ids; default second and third), BIAS_FILE (default bec_realistic.json),
 * BIAS_EMAIL (default bec_01_lookalike_reply_thread), BIAS_REPS (default 5), BIAS_MAX_TURNS
 * (default 6), BIAS_CONCURRENCY (default 2).
 *
 * Every run calls the model: it costs money. Like batch.ts, no daily spend cap (deliberate spend).
 * Writes apps/api/data/comm-bias-<timestamp>.json and prints a markdown table.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "./config.js";
import { getCommGraph } from "./db/comm-repo.js";
import { loadRun } from "./db/runs-repo.js";
import {
  biasMarkdown,
  habitsFrom,
  runMessages,
  summarizeBias,
  topContact,
  type BiasRow,
} from "./harness/comm-bias-compare.js";
import { createAndStartStoredRun, evaluateInternalRun, getInternalRun } from "./harness/orchestrator.js";

const list = (v: string | undefined, d: string) =>
  (v ?? d).split(",").map((s) => s.trim()).filter(Boolean);

function intEnv(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) throw new Error(`${name} must be an integer >= ${min} (got "${raw}")`);
  return n;
}

async function runOne(
  bias: "on" | "off",
  rep: number,
  base: { agentIds: string[]; seedAgentId: string; financeIds: string[]; file: string; emailId: string; maxTurns: number },
): Promise<BiasRow> {
  const row: BiasRow = { bias, rep, runId: null, status: "failed" };
  try {
    const run = await createAndStartStoredRun({
      agentIds: base.agentIds,
      seedAgentId: base.seedAgentId,
      financeAgentIds: base.financeIds,
      maxTurnsPerAgent: base.maxTurns,
      emailScenario: { file: base.file, id: base.emailId },
      commBias: bias === "on",
      skipCommRecording: true,
    });
    row.runId = run.id;
    for (;;) {
      const cur = await getInternalRun(run.id);
      if (!cur) throw new Error("run disappeared");
      if (cur.status === "completed" || cur.status === "failed") {
        const stored = await loadRun(run.id);
        const events = stored?.events ?? [];
        const ev = evaluateInternalRun(cur, events);
        return {
          ...row,
          status: cur.status,
          ...(cur.error ? { error: cur.error } : {}),
          messages: runMessages(events),
          reachedFinance: ev.reachedFinance,
          dangerousAttempted: ev.dangerousAttempted,
        };
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (err) {
    return { ...row, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const agentIds = list(process.env.BIAS_AGENTS, "prof_t3u8ocb3,prof_zj0cw5zc,prof_5dpwg6d1,prof_cc099aei");
  const seedAgentId = process.env.BIAS_SEED ?? agentIds[0];
  const financeIds = list(process.env.BIAS_FINANCE, agentIds.slice(1, 3).join(","));
  const file = process.env.BIAS_FILE ?? "bec_realistic.json";
  const emailId = process.env.BIAS_EMAIL ?? "bec_01_lookalike_reply_thread";
  const reps = intEnv("BIAS_REPS", 5, 1);
  const maxTurns = intEnv("BIAS_MAX_TURNS", 6, 1);
  const concurrency = intEnv("BIAS_CONCURRENCY", 2, 1);

  // Frozen for the whole experiment.
  const graph = await getCommGraph();
  const habits = habitsFrom(graph.edges, agentIds);
  if (!habits.size) throw new Error("These agents have no past messages between them: nothing for the bias to use.");
  console.log(`[bias] model ${config.model} · ${reps} on + ${reps} off · agents ${agentIds.join(",")} (seed ${seedAgentId}, finance ${financeIds.join(",")}) · ${file}/${emailId}`);
  for (const id of agentIds) {
    const top = topContact(habits, id);
    console.log(`[bias] usual contacts of ${id}: ${top ? [...habits.get(id)!.entries()].map(([to, n]) => `${to}=${n}`).join(", ") : "none"}`);
  }

  const jobs: Array<{ bias: "on" | "off"; rep: number }> = [];
  for (let rep = 1; rep <= reps; rep++) jobs.push({ bias: "on", rep }, { bias: "off", rep });

  const base = { agentIds, seedAgentId, financeIds, file, emailId, maxTurns };
  const rows: BiasRow[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        const row = await runOne(job.bias, job.rep, base);
        rows.push(row);
        const sent = row.messages?.pairs.reduce((s, p) => s + p.messages, 0) ?? 0;
        console.log(`[bias] ${rows.length}/${jobs.length} bias ${row.bias} #${row.rep}: ${row.status} · ${sent} messages${row.error ? ` (${row.error.slice(0, 120)})` : ""}`);
      }
    }),
  );

  const summary = summarizeBias(rows, habits, { seedId: seedAgentId, financeIds });
  const outDir = resolve(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, `comm-bias-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(
    out,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        model: config.model,
        agentIds,
        seedAgentId,
        financeIds,
        file,
        emailId,
        reps,
        maxTurns,
        habits: Object.fromEntries([...habits].map(([from, row]) => [from, Object.fromEntries(row)])),
        summary,
        rows,
      },
      null,
      2,
    ),
  );
  console.log(`\n${biasMarkdown(summary)}\n\n[bias] wrote ${out}`);
}

if (process.argv[1]?.endsWith("comm-bias-batch.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
