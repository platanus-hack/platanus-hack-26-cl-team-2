/**
 * Communication weights (roadmap step 1). Counts who messaged whom in each run's trace and sums
 * it into a weighted, directed graph. No model call: it only reads `agent.message_sent` events.
 *
 * Injected peer messages (the operator forging "A → B" to start an attack) are left out: they
 * are the attack, not how the agents normally talk.
 */
import type { CommEdge, CommGraph, TraceEvent } from "@sandbox/shared";

export type RunPairCount = { from: string; to: string; messages: number };

/** Pure: messages per (from, to) in one trace. Exported for tests. */
export function countRunMessages(events: TraceEvent[]): RunPairCount[] {
  const counts = new Map<string, RunPairCount>();
  for (const event of events) {
    if (event.type !== "agent.message_sent" || event.payload.injected) continue;
    const message = event.payload.message as { fromAgentId?: unknown; toAgentId?: unknown } | undefined;
    const from = message?.fromAgentId;
    const to = message?.toAgentId;
    if (typeof from !== "string" || typeof to !== "string" || !from || !to || from === to) continue;
    const key = `${from}\u0000${to}`;
    const row = counts.get(key) ?? { from, to, messages: 0 };
    row.messages += 1;
    counts.set(key, row);
  }
  return [...counts.values()];
}

export type PairTotal = { from: string; to: string; messages: number; runs: number; lastAt: Date };

/**
 * Pure: turns per-pair totals into graph edges. Only pairs where both agents are still saved
 * count (runs with ad-hoc agents or deleted agents drop out). Exported for tests.
 */
export function buildCommGraph(totals: PairTotal[], savedAgentIds: Set<string>): CommGraph {
  const kept = totals.filter((t) => savedAgentIds.has(t.from) && savedAgentIds.has(t.to) && t.messages > 0);
  const sentBy = new Map<string, number>();
  for (const t of kept) sentBy.set(t.from, (sentBy.get(t.from) ?? 0) + t.messages);
  const busiest = Math.max(0, ...kept.map((t) => t.messages));
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const edges: CommEdge[] = kept
    .map((t) => ({
      from: t.from,
      to: t.to,
      messages: t.messages,
      runs: t.runs,
      share: round(t.messages / (sentBy.get(t.from) ?? t.messages)),
      weight: round(busiest ? t.messages / busiest : 0),
      lastAt: t.lastAt.toISOString(),
    }))
    .sort((a, b) => b.messages - a.messages || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  return {
    edges,
    totalMessages: kept.reduce((sum, t) => sum + t.messages, 0),
    runsWithMessages: 0, // filled by the repository, which knows the run ids
  };
}
