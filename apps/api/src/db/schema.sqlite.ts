import {
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { InternalRun } from "../harness/orchestrator.js";
import type { TraceEvent } from "@sandbox/shared";
import type { RunJudgment } from "../harness/judge.js";
import type { EvaluationJobData, EvaluationJobStatus } from "@sandbox/shared";

export const evaluationJobsSqlite = sqliteTable("evaluation_jobs", {
  id: text("id").primaryKey(),
  status: text("status").$type<EvaluationJobStatus>().notNull(),
  owner: text("owner"),
  data: text("data", { mode: "json" }).$type<EvaluationJobData>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

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

export type FlowGraphNodeRow = { agentId: string; label: string; weight: number };
export type FlowGraphEdgeRow = {
  fromAgentId: string;
  toAgentId: string;
  from: string;
  to: string;
  weight: number;
};

/** Latest directed communication graph for one company. */
export const flowGraphsSqlite = sqliteTable("flow_graphs", {
  companyName: text("company_name").primaryKey(),
  nodes: text("nodes", { mode: "json" }).$type<FlowGraphNodeRow[]>().notNull(),
  edges: text("edges", { mode: "json" }).$type<FlowGraphEdgeRow[]>().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type DemoSimVectorRow = { title: string; detail: string };
export type DemoSimAnalysisRow = {
  surface: string;
  failuresAmplifications: string[];
  actionableRemediations: string[];
  scoreSummary: string;
};

/** A satisfactory DEMO SIM iteration, listed in Evaluaciones. */
export const demoSimFindingsSqlite = sqliteTable("demo_sim_findings", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull(),
  prompt: text("prompt").notNull(),
  attackSurface: text("attack_surface").notNull(),
  vector: text("vector", { mode: "json" }).$type<DemoSimVectorRow[]>().notNull(),
  analysis: text("analysis", { mode: "json" }).$type<DemoSimAnalysisRow>().notNull(),
  runId: text("run_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
