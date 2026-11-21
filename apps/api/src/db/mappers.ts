import {
  getArea,
  inferAgentOrigin,
  isAgentOrigin,
  type AgentOrigin,
  type AgentProfile,
  type AreaId,
  type OrgHints,
} from "@sandbox/shared";

function toolsForArea(areaId: string): string[] {
  try {
    return getArea(areaId as AreaId).defaultTools;
  } catch {
    return ["done", "send_message", "read_inbox"];
  }
}

export type ContextFileDto = {
  id: string;
  agentId: string;
  name: string;
  kind: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredAgent = AgentProfile & {
  harnessTools: string[];
  harnessModel: string | null;
  orgHints?: OrgHints;
  /** Stored origin, or inferred for rows saved before it was stored. */
  origin: AgentOrigin;
  contextFiles: ContextFileDto[];
  updatedAt: string;
};

/** Normalized row shape shared by Postgres + SQLite mappers. */
export type NormalizedAgentRow = {
  id: string;
  name: string;
  title: string;
  areaId: string;
  seniority: string;
  motivation: string;
  proactivity: string;
  systemContext: string;
  operatingStyle: string[];
  goalTemplate: string;
  rawCompose: {
    systemContext: string;
    operatingStyle: string[];
    goalTemplate: string;
  } | null;
  refinedByModel: boolean;
  orgHints: OrgHints | null;
  harnessTools: string[];
  harnessModel: string | null;
  origin: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NormalizedFileRow = {
  id: string;
  agentId: string;
  name: string;
  kind: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export function rowToProfile(
  row: NormalizedAgentRow,
  files: NormalizedFileRow[] = [],
): StoredAgent {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    areaId: row.areaId as AreaId,
    knobs: {
      seniority: row.seniority as AgentProfile["knobs"]["seniority"],
      motivation: row.motivation as AgentProfile["knobs"]["motivation"],
      proactivity: row.proactivity as AgentProfile["knobs"]["proactivity"],
    },
    systemContext: row.systemContext,
    operatingStyle: row.operatingStyle ?? [],
    goalTemplate: row.goalTemplate,
    rawCompose: row.rawCompose ?? undefined,
    refinedByModel: row.refinedByModel,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    orgHints: row.orgHints ?? undefined,
    harnessTools:
      row.harnessTools?.length > 0 ? row.harnessTools : toolsForArea(row.areaId),
    harnessModel: row.harnessModel,
    origin: isAgentOrigin(row.origin) ? row.origin : inferAgentOrigin(row),
    contextFiles: files.map(fileToDto),
  };
}

export function fileToDto(row: NormalizedFileRow): ContextFileDto {
  return {
    id: row.id,
    agentId: row.agentId,
    name: row.name,
    kind: row.kind,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function profileToInsert(
  profile: AgentProfile,
  extras?: {
    harnessTools?: string[];
    harnessModel?: string | null;
    orgHints?: OrgHints | null;
    origin?: AgentOrigin | null;
  },
) {
  const areaTools = toolsForArea(profile.areaId);
  const now = new Date();
  return {
    id: profile.id,
    name: profile.name,
    title: profile.title,
    areaId: profile.areaId,
    seniority: profile.knobs.seniority,
    motivation: profile.knobs.motivation,
    proactivity: profile.knobs.proactivity,
    systemContext: profile.systemContext,
    operatingStyle: profile.operatingStyle,
    goalTemplate: profile.goalTemplate,
    rawCompose: profile.rawCompose ?? null,
    refinedByModel: Boolean(profile.refinedByModel),
    orgHints: extras?.orgHints ?? profile.orgHints ?? null,
    harnessTools: extras?.harnessTools ?? areaTools,
    harnessModel: extras?.harnessModel ?? null,
    origin: extras?.origin ?? null,
    createdAt: new Date(profile.createdAt || now),
    updatedAt: now,
  };
}

export function asNormalizedAgent(row: {
  id: string;
  name: string;
  title: string;
  areaId: string;
  seniority: string;
  motivation: string;
  proactivity: string;
  systemContext: string;
  operatingStyle: string[] | null;
  goalTemplate: string;
  rawCompose: NormalizedAgentRow["rawCompose"];
  refinedByModel: boolean;
  orgHints: OrgHints | null;
  harnessTools: string[] | null;
  harnessModel: string | null;
  origin?: string | null;
  createdAt: Date | number;
  updatedAt: Date | number;
}): NormalizedAgentRow {
  return {
    ...row,
    origin: row.origin ?? null,
    operatingStyle: row.operatingStyle ?? [],
    harnessTools: row.harnessTools ?? [],
    createdAt:
      row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
  };
}

export function asNormalizedFile(row: {
  id: string;
  agentId: string;
  name: string;
  kind: string;
  content: string;
  createdAt: Date | number;
  updatedAt: Date | number;
}): NormalizedFileRow {
  return {
    ...row,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
  };
}
