import Database from "better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import postgres from "postgres";
import { config } from "../config.js";
import * as pgSchema from "./schema.pg.js";
import * as sqliteSchema from "./schema.sqlite.js";

export type PgDb = ReturnType<typeof drizzlePg<typeof pgSchema>>;
export type SqliteDb = ReturnType<typeof drizzleSqlite<typeof sqliteSchema>>;

let pgClient: ReturnType<typeof postgres> | null = null;
let pgDb: PgDb | null = null;
let sqliteHandle: Database.Database | null = null;
let sqliteDb: SqliteDb | null = null;

export function getDbDriver() {
  return config.dbDriver;
}

/** Always true: sqlite is the zero-config local default; postgres when URL is set. */
export function hasDatabase(): boolean {
  return true;
}

/** @deprecated use hasDatabase() */
export function hasDatabaseUrl(): boolean {
  return hasDatabase();
}

export function getPgDb(): PgDb {
  if (config.dbDriver !== "postgres") {
    throw new Error("Not using Postgres. Set DATABASE_URL=postgresql://...");
  }
  if (!pgDb) {
    pgClient = postgres(config.databaseUrl, {
      max: 10,
      prepare: false,
    });
    pgDb = drizzlePg(pgClient, { schema: pgSchema });
  }
  return pgDb;
}

export function getSqliteDb(): SqliteDb {
  if (config.dbDriver !== "sqlite") {
    throw new Error("Not using SQLite.");
  }
  if (!sqliteDb) {
    mkdirSync(dirname(config.sqlitePath), { recursive: true });
    sqliteHandle = new Database(config.sqlitePath);
    sqliteHandle.pragma("journal_mode = WAL");
    sqliteHandle.pragma("foreign_keys = ON");
    sqliteDb = drizzleSqlite(sqliteHandle, { schema: sqliteSchema });
    ensureSqliteTables(sqliteHandle);
  }
  return sqliteDb;
}

function ensureSqliteTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS simulation_runs (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      events TEXT NOT NULL,
      judgment TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      area_id TEXT NOT NULL,
      seniority TEXT NOT NULL,
      motivation TEXT NOT NULL,
      proactivity TEXT NOT NULL,
      system_context TEXT NOT NULL,
      operating_style TEXT NOT NULL,
      goal_template TEXT NOT NULL,
      raw_compose TEXT,
      refined_by_model INTEGER NOT NULL DEFAULT 0,
      org_hints TEXT,
      harness_tools TEXT NOT NULL DEFAULT '[]',
      harness_model TEXT,
      origin TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agents_area_idx ON agents (area_id);

    CREATE TABLE IF NOT EXISTS agent_context_files (
      id TEXT PRIMARY KEY NOT NULL,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'markdown',
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agent_context_files_agent_idx
      ON agent_context_files (agent_id);

    CREATE TABLE IF NOT EXISTS agent_vuln_assessments (
      id TEXT PRIMARY KEY NOT NULL,
      agent_id TEXT NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
      scores TEXT NOT NULL,
      summary TEXT NOT NULL,
      category_notes TEXT NOT NULL DEFAULT '{}',
      designer_brief TEXT,
      run_ids TEXT NOT NULL DEFAULT '[]',
      harness_snapshot TEXT,
      model TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agent_vuln_assessments_agent_idx
      ON agent_vuln_assessments (agent_id);

    CREATE TABLE IF NOT EXISTS vuln_eval_batches (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL,
      settings TEXT NOT NULL,
      estimate TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      finished_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS vuln_eval_batch_results (
      id TEXT PRIMARY KEY NOT NULL,
      batch_id TEXT NOT NULL REFERENCES vuln_eval_batches(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      status TEXT NOT NULL,
      previous_scores TEXT,
      scores TEXT,
      summary TEXT NOT NULL DEFAULT '',
      run_ids TEXT NOT NULL DEFAULT '[]',
      error TEXT,
      position INTEGER NOT NULL,
      finished_at INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS vuln_eval_batch_results_batch_agent_idx
      ON vuln_eval_batch_results (batch_id, agent_id);
    CREATE TABLE IF NOT EXISTS demo_orgs (
      id TEXT PRIMARY KEY NOT NULL,
      company_name TEXT NOT NULL,
      context TEXT NOT NULL,
      agent_ids TEXT NOT NULL DEFAULT '[]',
      files TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  // Databases made before agents.origin existed: add the column (CREATE TABLE IF NOT EXISTS skips it).
  const agentColumns = db.prepare("PRAGMA table_info(agents)").all() as Array<{ name: string }>;
  if (!agentColumns.some((c) => c.name === "origin")) {
    db.exec("ALTER TABLE agents ADD COLUMN origin TEXT");
  }
  try {
    db.exec(
      `ALTER TABLE demo_orgs ADD COLUMN files TEXT NOT NULL DEFAULT '[]'`,
    );
  } catch {
    // column already exists
  }
}

export async function pingDatabase(): Promise<{
  ok: boolean;
  driver: "postgres" | "sqlite";
  error?: string;
}> {
  try {
    if (config.dbDriver === "sqlite") {
      getSqliteDb();
      sqliteHandle!.prepare("select 1").get();
      return { ok: true, driver: "sqlite" };
    }
    getPgDb();
    await pgClient!`select 1`;
    return { ok: true, driver: "postgres" };
  } catch (err) {
    return {
      ok: false,
      driver: config.dbDriver,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
