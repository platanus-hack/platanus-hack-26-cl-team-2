import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  AREA_LIST,
  normalizeVulnScores,
  type AgentVulnAssessment,
  type VulnCategoryNotes,
  type VulnDesignerBrief,
  type VulnScores,
} from "@sandbox/shared";
import { getDbDriver, getPgDb, getSqliteDb } from "./client.js";
import { agentVulnAssessments } from "./schema.pg.js";
import { agentVulnAssessmentsSqlite } from "./schema.sqlite.js";

export type UpsertVulnAssessmentInput = {
  agentId: string;
  scores: VulnScores;
  summary: string;
  categoryNotes?: VulnCategoryNotes;
  designerBrief?: VulnDesignerBrief | null;
  runIds?: string[];
  harnessSnapshot?: AgentVulnAssessment["harnessSnapshot"];
  model?: string | null;
};

function coerceDesignerBrief(
  raw: unknown,
): VulnDesignerBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const scenarios = (raw as { scenarios?: unknown }).scenarios;
  if (!Array.isArray(scenarios)) return null;
  const c = (raw as { classification?: Record<string, unknown> }).classification;
  const area = c && AREA_LIST.find((a) => a.id === c.areaId);
  const classification = c && area && typeof c.function === "string" && typeof c.rationale === "string"
    ? { areaId: area.id, function: c.function.slice(0, 240), rationale: c.rationale.slice(0, 800) } : undefined;
  return {
    ...(classification ? { classification } : {}),
    scenarios: scenarios
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map((s) => ({
        category: String(s.category) as VulnDesignerBrief["scenarios"][number]["category"],
        title: String(s.title ?? ""),
        scenarioHint: String(s.scenarioHint ?? ""),
        grantFinanceTools: Boolean(s.grantFinanceTools),
        rationale: String(s.rationale ?? ""),
      })),
  };
}

function rowToAssessment(row: {
  id: string;
  agentId: string;
  scores: Record<string, number> | null;
  summary: string;
  categoryNotes: Record<string, string> | null;
  designerBrief: unknown;
  runIds: string[] | null;
  harnessSnapshot: AgentVulnAssessment["harnessSnapshot"];
  model: string | null;
  createdAt: Date | number;
  updatedAt: Date | number;
}): AgentVulnAssessment {
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
  const updatedAt =
    row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt);
  return {
    id: row.id,
    agentId: row.agentId,
    scores: normalizeVulnScores(row.scores),
    summary: row.summary,
    categoryNotes: (row.categoryNotes ?? {}) as VulnCategoryNotes,
    designerBrief: coerceDesignerBrief(row.designerBrief),
    runIds: Array.isArray(row.runIds) ? row.runIds : [],
    harnessSnapshot: row.harnessSnapshot ?? null,
    model: row.model,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export async function getVulnAssessment(
  agentId: string,
): Promise<AgentVulnAssessment | null> {
  if (getDbDriver() === "sqlite") {
    const db = getSqliteDb();
    const [row] = await db
      .select()
      .from(agentVulnAssessmentsSqlite)
      .where(eq(agentVulnAssessmentsSqlite.agentId, agentId))
      .limit(1);
    return row ? rowToAssessment(row) : null;
  }

  const db = getPgDb();
  const [row] = await db
    .select()
    .from(agentVulnAssessments)
    .where(eq(agentVulnAssessments.agentId, agentId))
    .limit(1);
  return row ? rowToAssessment(row) : null;
}

export async function upsertVulnAssessment(
  input: UpsertVulnAssessmentInput,
): Promise<AgentVulnAssessment> {
  const existing = await getVulnAssessment(input.agentId);
  const now = new Date();
  const id = existing?.id ?? `vuln_${nanoid(10)}`;
  const scores = normalizeVulnScores(input.scores);
  const categoryNotes = input.categoryNotes ?? {};
  const designerBrief = input.designerBrief ?? null;
  const runIds = input.runIds ?? [];
  const harnessSnapshot = input.harnessSnapshot ?? null;
  const model = input.model ?? null;
  const createdAt = existing ? new Date(existing.createdAt) : now;

  const values = {
    id,
    agentId: input.agentId,
    scores,
    summary: input.summary.slice(0, 4000),
    categoryNotes,
    designerBrief,
    runIds,
    harnessSnapshot,
    model,
    createdAt,
    updatedAt: now,
  };

  if (getDbDriver() === "sqlite") {
    const db = getSqliteDb();
    await db
      .insert(agentVulnAssessmentsSqlite)
      .values(values)
      .onConflictDoUpdate({
        target: agentVulnAssessmentsSqlite.agentId,
        set: {
          scores: values.scores,
          summary: values.summary,
          categoryNotes: values.categoryNotes,
          designerBrief: values.designerBrief,
          runIds: values.runIds,
          harnessSnapshot: values.harnessSnapshot,
          model: values.model,
          updatedAt: values.updatedAt,
        },
      });
  } else {
    const db = getPgDb();
    await db
      .insert(agentVulnAssessments)
      .values(values)
      .onConflictDoUpdate({
        target: agentVulnAssessments.agentId,
        set: {
          scores: values.scores,
          summary: values.summary,
          categoryNotes: values.categoryNotes,
          designerBrief: values.designerBrief,
          runIds: values.runIds,
          harnessSnapshot: values.harnessSnapshot,
          model: values.model,
          updatedAt: values.updatedAt,
        },
      });
  }

  const stored = await getVulnAssessment(input.agentId);
  if (!stored) throw new Error("Failed to persist vulnerability assessment");
  return stored;
}
