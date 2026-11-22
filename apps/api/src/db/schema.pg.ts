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
import type { EvaluationJobData, EvaluationJobStatus } from "@sandbox/shared";

export const evaluationJobs = pgTable("evaluation_jobs", {
  id: text("id").primaryKey(),
  status: text("status").$type<EvaluationJobStatus>().notNull(),
  owner: text("owner"),
  data: jsonb("data").$type<EvaluationJobData>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

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

export type FlowGraphNodeRow = { agentId: string; label: string; weight: number };
export type FlowGraphEdgeRow = {
  fromAgentId: string;
  toAgentId: string;
  from: string;
  to: string;
  weight: number;
};

/** Latest directed communication graph for one company. */
export const flowGraphs = pgTable("flow_graphs", {
  companyName: text("company_name").primaryKey(),
  nodes: jsonb("nodes").$type<FlowGraphNodeRow[]>().notNull(),
  edges: jsonb("edges").$type<FlowGraphEdgeRow[]>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type CompanyTxtFileRow = {
  id: string;
  filename: string;
  content: string;
  label: string;
  readAgentIds: string[];
  writeAgentIds: string[];
};

/** .txt files for one company, with per-agent read and write tools. */
export const companyTxtFiles = pgTable("company_txt_files", {
  companyName: text("company_name").primaryKey(),
  files: jsonb("files").$type<CompanyTxtFileRow[]>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type DemoSimVectorRow = { title: string; detail: string };
export type DemoSimAnalysisRow = {
  surface: string;
  failuresAmplifications: string[];
  actionableRemediations: string[];
  scoreSummary: string;
  empty?: boolean;
  /** Control-agent opening approach for that cycle. */
  approach?: string;
  objectiveScore?: number;
  actions?: Array<{
    kind: "scenarioHint" | "peerMessage";
    label: string;
    seedAgentId: string;
    scenarioHint?: string;
    peerMessage?: { fromAgentId: string; toAgentId: string; body: string };
  }>;
  maxTurns?: number;
};

/** One DEMO SIM cycle scored against its objective, listed in Evaluaciones. */
export const demoSimFindings = pgTable("demo_sim_findings", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull(),
  prompt: text("prompt").notNull(),
  attackSurface: text("attack_surface").notNull(),
  vector: jsonb("vector").$type<DemoSimVectorRow[]>().notNull(),
  analysis: jsonb("analysis").$type<DemoSimAnalysisRow>().notNull(),
  runId: text("run_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

/**
 * Messages one agent sent another in one run (counted from the trace, injected messages left out).
 * One row per (run, from, to), so re-counting a run replaces its rows instead of adding twice.
 */
export const commObservations = pgTable(
  "comm_observations",
  {
    runId: text("run_id").notNull(),
    fromAgentId: text("from_agent_id").notNull(),
    toAgentId: text("to_agent_id").notNull(),
    messageCount: integer("message_count").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("comm_observations_run_pair_idx").on(t.runId, t.fromAgentId, t.toAgentId),
    index("comm_observations_pair_idx").on(t.fromAgentId, t.toAgentId),
  ],
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

export type DemoOrgFileRow = {
  id: string;
  filename: string;
  content: string;
  label: string;
  readAgentIds: string[];
  writeAgentIds: string[];
};

/** DEMO mode company snapshot + agent ids created from prompts. */
export const demoOrgs = pgTable("demo_orgs", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull(),
  context: text("context").notNull(),
  agentIds: jsonb("agent_ids")
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),
  files: jsonb("files")
    .$type<DemoOrgFileRow[]>()
    .notNull()
    .$defaultFn(() => []),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
