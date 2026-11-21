import { desc, eq } from "drizzle-orm";
import type { TraceEvent } from "@sandbox/shared";
import { getDbDriver, getPgDb, getSqliteDb } from "./client.js";
import { simulationRuns } from "./schema.pg.js";
import { simulationRunsSqlite } from "./schema.sqlite.js";
import type { InternalRun } from "../harness/orchestrator.js";
import type { RunJudgment } from "../harness/judge.js";

function effectiveRun(run: InternalRun): InternalRun {
  if ((run.status === "running" || run.status === "pending") && run.expiresAt && Date.parse(run.expiresAt) < Date.now()) {
    return { ...run, status: "failed", finishedAt: run.expiresAt, error: "La ejecución superó su plazo o fue interrumpida. Puedes iniciar otra prueba." };
  }
  return run;
}

export async function saveRun(run: InternalRun, events: TraceEvent[]) {
  const { judgment: _judgment, ...data } = run;
  const values = { id: run.id, data, events, createdAt: new Date(run.createdAt) };
  if (getDbDriver() === "postgres") {
    await getPgDb().insert(simulationRuns).values(values).onConflictDoUpdate({ target: simulationRuns.id, set: { data, events } });
  } else {
    getSqliteDb().insert(simulationRunsSqlite).values(values).onConflictDoUpdate({ target: simulationRunsSqlite.id, set: { data, events } }).run();
  }
}

export async function loadRun(id: string) {
  const rows = getDbDriver() === "postgres"
    ? await getPgDb().select().from(simulationRuns).where(eq(simulationRuns.id, id)).limit(1)
    : getSqliteDb().select().from(simulationRunsSqlite).where(eq(simulationRunsSqlite.id, id)).limit(1).all();
  const row = rows[0];
  if (!row) return undefined;
  const run = effectiveRun({ ...row.data, judgment: row.judgment ?? undefined });
  const events = run.status !== row.data.status ? [...row.events, { id: `timeout:${run.id}`, runId: run.id, ts: run.finishedAt!, type: "run.failed" as const, payload: { error: run.error } }] : row.events;
  return { run, events };
}

export async function loadRuns(): Promise<InternalRun[]> {
  const rows = getDbDriver() === "postgres"
    ? await getPgDb().select({ data: simulationRuns.data }).from(simulationRuns).orderBy(desc(simulationRuns.createdAt))
    : getSqliteDb().select({ data: simulationRunsSqlite.data }).from(simulationRunsSqlite).orderBy(desc(simulationRunsSqlite.createdAt)).all();
  return rows.map(row => effectiveRun(row.data));
}

export async function saveJudgment(id: string, judgment: RunJudgment) {
  if (getDbDriver() === "postgres") await getPgDb().update(simulationRuns).set({ judgment }).where(eq(simulationRuns.id, id));
  else getSqliteDb().update(simulationRunsSqlite).set({ judgment }).where(eq(simulationRunsSqlite.id, id)).run();
}
