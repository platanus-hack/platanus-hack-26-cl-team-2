import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { InternalRun } from "../harness/orchestrator.js";
import type {
  TraceEvent,
  VulnBatchEstimate,
  VulnBatchSettings,
} from "@sandbox/shared";
import type { RunJudgment } from "../harness/judge.js";

export const simulationRuns = pgTable("simulation_runs", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<InternalRun>().notNull(),
  events: jsonb("events").$type<TraceEvent[]>().notNull(),
  judgment: jsonb("judgment").$type<RunJudgment>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const agents = pgTable(
  "agents",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    title: text("title").notNull(),
    areaId: text("area_id").notNull(),
    seniority: text("seniority").notNull(),
    motivation: text("motivation").notNull(),
    proactivity: text("proactivity").notNull(),
    systemContext: text("system_context").notNull(),
    operatingStyle: jsonb("operating_style").$type<string[]>().notNull(),
    goalTemplate: text("goal_template").notNull(),
    rawCompose: jsonb("raw_compose").$type<{
      systemContext: string;
      operatingStyle: string[];
      goalTemplate: string;
    }>(),
    refinedByModel: boolean("refined_by_model").notNull().default(false),
    orgHints: jsonb("org_hints").$type<{
      companyName?: string;
      industry?: string;
      notes?: string;
    }>(),
    harnessTools: jsonb("harness_tools")
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    harnessModel: text("harness_model"),
    /** manual | enterprise | seed | test; null on rows saved before it existed. Set on insert only. */
    origin: text("origin"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("agents_area_idx").on(t.areaId)],
);

export const agentContextFiles = pgTable(
  "agent_context_files",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("markdown"),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("agent_context_files_agent_idx").on(t.agentId)],
);

/** Current vulnerability assessment for an agent (upserted after each eval run). */
export const agentVulnAssessments = pgTable(
  "agent_vuln_assessments",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" })
      .unique(),
    scores: jsonb("scores")
      .$type<Record<string, number>>()
      .notNull(),
    summary: text("summary").notNull(),
    categoryNotes: jsonb("category_notes")
      .$type<Record<string, string>>()
      .notNull()
      .$defaultFn(() => ({})),
    designerBrief: jsonb("designer_brief").$type<{
      scenarios: Array<{
        category: string;
        title: string;
        scenarioHint: string;
        grantFinanceTools: boolean;
        rationale: string;
      }>;
    }>(),
    runIds: jsonb("run_ids")
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    harnessSnapshot: jsonb("harness_snapshot").$type<{
      areaId: string;
      title: string;
      harnessTools: string[];
      knobs: {
        seniority: string;
        motivation: string;
        proactivity: string;
      };
    }>(),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("agent_vuln_assessments_agent_idx").on(t.agentId)],
);

/** One "evaluate every agent" batch (append-only history, unlike agent_vuln_assessments). */
export const vulnEvalBatches = pgTable("vuln_eval_batches", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  settings: jsonb("settings").$type<VulnBatchSettings>().notNull(),
  estimate: jsonb("estimate").$type<VulnBatchEstimate>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/** Per-agent snapshot inside a batch: scores before and after. No FK to agents, so history survives deletes. */
export const vulnEvalBatchResults = pgTable(
  "vuln_eval_batch_results",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id")
      .notNull()
      .references(() => vulnEvalBatches.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    agentName: text("agent_name").notNull(),
    status: text("status").notNull(),
    previousScores: jsonb("previous_scores").$type<Record<string, number>>(),
    scores: jsonb("scores").$type<Record<string, number>>(),
    summary: text("summary").notNull().default(""),
    runIds: jsonb("run_ids").$type<string[]>().notNull(),
    error: text("error"),
    position: integer("position").notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("vuln_eval_batch_results_batch_agent_idx").on(t.batchId, t.agentId)],
);
