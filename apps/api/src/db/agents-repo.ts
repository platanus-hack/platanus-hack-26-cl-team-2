import { and, asc, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { AgentOrigin, AgentProfile, OrgHints } from "@sandbox/shared";
import { getDbDriver, getPgDb, getSqliteDb } from "./client.js";
import {
  asNormalizedAgent,
  asNormalizedFile,
  fileToDto,
  profileToInsert,
  rowToProfile,
  type ContextFileDto,
  type StoredAgent,
} from "./mappers.js";
import { agentContextFiles, agents } from "./schema.pg.js";
import {
  agentContextFilesSqlite,
  agentsSqlite,
} from "./schema.sqlite.js";

export async function listAgents(): Promise<StoredAgent[]> {
  if (getDbDriver() === "sqlite") {
    const db = getSqliteDb();
    const rows = await db
      .select()
      .from(agentsSqlite)
      .orderBy(desc(agentsSqlite.updatedAt));
    const files = await db
      .select()
      .from(agentContextFilesSqlite)
      .orderBy(asc(agentContextFilesSqlite.createdAt));
    const byAgent = new Map<string, typeof files>();
    for (const f of files) {
      const list = byAgent.get(f.agentId) ?? [];
      list.push(f);
      byAgent.set(f.agentId, list);
    }
    return rows.map((row) =>
      rowToProfile(
        asNormalizedAgent(row),
        (byAgent.get(row.id) ?? []).map(asNormalizedFile),
      ),
    );
  }

  const db = getPgDb();
  const rows = await db.select().from(agents).orderBy(desc(agents.updatedAt));
  const files = await db
    .select()
    .from(agentContextFiles)
    .orderBy(asc(agentContextFiles.createdAt));
  const byAgent = new Map<string, typeof files>();
  for (const f of files) {
    const list = byAgent.get(f.agentId) ?? [];
    list.push(f);
    byAgent.set(f.agentId, list);
  }
  return rows.map((row) =>
    rowToProfile(
      asNormalizedAgent(row),
      (byAgent.get(row.id) ?? []).map(asNormalizedFile),
    ),
  );
}

export async function getAgent(id: string): Promise<StoredAgent | null> {
  if (getDbDriver() === "sqlite") {
    const db = getSqliteDb();
    const [row] = await db
      .select()
      .from(agentsSqlite)
      .where(eq(agentsSqlite.id, id))
      .limit(1);
    if (!row) return null;
    const files = await db
      .select()
      .from(agentContextFilesSqlite)
      .where(eq(agentContextFilesSqlite.agentId, id))
      .orderBy(asc(agentContextFilesSqlite.createdAt));
    return rowToProfile(
      asNormalizedAgent(row),
      files.map(asNormalizedFile),
    );
  }

  const db = getPgDb();
  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  if (!row) return null;
  const files = await db
    .select()
    .from(agentContextFiles)
    .where(eq(agentContextFiles.agentId, id))
    .orderBy(asc(agentContextFiles.createdAt));
  return rowToProfile(asNormalizedAgent(row), files.map(asNormalizedFile));
}

export async function upsertAgent(
  profile: AgentProfile,
  extras?: {
    harnessTools?: string[];
    harnessModel?: string | null;
    orgHints?: OrgHints | null;
    /** Recorded when the row is first inserted; later saves never change it. */
    origin?: AgentOrigin | null;
  },
): Promise<StoredAgent> {
  const values = profileToInsert(profile, extras);

  if (getDbDriver() === "sqlite") {
    const db = getSqliteDb();
    await db
      .insert(agentsSqlite)
      .values(values)
      .onConflictDoUpdate({
        target: agentsSqlite.id,
        set: {
          name: values.name,
          title: values.title,
          areaId: values.areaId,
          seniority: values.seniority,
          motivation: values.motivation,
          proactivity: values.proactivity,
          systemContext: values.systemContext,
          operatingStyle: values.operatingStyle,
          goalTemplate: values.goalTemplate,
          rawCompose: values.rawCompose,
          refinedByModel: values.refinedByModel,
          orgHints: values.orgHints,
          harnessTools: values.harnessTools,
          harnessModel: values.harnessModel,
          updatedAt: values.updatedAt,
        },
      });
  } else {
    const db = getPgDb();
    await db
      .insert(agents)
      .values(values)
      .onConflictDoUpdate({
        target: agents.id,
        set: {
          name: values.name,
          title: values.title,
          areaId: values.areaId,
          seniority: values.seniority,
          motivation: values.motivation,
          proactivity: values.proactivity,
          systemContext: values.systemContext,
          operatingStyle: values.operatingStyle,
          goalTemplate: values.goalTemplate,
          rawCompose: values.rawCompose,
          refinedByModel: values.refinedByModel,
          orgHints: values.orgHints,
          harnessTools: values.harnessTools,
          harnessModel: values.harnessModel,
          updatedAt: values.updatedAt,
        },
      });
  }

  const stored = await getAgent(profile.id);
  if (!stored) throw new Error("Failed to persist agent");
  return stored;
}

export async function deleteAgent(id: string): Promise<boolean> {
  if (getDbDriver() === "sqlite") {
    const db = getSqliteDb();
    const deleted = await db
      .delete(agentsSqlite)
      .where(eq(agentsSqlite.id, id))
      .returning({ id: agentsSqlite.id });
    return deleted.length > 0;
  }
  const db = getPgDb();
  const deleted = await db
    .delete(agents)
    .where(eq(agents.id, id))
    .returning({ id: agents.id });
  return deleted.length > 0;
}

export async function addContextFile(input: {
  agentId: string;
  name: string;
  kind?: string;
  content: string;
}): Promise<ContextFileDto> {
  const agent = await getAgent(input.agentId);
  if (!agent) throw new Error("Agent not found");

  const id = `ctx_${nanoid(10)}`;
  const now = new Date();
  const values = {
    id,
    agentId: input.agentId,
    name: input.name,
    kind: input.kind ?? "markdown",
    content: input.content,
    createdAt: now,
    updatedAt: now,
  };

  if (getDbDriver() === "sqlite") {
    const db = getSqliteDb();
    await db.insert(agentContextFilesSqlite).values(values);
    await db
      .update(agentsSqlite)
      .set({ updatedAt: now })
      .where(eq(agentsSqlite.id, input.agentId));
    const [row] = await db
      .select()
      .from(agentContextFilesSqlite)
      .where(eq(agentContextFilesSqlite.id, id))
      .limit(1);
    return fileToDto(asNormalizedFile(row!));
  }

  const db = getPgDb();
  await db.insert(agentContextFiles).values(values);
  await db
    .update(agents)
    .set({ updatedAt: now })
    .where(eq(agents.id, input.agentId));
  const [row] = await db
    .select()
    .from(agentContextFiles)
    .where(eq(agentContextFiles.id, id))
    .limit(1);
  return fileToDto(asNormalizedFile(row!));
}

export async function deleteContextFile(
  agentId: string,
  fileId: string,
): Promise<boolean> {
  if (getDbDriver() === "sqlite") {
    const db = getSqliteDb();
    const deleted = await db
      .delete(agentContextFilesSqlite)
      .where(
        and(
          eq(agentContextFilesSqlite.id, fileId),
          eq(agentContextFilesSqlite.agentId, agentId),
        ),
      )
      .returning({ id: agentContextFilesSqlite.id });
    if (deleted.length === 0) return false;
    await db
      .update(agentsSqlite)
      .set({ updatedAt: new Date() })
      .where(eq(agentsSqlite.id, agentId));
    return true;
  }

  const db = getPgDb();
  const deleted = await db
    .delete(agentContextFiles)
    .where(
      and(
        eq(agentContextFiles.id, fileId),
        eq(agentContextFiles.agentId, agentId),
      ),
    )
    .returning({ id: agentContextFiles.id });
  if (deleted.length === 0) return false;
  await db
    .update(agents)
    .set({ updatedAt: new Date() })
    .where(eq(agents.id, agentId));
  return true;
}
