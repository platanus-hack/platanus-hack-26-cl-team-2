/** Shared mock-DB graph helpers for the Organización map. */

export type MockDbInfo = {
  tool: string;
  file: string;
  label: string;
  sensitivity: string;
  /** DEMO files expose separate read/write tools. */
  readTool?: string;
  writeTool?: string;
};

export type MockDbNode = MockDbInfo & {
  id: string;
  name: string;
  kind: "database";
  x: number;
  y: number;
};

export type AclAccess = "read" | "write";

export type AclEdge = {
  from: string;
  to: string;
  label: string;
  tool: string;
  /** read = DB → agent; write = agent → DB */
  access: AclAccess;
};

/** Fallback if `/api/mock-db` is unreachable. */
export const FALLBACK_MOCK_DBS: MockDbInfo[] = [
  {
    tool: "credit_cards_db",
    file: "credit_cards.txt",
    label: "Credit cards DB",
    sensitivity: "payment",
  },
  {
    tool: "users_health_db",
    file: "users_health.txt",
    label: "Users health DB",
    sensitivity: "health",
  },
  {
    tool: "user_keys_db",
    file: "user_keys.txt",
    label: "User keys DB",
    sensitivity: "secrets",
  },
];

export function mockDbNodeId(tool: string): string {
  return `mockdb:${tool}`;
}

export function layoutMockDbNodes(
  databases: MockDbInfo[],
  opts?: { originX?: number; originY?: number; gapY?: number },
): MockDbNode[] {
  const originX = opts?.originX ?? 820;
  const originY = opts?.originY ?? 130;
  const gapY = opts?.gapY ?? 180;
  return databases.map((db, index) => ({
    ...db,
    id: mockDbNodeId(db.tool),
    name: db.file,
    kind: "database" as const,
    x: originX,
    y: originY + index * gapY,
  }));
}

function indexToolAccess(
  databases: MockDbInfo[],
): Map<string, { db: MockDbInfo; access: AclAccess | "both" }> {
  const map = new Map<string, { db: MockDbInfo; access: AclAccess | "both" }>();
  for (const db of databases) {
    if (db.readTool || db.writeTool) {
      if (db.readTool) map.set(db.readTool, { db, access: "read" });
      if (db.writeTool) map.set(db.writeTool, { db, access: "write" });
      continue;
    }
    map.set(db.tool, { db, access: "both" });
  }
  return map;
}

/**
 * Emit ACL edges from harness tools.
 * Static mock-DBs grant read+write with one tool.
 * DEMO files use separate `_txt_read` / `_txt_write` tools.
 */
export function aclEdgesFromAgents(
  agents: Array<{ id: string; harnessTools?: string[] }>,
  databases: MockDbInfo[],
  opts?: { canRead?: boolean; canWrite?: boolean },
): AclEdge[] {
  const canRead = opts?.canRead ?? true;
  const canWrite = opts?.canWrite ?? true;
  const byTool = indexToolAccess(databases);
  const edges: AclEdge[] = [];

  for (const agent of agents) {
    for (const tool of agent.harnessTools ?? []) {
      const hit = byTool.get(tool);
      if (!hit) continue;
      const dbId = mockDbNodeId(hit.db.tool);
      const wantRead = hit.access === "read" || hit.access === "both";
      const wantWrite = hit.access === "write" || hit.access === "both";
      if (canRead && wantRead) {
        edges.push({
          from: dbId,
          to: agent.id,
          label: `READ · ${hit.db.file} → agente`,
          tool,
          access: "read",
        });
      }
      if (canWrite && wantWrite) {
        edges.push({
          from: agent.id,
          to: dbId,
          label: `WRITE · agente → ${hit.db.file}`,
          tool,
          access: "write",
        });
      }
    }
  }
  return edges;
}

/** Slight offset so read/write pairs between the same nodes don't overlap. */
export function offsetEdgePoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  access: AclAccess,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const mag = access === "read" ? 8 : -8;
  return {
    x1: x1 + nx * mag,
    y1: y1 + ny * mag,
    x2: x2 + nx * mag,
    y2: y2 + ny * mag,
  };
}
