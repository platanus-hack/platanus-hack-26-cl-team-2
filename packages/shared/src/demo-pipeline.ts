/** DEMO SIM pipeline: communication learn (Paso 1) + chain attack (Paso 2). */

export const COMM_TRENDS_HEADING = "## Tendencias de comunicación";

export type DemoCommEdge = {
  from: string;
  to: string;
  about: string;
  frequencyHint: string;
};

export type DemoBusinessScenario = {
  title: string;
  businessProblem: string;
  seedAgentId: string;
  /** Free-text seed for the sandbox (preferred when no peerMessage). */
  scenarioHint?: string;
  peerMessage?: {
    fromAgentId: string;
    toAgentId: string;
    body: string;
  };
  rationale: string;
};

export type DemoCommPatterns = {
  edges: DemoCommEdge[];
  notes: string;
};

export type DemoChainActionKind = "scenarioHint" | "peerMessage";

export type DemoChainAction = {
  kind: DemoChainActionKind;
  label: string;
  seedAgentId: string;
  scenarioHint?: string;
  peerMessage?: {
    fromAgentId: string;
    toAgentId: string;
    body: string;
  };
};

export type DemoChainAttackDesign = {
  attackSurface: string;
  actions: DemoChainAction[];
  successCriteria: string;
  rationale: string;
};

export type DemoChainEval = {
  empty: boolean;
  surface: string;
  failuresAmplifications: string[];
  actionableRemediations: string[];
  scoreSummary: string;
};

export type DemoChainDiagnosis = {
  whyEmpty: string;
  llmInteractionReview: string;
  improvedHackPrompt: string;
};

export function appendCommTrends(
  context: string,
  trendsMarkdown: string,
): string {
  const body = trendsMarkdown.trim();
  if (!body) return context.trim();
  const section = body.startsWith(COMM_TRENDS_HEADING)
    ? body
    : `${COMM_TRENDS_HEADING}\n${body}`;
  const base = context.trim();
  const idx = base.indexOf(COMM_TRENDS_HEADING);
  if (idx < 0) {
    return `${base}\n\n${section}`.trim();
  }
  const before = base.slice(0, idx).trimEnd();
  // Drop previous trends section (until next ## or EOF).
  const afterRaw = base.slice(idx + COMM_TRENDS_HEADING.length);
  const nextHeading = afterRaw.search(/\n## /);
  const after =
    nextHeading >= 0 ? afterRaw.slice(nextHeading).trimStart() : "";
  return [before, section, after].filter(Boolean).join("\n\n").trim();
}

export function hasCommTrendsSection(context: string): boolean {
  return context.includes(COMM_TRENDS_HEADING);
}
