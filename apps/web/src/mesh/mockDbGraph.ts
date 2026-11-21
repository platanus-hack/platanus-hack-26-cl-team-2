/** Shared mock-DB graph helpers for the Organización map. */

export type MockDbInfo = {
  tool: string;
  file: string;
  label: string;
  sensitivity: string;
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

/**
 * Current mock-DB tools grant read+write, so we emit both directions:
 * - read:  database → agent
 * - write: agent → database
 */
export function aclEdgesFromAgents(
  agents: Array<{ id: string; harnessTools?: string[] }>,
  databases: MockDbInfo[],
  opts?: { canRead?: boolean; canWrite?: boolean },
): AclEdge[] {
  const canRead = opts?.canRead ?? true;
  const canWrite = opts?.canWrite ?? true;
  const byTool = new Map(databases.map((db) => [db.tool, db]));
  const edges: AclEdge[] = [];
  for (const agent of agents) {
    for (const tool of agent.harnessTools ?? []) {
      const db = byTool.get(tool);
      if (!db) continue;
      const dbId = mockDbNodeId(tool);
      if (canRead) {
        edges.push({
          from: dbId,
          to: agent.id,
          label: `READ · ${db.file} → agente`,
          tool,
          access: "read",
        });
      }
      if (canWrite) {
        edges.push({
          from: agent.id,
          to: dbId,
          label: `WRITE · agente → ${db.file}`,
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
