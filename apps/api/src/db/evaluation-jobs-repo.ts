import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { EvaluationJob, EvaluationJobData, EvaluationJobStatus } from "@sandbox/shared";
import { getDbDriver, getPgDb, getSqliteDb } from "./client.js";
import { evaluationJobs as pg } from "./schema.pg.js";
import { evaluationJobsSqlite as sq } from "./schema.sqlite.js";

type Row = { id: string; status: EvaluationJobStatus; data: EvaluationJobData; createdAt: Date; updatedAt: Date };
const dto = (row: Row): EvaluationJob => ({ ...row.data, id: row.id, status: row.status, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });

export async function listEvaluationJobs(): Promise<EvaluationJob[]> {
  const rows = getDbDriver() === "postgres"
    ? await getPgDb().select().from(pg).orderBy(desc(pg.createdAt)).limit(100)
    : getSqliteDb().select().from(sq).orderBy(desc(sq.createdAt)).limit(100).all();
  return rows.map(dto);
}
export async function getEvaluationJob(id: string): Promise<EvaluationJob | null> {
  const rows = getDbDriver() === "postgres"
    ? await getPgDb().select().from(pg).where(eq(pg.id, id)).limit(1)
    : getSqliteDb().select().from(sq).where(eq(sq.id, id)).limit(1).all();
  return rows[0] ? dto(rows[0]) : null;
}
export async function createEvaluationJob(data: EvaluationJobData): Promise<EvaluationJob> {
  const now = new Date();
  const row = { id: `eval_${nanoid(16)}`, status: "queued" as const, data, createdAt: now, updatedAt: now };
  if (getDbDriver() === "postgres") await getPgDb().insert(pg).values(row);
  else getSqliteDb().insert(sq).values(row).run();
  return dto(row);
}
export async function claimEvaluationJob(id: string, owner: string): Promise<boolean> {
  const values = { status: "running" as const, owner, updatedAt: new Date() };
  const rows = getDbDriver() === "postgres"
    ? await getPgDb().update(pg).set(values).where(and(eq(pg.id, id), eq(pg.status, "queued"))).returning({ id: pg.id })
    : getSqliteDb().update(sq).set(values).where(and(eq(sq.id, id), eq(sq.status, "queued"))).returning({ id: sq.id }).all();
  return rows.length > 0;
}
export async function updateEvaluationJob(id: string, owner: string, data?: EvaluationJobData, status?: EvaluationJobStatus) {
  const values = { updatedAt: new Date(), ...(data ? { data } : {}), ...(status ? { status } : {}) };
  if (getDbDriver() === "postgres") await getPgDb().update(pg).set(values).where(and(eq(pg.id, id), eq(pg.owner, owner), inArray(pg.status, ["running", "cancelling"])));
  else getSqliteDb().update(sq).set(values).where(and(eq(sq.id, id), eq(sq.owner, owner), inArray(sq.status, ["running", "cancelling"]))).run();
}
export async function cancelEvaluationJob(id: string) {
  // Conditional updates preserve completion if the worker finishes at the same instant.
  if (getDbDriver() === "postgres") {
    await getPgDb().update(pg).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(pg.id, id), eq(pg.status, "queued")));
    await getPgDb().update(pg).set({ status: "cancelling" }).where(and(eq(pg.id, id), eq(pg.status, "running")));
  } else {
    getSqliteDb().update(sq).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(sq.id, id), eq(sq.status, "queued"))).run();
    getSqliteDb().update(sq).set({ status: "cancelling" }).where(and(eq(sq.id, id), eq(sq.status, "running"))).run();
  }
}
/** A lost worker never silently replays model calls or reports success. */
export async function expireEvaluationJobs() {
  const cutoff = new Date(Date.now() - 5 * 60_000);
  if (getDbDriver() === "postgres") await getPgDb().update(pg).set({ status: "failed", updatedAt: new Date() }).where(and(inArray(pg.status, ["running", "cancelling"]), lt(pg.updatedAt, cutoff)));
  else getSqliteDb().update(sq).set({ status: "failed", updatedAt: new Date() }).where(and(inArray(sq.status, ["running", "cancelling"]), lt(sq.updatedAt, cutoff))).run();
}
