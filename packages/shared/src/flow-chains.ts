/**
 * Determined communication output.
 * One case is a chain of agent names joined by commas: "A,B,C,D".
 * A connection is each consecutive pair, counted at face value across every chain.
 */

export type FlowHop = { from: string; to: string };

export type FlowConnection = { from: string; to: string; count: number };

export type FlowGraphNode = {
  agentId: string;
  label: string;
  /** Times this agent handed work to someone else. */
  weight: number;
};

export type FlowGraphEdge = {
  fromAgentId: string;
  toAgentId: string;
  from: string;
  to: string;
  /** Face-value count of this directed hop across every chain. */
  weight: number;
};

export type FlowGraph = {
  companyName: string;
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
};

const NODE_SEP = ",";

/** Names stay one node. Commas would split the chain. */
export function nodeLabel(name: string): string {
  return name.replace(/,/g, " ").replace(/\s+/g, " ").trim();
}

/** Walk real messages in order. The seed is always the first node. */
export function chainFromHops(seed: string, hops: FlowHop[]): string[] {
  const nodes = [nodeLabel(seed) || "Agente"];
  for (const hop of hops) {
    const from = nodeLabel(hop.from);
    const to = nodeLabel(hop.to);
    if (!from || !to) continue;
    if (nodes[nodes.length - 1] !== from) nodes.push(from);
    if (nodes[nodes.length - 1] !== to) nodes.push(to);
  }
  return nodes;
}

export function formatChain(nodes: string[]): string {
  return nodes.join(NODE_SEP);
}

export function parseChain(line: string): string[] {
  return line.split(NODE_SEP).map((part) => part.trim()).filter(Boolean);
}

/** Read the chain lines and count each consecutive connection. */
export function tallyChainLines(lines: string[]): FlowConnection[] {
  const counts = new Map<string, FlowConnection>();
  for (const line of lines) {
    const nodes = parseChain(line);
    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i]!;
      const to = nodes[i + 1]!;
      const key = `${from}\0${to}`;
      const row = counts.get(key);
      if (row) row.count += 1;
      else counts.set(key, { from, to, count: 1 });
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.from.localeCompare(b.from, "es") || a.to.localeCompare(b.to, "es"),
  );
}

/** Directed graph from id-chains. Node weight is the sum of outgoing edge weights. */
export function graphFromIdChains(
  companyName: string,
  idChains: string[][],
  labels: Record<string, string>,
): FlowGraph {
  const tallies = tallyChainLines(idChains.map((chain) => formatChain(chain)));
  const outgoing = new Map<string, number>();
  const present = new Set<string>();
  for (const chain of idChains) {
    for (const agentId of chain) if (agentId) present.add(agentId);
  }
  const edges: FlowGraphEdge[] = tallies.map((row) => {
    outgoing.set(row.from, (outgoing.get(row.from) ?? 0) + row.count);
    present.add(row.from);
    present.add(row.to);
    return {
      fromAgentId: row.from,
      toAgentId: row.to,
      from: labels[row.from] || row.from,
      to: labels[row.to] || row.to,
      weight: row.count,
    };
  });
  const nodes = [...present]
    .map((agentId) => ({
      agentId,
      label: labels[agentId] || agentId,
      weight: outgoing.get(agentId) ?? 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  return { companyName, nodes, edges };
}
