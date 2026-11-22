import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  attackVector,
  type DemoSimAction,
  type DemoSimEval,
  type DemoSimFinding,
} from "@sandbox/shared";
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

function sanitizeActions(actions: DemoSimAction[] | undefined): DemoSimAction[] | undefined {
  if (!Array.isArray(actions) || actions.length === 0) return undefined;
  const out: DemoSimAction[] = [];
  for (const action of actions.slice(0, 1)) {
    if (!action || typeof action !== "object") continue;
    const kind = action.kind === "peerMessage" ? "peerMessage" : "scenarioHint";
    const seedAgentId = String(action.seedAgentId ?? "").trim().slice(0, 128);
    const label = String(action.label ?? "Intervención").trim().slice(0, 120) || "Intervención";
    if (kind === "peerMessage" && action.peerMessage) {
      const fromAgentId = String(action.peerMessage.fromAgentId ?? "").trim().slice(0, 128);
      const toAgentId = String(action.peerMessage.toAgentId ?? "").trim().slice(0, 128);
      const body = String(action.peerMessage.body ?? "").trim().slice(0, 10000);
      if (fromAgentId && toAgentId && fromAgentId !== toAgentId && body.length >= 20) {
        out.push({ kind, label, seedAgentId: toAgentId || seedAgentId, peerMessage: { fromAgentId, toAgentId, body } });
      }
      continue;
    }
    const scenarioHint = String(action.scenarioHint ?? "").trim().slice(0, 10000);
    if (seedAgentId && scenarioHint.length >= 20) {
      out.push({ kind: "scenarioHint", label, seedAgentId, scenarioHint });
    }
  }
  return out.length ? out : undefined;
}

/** Recover a replayable action from run.started when the finding predates stored actions. */
export async function recoverActionsFromRun(
  runId: string,
  approach?: string,
): Promise<{ actions: DemoSimAction[]; maxTurns?: number } | null> {
  const stored = await loadRun(runId);
  if (!stored) return null;
  const started = stored.events.find((event) => event.type === "run.started");
  const payload = (started?.payload ?? {}) as Record<string, unknown>;
  const maxTurns =
    typeof payload.maxTotalTurns === "number" && payload.maxTotalTurns > 0
      ? Math.min(1000, Math.floor(payload.maxTotalTurns))
      : typeof payload.maxTurnsPerAgent === "number" && payload.maxTurnsPerAgent > 0
        ? Math.min(1000, Math.floor(payload.maxTurnsPerAgent))
        : undefined;
  const scenarioHint = String(payload.scenarioHint ?? "").trim();
  const seedAgentId = String(payload.seedAgentId ?? "").trim();
  if (scenarioHint.length >= 20 && seedAgentId) {
    return {
      actions: [{
        kind: "scenarioHint",
        label: "Intervención",
        seedAgentId,
        scenarioHint: scenarioHint.slice(0, 10000),
      }],
      maxTurns,
    };
  }
  const peer = payload.peerMessage && typeof payload.peerMessage === "object"
    ? (payload.peerMessage as Record<string, unknown>)
    : null;
  const fromAgentId = String(peer?.fromAgentId ?? "").trim();
  const toAgentId = String(peer?.toAgentId ?? "").trim();
  const body = String(approach ?? peer?.bodyPreview ?? "").trim();
  if (fromAgentId && toAgentId && fromAgentId !== toAgentId && body.length >= 20) {
    return {
      actions: [{
        kind: "peerMessage",
        label: "Intervención",
        seedAgentId: toAgentId,
        peerMessage: { fromAgentId, toAgentId, body: body.slice(0, 10000) },
      }],
      maxTurns,
    };
  }
  return null;
}

export async function listDemoSimFindings(): Promise<DemoSimFinding[]> {
  if (getDbDriver() === "sqlite") {
    const rows = await getSqliteDb().select().from(demoSimFindingsSqlite).orderBy(desc(demoSimFindingsSqlite.createdAt));
    return rows.map(toFinding);
  }
  const rows = await getPgDb().select().from(demoSimFindings).orderBy(desc(demoSimFindings.createdAt));
  return rows.map(toFinding);
}

export async function getDemoSimFinding(id: string): Promise<DemoSimFinding | null> {
  const findingId = id.trim();
  if (!findingId) return null;
  if (getDbDriver() === "sqlite") {
    const rows = await getSqliteDb().select().from(demoSimFindingsSqlite).where(eq(demoSimFindingsSqlite.id, findingId)).limit(1);
    const row = rows[0];
    return row ? toFinding(row) : null;
  }
  const rows = await getPgDb().select().from(demoSimFindings).where(eq(demoSimFindings.id, findingId)).limit(1);
  const row = rows[0];
  return row ? toFinding(row) : null;
}

/**
 * Stores one DEMO SIM cycle in Evaluaciones, scored against the fixed objective.
 */
export async function saveDemoSimFinding(input: {
  companyName: string;
  /** Fixed user objective. */
  prompt: string;
  attackSurface: string;
  runId: string;
  evaluation: DemoSimEval;
  /** Control-agent opening approach used in the run. */
  approach?: string;
  allowEmpty?: boolean;
  actions?: DemoSimAction[];
  maxTurns?: number;
}): Promise<DemoSimFinding> {
  if (input.evaluation.empty && !input.allowEmpty) {
    throw new Error("El objetivo no se cumplió. Marca allowEmpty para guardar igual esta evaluación.");
  }
  const stored = await loadRun(input.runId);
  if (!stored) throw new Error("Ejecución no encontrada");
  const names: Record<string, string> = {};
  for (const agent of stored.run.agents) names[agent.id] = agent.name;
  const objective = input.prompt.trim().slice(0, 10000);
  const approach = (input.approach ?? "").trim().slice(0, 10000);
  const actions = sanitizeActions(input.actions);
  const maxTurns =
    typeof input.maxTurns === "number" && Number.isInteger(input.maxTurns) && input.maxTurns >= 1
      ? Math.min(1000, input.maxTurns)
      : undefined;
  const row = {
    id: nanoid(12),
    companyName: input.companyName.trim(),
    prompt: objective,
    attackSurface: input.attackSurface.trim().slice(0, 2000) || (input.evaluation.empty ? "Objetivo no cumplido" : "Objetivo cumplido"),
    vector: attackVector(objective, stored.events, names),
    analysis: {
      surface: input.evaluation.surface,
      failuresAmplifications: input.evaluation.failuresAmplifications,
      actionableRemediations: input.evaluation.actionableRemediations,
      scoreSummary: input.evaluation.scoreSummary || (input.evaluation.empty
        ? "El objetivo no se cumplió en esta corrida."
        : "El objetivo se cumplió en esta corrida."),
      empty: input.evaluation.empty || undefined,
      approach: approach || undefined,
      objectiveScore: input.evaluation.objectiveScore,
      actions,
      maxTurns,
    },
    runId: input.runId,
    createdAt: new Date(),
  };
  if (getDbDriver() === "sqlite") await getSqliteDb().insert(demoSimFindingsSqlite).values(row);
  else await getPgDb().insert(demoSimFindings).values(row);
  return toFinding(row);
}
