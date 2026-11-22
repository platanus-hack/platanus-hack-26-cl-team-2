import { eq } from "drizzle-orm";
import type { FlowGraph } from "@sandbox/shared";
import { getDbDriver, getPgDb, getSqliteDb } from "./client.js";
import { flowGraphs } from "./schema.pg.js";
import { flowGraphsSqlite } from "./schema.sqlite.js";

export async function getFlowGraph(companyName: string): Promise<FlowGraph | null> {
  const name = companyName.trim();
  if (!name) return null;
  if (getDbDriver() === "sqlite") {
    const [row] = await getSqliteDb()
      .select()
      .from(flowGraphsSqlite)
      .where(eq(flowGraphsSqlite.companyName, name))
      .limit(1);
    if (!row) return null;
    return { companyName: row.companyName, nodes: row.nodes, edges: row.edges };
  }
  const [row] = await getPgDb()
    .select()
    .from(flowGraphs)
    .where(eq(flowGraphs.companyName, name))
    .limit(1);
  if (!row) return null;
  return { companyName: row.companyName, nodes: row.nodes, edges: row.edges };
}

export async function saveFlowGraph(graph: FlowGraph): Promise<FlowGraph> {
  const companyName = graph.companyName.trim();
  const values = {
    companyName,
    nodes: graph.nodes,
    edges: graph.edges,
    updatedAt: new Date(),
  };
  if (getDbDriver() === "sqlite") {
    await getSqliteDb()
      .insert(flowGraphsSqlite)
      .values(values)
      .onConflictDoUpdate({
        target: flowGraphsSqlite.companyName,
        set: { nodes: values.nodes, edges: values.edges, updatedAt: values.updatedAt },
      });
  } else {
    await getPgDb()
      .insert(flowGraphs)
      .values(values)
      .onConflictDoUpdate({
        target: flowGraphs.companyName,
        set: { nodes: values.nodes, edges: values.edges, updatedAt: values.updatedAt },
      });
  }
  return { companyName, nodes: graph.nodes, edges: graph.edges };
}
