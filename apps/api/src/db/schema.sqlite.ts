import {
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

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
