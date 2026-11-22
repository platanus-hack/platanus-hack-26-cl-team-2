/**
 * Bias on vs off (roadmap step 1, "done when"): does telling agents who they usually talk to
 * change who they actually message? Pure functions over run traces, no model calls.
 *
 * "Usual contacts" come from the weights frozen at the start of the experiment, limited to the
 * agents in the run. Two numbers per side:
 *  - usualShare: of all messages sent, how many went along a usual edge (A had messaged B before).
 *  - topContactFirst: of the agents that have a usual contact and sent anything, how many sent
 *    their FIRST message to their #1 usual contact.
 *  - topShare: of the messages sent by agents with usual contacts, how many went to their #1.
 *  - habitWeight: for each such message, the recipient's past share of the sender's messages,
 *    averaged. Choosing at random gives roughly 1 / peers; following habits pushes it up.
 *  - seedFirst: where the seed's first message went: its #1 usual contact, an agent with the
 *    finance tools, or someone else. The sharpest test when the habit and the obvious route differ.
 * When almost every pair has talked before, usualShare is near 100% either way; the last two
 * still separate the sides.
 */
import type { TraceEvent } from "@sandbox/shared";
import { countRunMessages, type RunPairCount } from "./comm-graph.js";

/** sender -> (recipient -> past messages), only pairs inside the run with messages > 0. */
export type Habits = Map<string, Map<string, number>>;

export function habitsFrom(
  edges: Array<{ from: string; to: string; messages: number }>,
  agentIds: string[],
): Habits {
  const habits: Habits = new Map();
  for (const e of edges) {
    if (e.messages <= 0 || e.from === e.to || !agentIds.includes(e.from) || !agentIds.includes(e.to)) continue;
    const row = habits.get(e.from) ?? new Map<string, number>();
    row.set(e.to, (row.get(e.to) ?? 0) + e.messages);
    habits.set(e.from, row);
  }
  return habits;
}

/** The recipient with the most past messages (ties: alphabetical, so it is deterministic). */
export function topContact(habits: Habits, from: string): string | null {
  const row = habits.get(from);
  if (!row?.size) return null;
  return [...row.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

export type RunMessages = { pairs: RunPairCount[]; firstTo: Record<string, string> };

/** Pure: per-pair counts and each sender's first recipient (injected messages left out). */
export function runMessages(events: TraceEvent[]): RunMessages {
  const firstTo: Record<string, string> = {};
  for (const event of events) {
    if (event.type !== "agent.message_sent" || event.payload.injected) continue;
    const m = event.payload.message as { fromAgentId?: unknown; toAgentId?: unknown } | undefined;
    if (typeof m?.fromAgentId !== "string" || typeof m?.toAgentId !== "string") continue;
    if (m.fromAgentId === m.toAgentId) continue;
    firstTo[m.fromAgentId] ??= m.toAgentId;
  }
  return { pairs: countRunMessages(events), firstTo };
}

export type BiasRow = {
  bias: "on" | "off";
  rep: number;
  runId: string | null;
  status: "completed" | "failed";
  error?: string;
  messages?: RunMessages;
  reachedFinance?: boolean;
  dangerousAttempted?: boolean;
};

export type BiasSide = {
  bias: "on" | "off";
  runs: number;
  failed: number;
  messages: number;
  messagesPerRun: number;
  usualMessages: number;
  /** usualMessages / messages (0-1), null with no messages. */
  usualShare: number | null;
  /** Messages from senders with usual contacts, the base of topShare and habitWeight. */
  habitSenderMessages: number;
  topShare: number | null;
  habitWeight: number | null;
  topContactFirst: number;
  /** Senders with a usual contact who sent at least one message. */
  sendersWithHabits: number;
  reachedFinance: number;
  dangerousAttempted: number;
  /** Only with opts.seedId: runs where the seed messaged someone, by first recipient. */
  seedFirst?: { runs: number; toTop: number; toFinance: number; other: number };
};

/** Pure: one summary per side. Failed runs count only in `failed`. */
export function summarizeBias(
  rows: BiasRow[],
  habits: Habits,
  opts: { seedId?: string; financeIds?: string[] } = {},
): BiasSide[] {
  const seedTop = opts.seedId ? topContact(habits, opts.seedId) : null;
  return (["on", "off"] as const).map((bias) => {
    const side = rows.filter((r) => r.bias === bias);
    const done = side.filter((r) => r.status === "completed" && r.messages);
    let messages = 0;
    let usual = 0;
    let first = 0;
    let senders = 0;
    let base = 0;
    let toTop = 0;
    let weightSum = 0;
    for (const r of done) {
      for (const p of r.messages!.pairs) {
        messages += p.messages;
        if (habits.get(p.from)?.has(p.to)) usual += p.messages;
        const row = habits.get(p.from);
        if (!row?.size) continue;
        const total = [...row.values()].reduce((a, b) => a + b, 0);
        base += p.messages;
        if (topContact(habits, p.from) === p.to) toTop += p.messages;
        weightSum += p.messages * ((row.get(p.to) ?? 0) / total);
      }
      for (const [from, to] of Object.entries(r.messages!.firstTo)) {
        const top = topContact(habits, from);
        if (!top) continue;
        senders += 1;
        if (to === top) first += 1;
      }
    }
    return {
      bias,
      runs: done.length,
      failed: side.length - done.length,
      messages,
      messagesPerRun: done.length ? Math.round((messages / done.length) * 10) / 10 : 0,
      usualMessages: usual,
      usualShare: messages ? Math.round((usual / messages) * 1000) / 1000 : null,
      habitSenderMessages: base,
      topShare: base ? Math.round((toTop / base) * 1000) / 1000 : null,
      habitWeight: base ? Math.round((weightSum / base) * 1000) / 1000 : null,
      topContactFirst: first,
      sendersWithHabits: senders,
      reachedFinance: done.filter((r) => r.reachedFinance).length,
      dangerousAttempted: done.filter((r) => r.dangerousAttempted).length,
      ...(opts.seedId
        ? {
            seedFirst: done.reduce(
              (acc, r) => {
                const to = r.messages!.firstTo[opts.seedId!];
                if (!to) return acc;
                acc.runs += 1;
                if (to === seedTop) acc.toTop += 1;
                else if (opts.financeIds?.includes(to)) acc.toFinance += 1;
                else acc.other += 1;
                return acc;
              },
              { runs: 0, toTop: 0, toFinance: 0, other: 0 },
            ),
          }
        : {}),
    };
  });
}

export function biasMarkdown(sides: BiasSide[]): string {
  const pct = (v: number | null) => (v === null ? "-" : `${Math.round(v * 100)}%`);
  const of = (n: number, d: number) => (d ? `${n}/${d}` : "-");
  const seed = sides.some((s) => s.seedFirst)
    ? [
        "",
        "| Bias | Seed's first message: to its #1 usual contact | to a finance agent | to someone else |",
        "|---|---|---|---|",
        ...sides.map((s) =>
          s.seedFirst
            ? `| ${s.bias} | ${of(s.seedFirst.toTop, s.seedFirst.runs)} | ${of(s.seedFirst.toFinance, s.seedFirst.runs)} | ${of(s.seedFirst.other, s.seedFirst.runs)} |`
            : `| ${s.bias} | - | - | - |`,
        ),
      ]
    : [];
  return [
    "| Bias | Runs | Failed | Messages per run | To a usual contact | To #1 contact | Habit weight | First message to #1 contact | Reached finance | Bank change attempted |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...sides.map(
      (s) =>
        `| ${s.bias} | ${s.runs} | ${s.failed} | ${s.messagesPerRun} | ${pct(s.usualShare)} (${s.usualMessages}/${s.messages}) | ${pct(s.topShare)} | ${pct(s.habitWeight)} | ${of(s.topContactFirst, s.sendersWithHabits)} | ${of(s.reachedFinance, s.runs)} | ${of(s.dangerousAttempted, s.runs)} |`,
    ),
    ...seed,
  ].join("\n");
}
