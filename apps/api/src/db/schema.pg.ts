import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import type { InternalRun } from "../harness/orchestrator.js";
import type { TraceEvent } from "@sandbox/shared";
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

export type DemoSimVectorRow = { title: string; detail: string };
export type DemoSimAnalysisRow = {
  surface: string;
  failuresAmplifications: string[];
  actionableRemediations: string[];
  scoreSummary: string;
};

/** A satisfactory DEMO SIM iteration, listed in Evaluaciones. */
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
