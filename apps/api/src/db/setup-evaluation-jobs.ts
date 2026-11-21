import postgres from "postgres";
import { config } from "../config.js";
import { getSqliteDb } from "./client.js";
import { errorMessage } from "../security/redact.js";

// Additive setup: never changes or drops existing tables.
if (config.dbDriver === "sqlite") {
  getSqliteDb();
  console.log("Cola de análisis disponible en SQLite.");
} else {
  const sql = postgres(config.databaseUrl, { max: 1, connect_timeout: 10 });
  try {
    await sql`CREATE TABLE IF NOT EXISTS evaluation_jobs (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL,
      owner TEXT,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )`;
    console.log("Cola de análisis disponible en PostgreSQL.");
  } catch (err) {
    console.error(errorMessage(err));
    process.exitCode = 1;
  } finally { await sql.end(); }
}
