/** Per-run message counts between agents, and their totals across runs. */
import { countDistinct, eq, max, sum } from "drizzle-orm";
import type { CommGraph, TraceEvent } from "@sandbox/shared";
import { buildCommGraph, countRunMessages, type PairTotal } from "../harness/comm-graph.js";
import { listAgents } from "./agents-repo.js";
import { getDbDriver, getPgDb, getSqliteDb } from "./client.js";
import { loadRun, loadRuns } from "./runs-repo.js";
import { commObservations } from "./schema.pg.js";
import { commObservationsSqlite } from "./schema.sqlite.js";

/** Replace one run's rows with what its trace shows (idempotent: counting twice never doubles). */
export async function recordRunComms(runId: string, events: TraceEvent[], observedAt = new Date()): Promise<number> {
  const rows = countRunMessages(events).map((c) => ({
    runId,
    fromAgentId: c.from,
    toAgentId: c.to,
    messageCount: c.messages,
    observedAt,
  }));
  if (getDbDriver() === "sqlite") {
    getSqliteDb().transaction((tx) => {
      tx.delete(commObservationsSqlite).where(eq(commObservationsSqlite.runId, runId)).run();
      if (rows.length) tx.insert(commObservationsSqlite).values(rows).run();
    });
  } else {
    await getPgDb().transaction(async (tx) => {
      await tx.delete(commObservations).where(eq(commObservations.runId, runId));
      if (rows.length) await tx.insert(commObservations).values(rows);
    });
  }
  return rows.length;
}

async function pairTotals(): Promise<{ totals: PairTotal[]; runs: number }> {
  if (getDbDriver() === "sqlite") {
    const db = getSqliteDb();
    const t = commObservationsSqlite;
    const rows = db
      .select({
        from: t.fromAgentId,
        to: t.toAgentId,
        messages: sum(t.messageCount),
        runs: countDistinct(t.runId),
        lastAt: max(t.observedAt),
      })
      .from(t)
      .groupBy(t.fromAgentId, t.toAgentId)
      .all();
    const [runs] = db.select({ n: countDistinct(t.runId) }).from(t).all();
    return {
      totals: rows.map((r) => ({
        from: r.from,
        to: r.to,
        messages: Number(r.messages ?? 0),
        runs: Number(r.runs ?? 0),
        lastAt: r.lastAt instanceof Date ? r.lastAt : new Date(Number(r.lastAt ?? 0)),
      })),
      runs: Number(runs?.n ?? 0),
    };
  }
  const db = getPgDb();
  const t = commObservations;
  const rows = await db
    .select({
      from: t.fromAgentId,
      to: t.toAgentId,
      messages: sum(t.messageCount),
      runs: countDistinct(t.runId),
      lastAt: max(t.observedAt),
    })
    .from(t)
    .groupBy(t.fromAgentId, t.toAgentId);
  const [runs] = await db.select({ n: countDistinct(t.runId) }).from(t);
  return {
    totals: rows.map((r) => ({
      from: r.from,
      to: r.to,
      messages: Number(r.messages ?? 0),
      runs: Number(r.runs ?? 0),
      lastAt: r.lastAt ? new Date(r.lastAt) : new Date(0),
    })),
    runs: Number(runs?.n ?? 0),
  };
}

/** The weighted graph between saved agents. */
export async function getCommGraph(): Promise<CommGraph> {
  const [{ totals, runs }, agents] = await Promise.all([pairTotals(), listAgents()]);
  const graph = buildCommGraph(totals, new Set(agents.map((a) => a.id)));
  return { ...graph, runsWithMessages: runs };
}

/** Re-count every stored run (for runs saved before counting existed, or after a fix to the counter). */
export async function rebuildCommObservations(): Promise<{ runs: number; pairs: number }> {
  const runs = await loadRuns();
  let pairs = 0;
  for (const run of runs) {
    if (run.status === "running" || run.status === "pending") continue;
    const stored = await loadRun(run.id);
    if (!stored || stored.run.skipCommRecording) continue;
    const at = new Date(run.finishedAt ?? run.createdAt);
    pairs += await recordRunComms(run.id, stored.events, Number.isNaN(at.getTime()) ? new Date() : at);
  }
  return { runs: runs.length, pairs };
}
