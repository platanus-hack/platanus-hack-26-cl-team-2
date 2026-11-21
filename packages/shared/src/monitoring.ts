import type { RunSummary, TraceEvent } from "./index.js";

export type MonitoringRun = {
  run: RunSummary;
  events: TraceEvent[];
  judgment: { score: number; risks: Array<{ title: string; severity: string }> } | null;
};

export function summarizeMonitoring(snapshots: MonitoringRun[]) {
  const rows = snapshots.map(snapshot => {
    const events = [...new Map(snapshot.events.map(event => [event.id, event])).values()];
    const messages = events.filter(event => event.type === "agent.message_sent").length;
    const tools = events.filter(event => event.type === "agent.tool_call").length;
    const attempts = events.filter(event => event.type === "sandbox.tool_attempt");
    const risky = attempts.filter(event => event.payload.dangerous === true || event.payload.blocked === true).length;
    const blocked = attempts.filter(event => event.payload.blocked === true).length;
    const findings = snapshot.judgment?.risks.length ?? 0;
    const duration = snapshot.run.finishedAt ? Date.parse(snapshot.run.finishedAt) - Date.parse(snapshot.run.createdAt) : NaN;
    return { ...snapshot, messages, tools, interactions: messages + tools, risky, blocked, findings, flagged: risky > 0 || findings > 0, duration: Number.isFinite(duration) && duration >= 0 ? duration : null };
  });
  const interactions = rows.reduce((sum, row) => sum + row.interactions, 0);
  const judged = rows.filter(row => row.judgment && Number.isFinite(row.judgment.score));
  const durations = rows.filter(row => row.duration !== null);
  const riskyRuns = rows.filter(row => row.flagged).length;
  return {
    rows,
    interactions,
    messages: rows.reduce((sum, row) => sum + row.messages, 0),
    tools: rows.reduce((sum, row) => sum + row.tools, 0),
    risky: rows.reduce((sum, row) => sum + row.risky, 0),
    blocked: rows.reduce((sum, row) => sum + row.blocked, 0),
    findings: rows.reduce((sum, row) => sum + row.findings, 0),
    average: rows.length ? interactions / rows.length : null,
    riskyRuns,
    riskyRate: rows.length ? riskyRuns / rows.length * 100 : null,
    judged: judged.length,
    score: judged.length ? judged.reduce((sum, row) => sum + row.judgment!.score, 0) / judged.length : null,
    duration: durations.length ? durations.reduce((sum, row) => sum + row.duration!, 0) / durations.length : null,
  };
}
