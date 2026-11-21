import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { InternalRun } from "../harness/orchestrator.js";
import type {
  TraceEvent,
  VulnBatchEstimate,
  VulnBatchSettings,
} from "@sandbox/shared";
import type { RunJudgment } from "../harness/judge.js";

export const simulationRunsSqlite = sqliteTable("simulation_runs", {
  id: text("id").primaryKey(),
  data: text("data", { mode: "json" }).$type<InternalRun>().notNull(),
  events: text("events", { mode: "json" }).$type<TraceEvent[]>().notNull(),
  judgment: text("judgment", { mode: "json" }).$type<RunJudgment>(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

type RawCompose = {
  systemContext: string;
  operatingStyle: string[];
  goalTemplate: string;
};

type OrgHints = {
  companyName?: string;
  industry?: string;
  notes?: string;
};

export const agentsSqlite = sqliteTable(
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
    operatingStyle: text("operating_style", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    goalTemplate: text("goal_template").notNull(),
    rawCompose: text("raw_compose", { mode: "json" }).$type<RawCompose>(),
    refinedByModel: integer("refined_by_model", { mode: "boolean" })
      .notNull()
      .default(false),
    orgHints: text("org_hints", { mode: "json" }).$type<OrgHints>(),
    harnessTools: text("harness_tools", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    harnessModel: text("harness_model"),
    origin: text("origin"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("agents_area_idx").on(t.areaId)],
);

export const agentContextFilesSqlite = sqliteTable(
  "agent_context_files",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agentsSqlite.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("markdown"),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("agent_context_files_agent_idx").on(t.agentId)],
);

type VulnDesignerBriefRow = {
  scenarios: Array<{
    category: string;
    title: string;
    scenarioHint: string;
    grantFinanceTools: boolean;
    rationale: string;
  }>;
};

type VulnHarnessSnapshot = {
  areaId: string;
  title: string;
  harnessTools: string[];
  knobs: {
    seniority: string;
    motivation: string;
    proactivity: string;
  };
};

export const agentVulnAssessmentsSqlite = sqliteTable(
  "agent_vuln_assessments",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agentsSqlite.id, { onDelete: "cascade" })
      .unique(),
    scores: text("scores", { mode: "json" })
      .$type<Record<string, number>>()
      .notNull(),
    summary: text("summary").notNull(),
    categoryNotes: text("category_notes", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull()
      .$defaultFn(() => ({})),
    designerBrief: text("designer_brief", { mode: "json" }).$type<VulnDesignerBriefRow>(),
    runIds: text("run_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    harnessSnapshot: text("harness_snapshot", {
      mode: "json",
    }).$type<VulnHarnessSnapshot>(),
    model: text("model"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("agent_vuln_assessments_agent_idx").on(t.agentId)],
);

export const commObservationsSqlite = sqliteTable(
  "comm_observations",
  {
    runId: text("run_id").notNull(),
    fromAgentId: text("from_agent_id").notNull(),
    toAgentId: text("to_agent_id").notNull(),
    messageCount: integer("message_count").notNull(),
    observedAt: integer("observed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("comm_observations_run_pair_idx").on(t.runId, t.fromAgentId, t.toAgentId),
    index("comm_observations_pair_idx").on(t.fromAgentId, t.toAgentId),
  ],
);

export const vulnEvalBatchesSqlite = sqliteTable("vuln_eval_batches", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  settings: text("settings", { mode: "json" }).$type<VulnBatchSettings>().notNull(),
  estimate: text("estimate", { mode: "json" }).$type<VulnBatchEstimate>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
});

export const vulnEvalBatchResultsSqlite = sqliteTable(
  "vuln_eval_batch_results",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id")
      .notNull()
      .references(() => vulnEvalBatchesSqlite.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    agentName: text("agent_name").notNull(),
    status: text("status").notNull(),
    previousScores: text("previous_scores", { mode: "json" }).$type<Record<string, number>>(),
    scores: text("scores", { mode: "json" }).$type<Record<string, number>>(),
    summary: text("summary").notNull().default(""),
    runIds: text("run_ids", { mode: "json" }).$type<string[]>().notNull(),
    error: text("error"),
    position: integer("position").notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("vuln_eval_batch_results_batch_agent_idx").on(t.batchId, t.agentId)],
);

export type DemoOrgFileRow = {
  id: string;
  filename: string;
  content: string;
  label: string;
  readAgentIds: string[];
  writeAgentIds: string[];
};

export const demoOrgsSqlite = sqliteTable("demo_orgs", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull(),
  context: text("context").notNull(),
  agentIds: text("agent_ids", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),
  files: text("files", { mode: "json" })
    .$type<DemoOrgFileRow[]>()
    .notNull()
    .$defaultFn(() => []),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
