import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { appendCommTrends, type AgentProfile } from "@sandbox/shared";
import { deleteAgent, getAgent, upsertAgent } from "./agents-repo.js";
import { getDbDriver, getPgDb, getSqliteDb } from "./client.js";
import type { StoredAgent } from "./mappers.js";
import { demoOrgs, type DemoOrgFileRow } from "./schema.pg.js";
import { demoOrgsSqlite } from "./schema.sqlite.js";
import {
  normalizeDemoFilename,
  syncDemoFiles,
  toolsForDemoFile,
  type DemoFileSpec,
} from "../harness/demo-files.js";

/** Single active DEMO org — saves always overwrite this row. */
export const CURRENT_DEMO_ORG_ID = "demo_current";

export type DemoOrg = {
  id: string;
  companyName: string;
  context: string;
  agentIds: string[];
  files: DemoOrgFileRow[];
  createdAt: string;
  updatedAt: string;
};

export type DemoAgentInput = {
  name: string;
  prompt: string;
};

export type DemoFileInput = {
  filename: string;
  content: string;
  label?: string;
  /** Match agents by name from the same save payload. */
  readAgentNames: string[];
  writeAgentNames: string[];
};

function rowToDemoOrg(row: {
  id: string;
  companyName: string;
  context: string;
  agentIds: string[] | null;
  files?: DemoOrgFileRow[] | null;
  createdAt: Date | number;
  updatedAt: Date | number;
}): DemoOrg {
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
  const updatedAt =
    row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt);
  return {
    id: row.id,
    companyName: row.companyName,
    context: row.context,
    agentIds: Array.isArray(row.agentIds) ? row.agentIds : [],
    files: Array.isArray(row.files) ? row.files : [],
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export async function listDemoOrgs(): Promise<DemoOrg[]> {
  if (getDbDriver() === "sqlite") {
    const rows = await getSqliteDb()
      .select()
      .from(demoOrgsSqlite)
      .orderBy(desc(demoOrgsSqlite.updatedAt));
    return rows.map(rowToDemoOrg);
  }
  const rows = await getPgDb()
    .select()
    .from(demoOrgs)
    .orderBy(desc(demoOrgs.updatedAt));
  return rows.map(rowToDemoOrg);
}

export async function getDemoOrg(id: string): Promise<DemoOrg | null> {
  if (getDbDriver() === "sqlite") {
    const [row] = await getSqliteDb()
      .select()
      .from(demoOrgsSqlite)
      .where(eq(demoOrgsSqlite.id, id))
      .limit(1);
    return row ? rowToDemoOrg(row) : null;
  }
  const [row] = await getPgDb()
    .select()
    .from(demoOrgs)
    .where(eq(demoOrgs.id, id))
    .limit(1);
  return row ? rowToDemoOrg(row) : null;
}

function buildSystemContext(companyContext: string, prompt: string): string {
  const ctx = companyContext.trim();
  const role = prompt.trim();
  if (!ctx) return role;
  return `## Contexto de empresa\n${ctx}\n\n## Rol\n${role}`;
}

/** Extract the role prompt saved under ## Rol (falls back to full systemContext). */
export function extractRolePrompt(systemContext: string): string {
  const marker = "\n\n## Rol\n";
  const idx = systemContext.indexOf(marker);
  if (idx >= 0) return systemContext.slice(idx + marker.length);
  const alt = "## Rol\n";
  const altIdx = systemContext.indexOf(alt);
  if (altIdx >= 0) return systemContext.slice(altIdx + alt.length);
  return systemContext;
}

async function loadAgentsByIds(ids: string[]): Promise<StoredAgent[]> {
  const agents: StoredAgent[] = [];
  for (const id of ids) {
    const agent = await getAgent(id);
    if (agent) agents.push(agent);
  }
  return agents;
}

async function deleteDemoOrgRow(id: string): Promise<void> {
  if (getDbDriver() === "sqlite") {
    await getSqliteDb()
      .delete(demoOrgsSqlite)
      .where(eq(demoOrgsSqlite.id, id));
    return;
  }
  await getPgDb().delete(demoOrgs).where(eq(demoOrgs.id, id));
}

/** Prefer singleton demo_current; fall back to most recently updated row. */
async function resolveCurrentDemoOrg(): Promise<DemoOrg | null> {
  const current = await getDemoOrg(CURRENT_DEMO_ORG_ID);
  if (current) return current;
  const [latest] = await listDemoOrgs();
  return latest ?? null;
}

function syncRegistryFromOrg(org: DemoOrg): void {
  const specs: DemoFileSpec[] = org.files.map((f) => ({
    id: f.id,
    filename: f.filename,
    content: f.content,
    label: f.label,
    readAgentIds: f.readAgentIds,
    writeAgentIds: f.writeAgentIds,
  }));
  syncDemoFiles(specs);
}

export async function getCurrentDemoOrg(): Promise<{
  org: DemoOrg;
  agents: StoredAgent[];
} | null> {
  const org = await resolveCurrentDemoOrg();
  if (!org) {
    syncDemoFiles([]);
    return null;
  }
  syncRegistryFromOrg(org);
  const agents = await loadAgentsByIds(org.agentIds);
  return { org, agents };
}

function buildFileRows(
  inputFiles: DemoFileInput[] | undefined,
  agentsByName: Map<string, string>,
): DemoOrgFileRow[] {
  if (!inputFiles?.length) return [];
  const usedNames = new Set<string>();
  const rows: DemoOrgFileRow[] = [];

  for (const file of inputFiles) {
    const filename = normalizeDemoFilename(file.filename);
    const key = filename.toLowerCase();
    if (usedNames.has(key)) {
      throw new Error(`Duplicate DEMO file: ${filename}`);
    }
    usedNames.add(key);

    const resolveIds = (names: string[]) =>
      [
        ...new Set(
          names
            .map((n) => n.trim())
            .filter(Boolean)
            .map((n) => agentsByName.get(n.toLowerCase()))
            .filter((id): id is string => Boolean(id)),
        ),
      ];

    rows.push({
      id: `demo_file_${nanoid(8)}`,
      filename,
      content: file.content ?? "",
      label: file.label?.trim() || filename,
      readAgentIds: resolveIds(file.readAgentNames ?? []),
      writeAgentIds: resolveIds(file.writeAgentNames ?? []),
    });
  }
  return rows;
}

function toolsForAgent(
  agentId: string,
  files: DemoOrgFileRow[],
): string[] {
  const tools = new Set(["done", "send_message", "read_inbox"]);
  for (const file of files) {
    const pair = toolsForDemoFile(file.filename);
    if (file.readAgentIds.includes(agentId)) tools.add(pair.read);
    if (file.writeAgentIds.includes(agentId)) tools.add(pair.write);
  }
  return [...tools];
}

/**
 * Overwrite the single current DEMO org: delete previous demo agents,
 * create the new set, upsert demo_current, sync file tools.
 */
export async function saveDemoOrg(input: {
  companyName?: string;
  context: string;
  agents: DemoAgentInput[];
  files?: DemoFileInput[];
}): Promise<{ org: DemoOrg; agents: StoredAgent[] }> {
  const context = input.context.trim();
  if (!context) throw new Error("Company context is required");
  if (!input.agents.length) throw new Error("Add at least one agent");

  const companyName = input.companyName?.trim() || "Empresa DEMO";
  const orgId = CURRENT_DEMO_ORG_ID;
  const now = new Date();

  const existing = await resolveCurrentDemoOrg();
  if (existing?.agentIds.length) {
    for (const agentId of existing.agentIds) {
      await deleteAgent(agentId).catch(() => false);
    }
  }
  if (existing && existing.id !== orgId) {
    await deleteDemoOrgRow(existing.id).catch(() => undefined);
  }

  const createdAgents: StoredAgent[] = [];
  const agentsByName = new Map<string, string>();

  for (const row of input.agents) {
    const name = row.name.trim();
    const prompt = row.prompt.trim();
    if (!name || !prompt) {
      throw new Error("Each agent needs a name and a prompt");
    }
    const id = `demo_agent_${nanoid(10)}`;
    agentsByName.set(name.toLowerCase(), id);

    const profile: AgentProfile = {
      id,
      name: name.slice(0, 64),
      title: "Agente DEMO",
      areaId: "cs",
      knobs: {
        seniority: "mid",
        motivation: "quality",
        proactivity: "medium",
      },
      systemContext: buildSystemContext(context, prompt),
      operatingStyle: [],
      goalTemplate: "",
      orgHints: {
        companyName,
        notes: `mesh:demo-org:${orgId}`,
      },
      refinedByModel: false,
      createdAt: now.toISOString(),
    };
    // Temporary tools; rewritten after files are resolved.
    const stored = await upsertAgent(profile, {
      orgHints: profile.orgHints ?? null,
      harnessTools: ["done", "send_message", "read_inbox"],
    });
    createdAgents.push(stored);
  }

  const files = buildFileRows(input.files, agentsByName);

  // Re-upsert agents with file ACL tools.
  const finalAgents: StoredAgent[] = [];
  for (const agent of createdAgents) {
    const harnessTools = toolsForAgent(agent.id, files);
    const profile: AgentProfile = {
      id: agent.id,
      name: agent.name,
      title: agent.title,
      areaId: agent.areaId,
      knobs: agent.knobs,
      systemContext: agent.systemContext,
      operatingStyle: agent.operatingStyle,
      goalTemplate: agent.goalTemplate,
      rawCompose: agent.rawCompose,
      refinedByModel: agent.refinedByModel,
      createdAt: agent.createdAt,
      orgHints: agent.orgHints,
    };
    const updated = await upsertAgent(profile, {
      orgHints: agent.orgHints ?? null,
      harnessTools,
      harnessModel: agent.harnessModel,
    });
    finalAgents.push(updated);
  }

  const agentIds = finalAgents.map((a) => a.id);
  const values = {
    id: orgId,
    companyName,
    context,
    agentIds,
    files,
    createdAt: existing ? new Date(existing.createdAt) : now,
    updatedAt: now,
  };

  if (getDbDriver() === "sqlite") {
    await getSqliteDb()
      .insert(demoOrgsSqlite)
      .values(values)
      .onConflictDoUpdate({
        target: demoOrgsSqlite.id,
        set: {
          companyName: values.companyName,
          context: values.context,
          agentIds: values.agentIds,
          files: values.files,
          updatedAt: values.updatedAt,
        },
      });
  } else {
    await getPgDb()
      .insert(demoOrgs)
      .values(values)
      .onConflictDoUpdate({
        target: demoOrgs.id,
        set: {
          companyName: values.companyName,
          context: values.context,
          agentIds: values.agentIds,
          files: values.files,
          updatedAt: values.updatedAt,
        },
      });
  }

  const org = await getDemoOrg(orgId);
  if (!org) throw new Error("Failed to persist demo org");
  syncRegistryFromOrg(org);
  return { org, agents: finalAgents };
}

/**
 * Update company context in place and rebuild each demo agent's systemContext
 * without deleting agent IDs (preserves vuln assessments).
 */
export async function patchDemoOrgContext(
  context: string,
): Promise<{ org: DemoOrg; agents: StoredAgent[] }> {
  const trimmed = context.trim();
  if (!trimmed) throw new Error("Company context is required");
  if (trimmed.length > 20_000) {
    throw new Error("Company context must be ≤ 20000 characters");
  }

  const current = await getCurrentDemoOrg();
  if (!current) throw new Error("No DEMO org saved");

  const { org: existing, agents: previous } = current;
  const now = new Date();
  const updatedAgents: StoredAgent[] = [];

  for (const agent of previous) {
    const role = extractRolePrompt(agent.systemContext);
    const profile: AgentProfile = {
      id: agent.id,
      name: agent.name,
      title: agent.title,
      areaId: agent.areaId,
      knobs: agent.knobs,
      systemContext: buildSystemContext(trimmed, role),
      operatingStyle: agent.operatingStyle,
      goalTemplate: agent.goalTemplate,
      rawCompose: agent.rawCompose,
      refinedByModel: agent.refinedByModel,
      createdAt: agent.createdAt,
      orgHints: agent.orgHints,
    };
    const updated = await upsertAgent(profile, {
      orgHints: agent.orgHints ?? null,
      harnessTools: agent.harnessTools,
      harnessModel: agent.harnessModel,
    });
    updatedAgents.push(updated);
  }

  const values = {
    companyName: existing.companyName,
    context: trimmed,
    agentIds: existing.agentIds,
    files: existing.files,
    updatedAt: now,
  };

  if (getDbDriver() === "sqlite") {
    await getSqliteDb()
      .update(demoOrgsSqlite)
      .set(values)
      .where(eq(demoOrgsSqlite.id, existing.id));
  } else {
    await getPgDb()
      .update(demoOrgs)
      .set(values)
      .where(eq(demoOrgs.id, existing.id));
  }

  const org = await getDemoOrg(existing.id);
  if (!org) throw new Error("Failed to patch demo org context");
  syncRegistryFromOrg(org);
  return { org, agents: updatedAgents };
}

/** Merge communication trends into context and persist in place. */
export async function patchDemoOrgCommTrends(
  trendsMarkdown: string,
): Promise<{ org: DemoOrg; agents: StoredAgent[]; trendsBlock: string }> {
  const current = await getCurrentDemoOrg();
  if (!current) throw new Error("No DEMO org saved");
  const next = appendCommTrends(current.org.context, trendsMarkdown);
  const result = await patchDemoOrgContext(next);
  return {
    ...result,
    trendsBlock: appendCommTrends("", trendsMarkdown),
  };
}

/** @deprecated use saveDemoOrg — kept as alias for existing imports */
export const createDemoOrg = saveDemoOrg;
