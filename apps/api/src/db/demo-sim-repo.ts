import { desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { attackVector, type DemoSimEval, type DemoSimFinding } from "@sandbox/shared";
import { getDbDriver, getPgDb, getSqliteDb } from "./client.js";
import { demoSimFindings } from "./schema.pg.js";
import { demoSimFindingsSqlite } from "./schema.sqlite.js";
import { loadRun } from "./runs-repo.js";

function toFinding(row: {
  id: string;
  companyName: string;
  prompt: string;
  attackSurface: string;
  vector: DemoSimFinding["vector"];
  analysis: DemoSimFinding["analysis"];
  runId: string;
  createdAt: Date;
}): DemoSimFinding {
  return {
    id: row.id,
    companyName: row.companyName,
    createdAt: row.createdAt.toISOString(),
    prompt: row.prompt,
    attackSurface: row.attackSurface,
    vector: row.vector,
    runId: row.runId,
    analysis: row.analysis,
  };
}

export async function listDemoSimFindings(): Promise<DemoSimFinding[]> {
  if (getDbDriver() === "sqlite") {
    const rows = await getSqliteDb().select().from(demoSimFindingsSqlite).orderBy(desc(demoSimFindingsSqlite.createdAt));
    return rows.map(toFinding);
  }
  const rows = await getPgDb().select().from(demoSimFindings).orderBy(desc(demoSimFindings.createdAt));
  return rows.map(toFinding);
}

/**
 * Stores one iteration in Evaluaciones.
 * An empty evaluation stays out unless the user asks to publish it, to check that the response lands there.
 */
export async function saveDemoSimFinding(input: {
  companyName: string;
  prompt: string;
  attackSurface: string;
  runId: string;
  evaluation: DemoSimEval;
  allowEmpty?: boolean;
}): Promise<DemoSimFinding> {
  if (input.evaluation.empty && !input.allowEmpty) throw new Error("La iteración no encontró un vector.");
  const stored = await loadRun(input.runId);
  if (!stored) throw new Error("Ejecución no encontrada");
  const names: Record<string, string> = {};
  for (const agent of stored.run.agents) names[agent.id] = agent.name;
  const row = {
    id: nanoid(12),
    companyName: input.companyName.trim(),
    prompt: input.prompt.trim().slice(0, 10000),
    attackSurface: input.attackSurface.trim().slice(0, 2000) || "Vector por el camino más pesado",
    vector: attackVector(input.prompt, stored.events, names),
    analysis: {
      surface: input.evaluation.surface,
      failuresAmplifications: input.evaluation.failuresAmplifications,
      actionableRemediations: input.evaluation.actionableRemediations,
      scoreSummary: input.evaluation.scoreSummary || (input.evaluation.empty
        ? "La iteración no encontró un vector. Esta fila es la respuesta de esa corrida, para verla en Evaluaciones."
        : ""),
      empty: input.evaluation.empty || undefined,
    },
    runId: input.runId,
    createdAt: new Date(),
  };
  if (getDbDriver() === "sqlite") await getSqliteDb().insert(demoSimFindingsSqlite).values(row);
  else await getPgDb().insert(demoSimFindings).values(row);
  return toFinding(row);
}
