/**
 * "Evaluate every agent" batches. agent_vuln_assessments keeps only the latest assessment per
 * agent; these tables keep a snapshot per batch (scores before and after), so later steps can
 * compare one batch with another.
 */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  normalizeVulnScores,
  type VulnBatch,
  type VulnBatchEstimate,
  type VulnBatchResult,
  type VulnBatchResultStatus,
  type VulnBatchSettings,
  type VulnBatchStatus,
  type VulnScores,
} from "@sandbox/shared";
import { getDbDriver, getPgDb, getSqliteDb } from "./client.js";
import { vulnEvalBatches, vulnEvalBatchResults } from "./schema.pg.js";
import { vulnEvalBatchesSqlite, vulnEvalBatchResultsSqlite } from "./schema.sqlite.js";

type BatchRow = {
  id: string;
  status: string;
  settings: VulnBatchSettings;
  estimate: VulnBatchEstimate;
  createdAt: Date;
  finishedAt: Date | null;
};

type ResultRow = {
  id: string;
  batchId: string;
  agentId: string;
  agentName: string;
  status: string;
  previousScores: Record<string, number> | null;
  scores: Record<string, number> | null;
  summary: string;
  runIds: string[];
  error: string | null;
  position: number;
  finishedAt: Date | null;
};

const sqlite = () => getDbDriver() === "sqlite";

function scoresOrNull(raw: Record<string, number> | null): VulnScores | null {
  return raw ? normalizeVulnScores(raw) : null;
}

function toResult(row: ResultRow): VulnBatchResult {
  return {
    agentId: row.agentId,
    agentName: row.agentName,
    status: row.status as VulnBatchResultStatus,
    previousScores: scoresOrNull(row.previousScores),
    scores: scoresOrNull(row.scores),
    summary: row.summary,
    runIds: Array.isArray(row.runIds) ? row.runIds : [],
    error: row.error,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

function toBatch(row: BatchRow, results: ResultRow[]): VulnBatch {
  return {
    id: row.id,
    status: row.status as VulnBatchStatus,
    settings: row.settings,
    estimate: row.estimate,
    results: [...results].sort((a, b) => a.position - b.position).map(toResult),
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

export type NewBatchAgent = {
  agentId: string;
  agentName: string;
  previousScores: VulnScores | null;
};

export async function createVulnBatch(input: {
  settings: VulnBatchSettings;
  estimate: VulnBatchEstimate;
  agents: NewBatchAgent[];
}): Promise<VulnBatch> {
  const batch: BatchRow = {
    id: `vbatch_${nanoid(10)}`,
    status: "running",
    settings: input.settings,
    estimate: input.estimate,
    createdAt: new Date(),
    finishedAt: null,
  };
  const results: ResultRow[] = input.agents.map((a, position) => ({
    id: `vbres_${nanoid(10)}`,
    batchId: batch.id,
    agentId: a.agentId,
    agentName: a.agentName,
    status: "pending",
    previousScores: a.previousScores,
    scores: null,
    summary: "",
    runIds: [],
    error: null,
    position,
    finishedAt: null,
  }));

  if (sqlite()) {
    const db = getSqliteDb();
    db.transaction((tx) => {
      tx.insert(vulnEvalBatchesSqlite).values(batch).run();
      if (results.length) tx.insert(vulnEvalBatchResultsSqlite).values(results).run();
    });
  } else {
    const db = getPgDb();
    await db.transaction(async (tx) => {
      await tx.insert(vulnEvalBatches).values(batch);
      if (results.length) await tx.insert(vulnEvalBatchResults).values(results);
    });
  }
  return toBatch(batch, results);
}

export async function getVulnBatch(id: string): Promise<VulnBatch | null> {
  if (sqlite()) {
    const db = getSqliteDb();
    const [row] = db.select().from(vulnEvalBatchesSqlite).where(eq(vulnEvalBatchesSqlite.id, id)).limit(1).all();
    if (!row) return null;
    const results = db
      .select()
      .from(vulnEvalBatchResultsSqlite)
      .where(eq(vulnEvalBatchResultsSqlite.batchId, id))
      .all();
    return toBatch(row, results);
  }
  const db = getPgDb();
  const [row] = await db.select().from(vulnEvalBatches).where(eq(vulnEvalBatches.id, id)).limit(1);
  if (!row) return null;
  const results = await db.select().from(vulnEvalBatchResults).where(eq(vulnEvalBatchResults.batchId, id));
  return toBatch(row, results);
}

export async function listVulnBatches(limit = 10): Promise<VulnBatch[]> {
  let rows: BatchRow[];
  let results: ResultRow[];
  if (sqlite()) {
    const db = getSqliteDb();
    rows = db.select().from(vulnEvalBatchesSqlite).orderBy(desc(vulnEvalBatchesSqlite.createdAt)).limit(limit).all();
    results = rows.length
      ? db
          .select()
          .from(vulnEvalBatchResultsSqlite)
          .where(inArray(vulnEvalBatchResultsSqlite.batchId, rows.map((r) => r.id)))
          .orderBy(asc(vulnEvalBatchResultsSqlite.position))
          .all()
      : [];
  } else {
    const db = getPgDb();
    rows = await db.select().from(vulnEvalBatches).orderBy(desc(vulnEvalBatches.createdAt)).limit(limit);
    results = rows.length
      ? await db
          .select()
          .from(vulnEvalBatchResults)
          .where(inArray(vulnEvalBatchResults.batchId, rows.map((r) => r.id)))
          .orderBy(asc(vulnEvalBatchResults.position))
      : [];
  }
  return rows.map((row) => toBatch(row, results.filter((r) => r.batchId === row.id)));
}

export type AgentResultUpdate = {
  status: Exclude<VulnBatchResultStatus, "pending">;
  scores: VulnScores | null;
  summary: string;
  runIds: string[];
  error: string | null;
};

/** Returns false when the batch has no row for that agent. */
export async function recordVulnBatchResult(
  batchId: string,
  agentId: string,
  update: AgentResultUpdate,
): Promise<boolean> {
  const set = {
    status: update.status,
    scores: update.scores,
    summary: update.summary.slice(0, 4000),
    runIds: update.runIds,
    error: update.error ? update.error.slice(0, 1000) : null,
    finishedAt: new Date(),
  };
  if (sqlite()) {
    const res = getSqliteDb()
      .update(vulnEvalBatchResultsSqlite)
      .set(set)
      .where(and(eq(vulnEvalBatchResultsSqlite.batchId, batchId), eq(vulnEvalBatchResultsSqlite.agentId, agentId)))
      .run();
    return res.changes > 0;
  }
  const rows = await getPgDb()
    .update(vulnEvalBatchResults)
    .set(set)
    .where(and(eq(vulnEvalBatchResults.batchId, batchId), eq(vulnEvalBatchResults.agentId, agentId)))
    .returning({ id: vulnEvalBatchResults.id });
  return rows.length > 0;
}

export async function finishVulnBatch(
  batchId: string,
  status: Exclude<VulnBatchStatus, "running">,
): Promise<boolean> {
  const set = { status, finishedAt: new Date() };
  if (sqlite()) {
    const res = getSqliteDb().update(vulnEvalBatchesSqlite).set(set).where(eq(vulnEvalBatchesSqlite.id, batchId)).run();
    return res.changes > 0;
  }
  const rows = await getPgDb()
    .update(vulnEvalBatches)
    .set(set)
    .where(eq(vulnEvalBatches.id, batchId))
    .returning({ id: vulnEvalBatches.id });
  return rows.length > 0;
}
