/** Vulnerability assessment taxonomy for single-agent sandbox evals. */

export const VULN_CATEGORIES = [
  "instruction_override",
  "indirect_injection",
  "tool_misuse",
  "data_exfiltration",
  "social_engineering",
  "secret_handling",
] as const;

export type VulnCategory = (typeof VULN_CATEGORIES)[number];

export type VulnScores = Record<VulnCategory, number>;

export type VulnCategoryNotes = Partial<Record<VulnCategory, string>>;

/** One attack scenario designed by the LLM for a category. */
export type VulnScenarioBrief = {
  category: VulnCategory;
  title: string;
  scenarioHint: string;
  grantFinanceTools: boolean;
  rationale: string;
};

export type VulnDesignerBrief = {
  classification?: { areaId: import("./prototypes/types.js").AreaId; function: string; rationale: string };
  scenarios: VulnScenarioBrief[];
};

export type AgentVulnAssessment = {
  id: string;
  agentId: string;
  scores: VulnScores;
  summary: string;
  categoryNotes: VulnCategoryNotes;
  designerBrief: VulnDesignerBrief | null;
  runIds: string[];
  harnessSnapshot: {
    areaId: string;
    title: string;
    harnessTools: string[];
    knobs: {
      seniority: string;
      motivation: string;
      proactivity: string;
    };
  } | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
};

export function emptyVulnScores(fill = 50): VulnScores {
  return {
    instruction_override: fill,
    indirect_injection: fill,
    tool_misuse: fill,
    data_exfiltration: fill,
    social_engineering: fill,
    secret_handling: fill,
  };
}

export function clampVulnScore(raw: unknown, fallback = 50): number {
  let n: number | null = null;
  if (typeof raw === "number" && Number.isFinite(raw)) n = raw;
  else if (typeof raw === "string") {
    const m = raw.trim().match(/-?\d+(\.\d+)?/);
    if (m) {
      const parsed = Number(m[0]);
      if (Number.isFinite(parsed)) n = parsed;
    }
  }
  if (n == null) return fallback;
  return Math.min(100, Math.max(1, Math.round(n)));
}

export function normalizeVulnScores(
  raw: Partial<Record<string, unknown>> | null | undefined,
): VulnScores {
  const out = emptyVulnScores(50);
  if (!raw || typeof raw !== "object") return out;
  for (const cat of VULN_CATEGORIES) {
    if (cat in raw) out[cat] = clampVulnScore(raw[cat], out[cat]);
  }
  return out;
}

export function isVulnCategory(value: string): value is VulnCategory {
  return (VULN_CATEGORIES as readonly string[]).includes(value);
}

/** Top categories by score (descending), for summary hints. */
export function topVulnCategories(
  scores: VulnScores,
  n = 2,
): VulnCategory[] {
  return [...VULN_CATEGORIES]
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, n);
}

/* ── Batch evaluation ("evaluate every agent with one click") ─────────────── */

export type VulnBatchStatus = "running" | "completed" | "stopped" | "failed";
export type VulnBatchResultStatus = "pending" | "ok" | "failed";

/** One agent inside a batch: its scores before the batch and after it. */
export type VulnBatchResult = {
  agentId: string;
  agentName: string;
  status: VulnBatchResultStatus;
  /** Assessment stored before the batch started (null: never evaluated). */
  previousScores: VulnScores | null;
  /** Assessment stored when this agent finished in the batch. */
  scores: VulnScores | null;
  summary: string;
  runIds: string[];
  error: string | null;
  finishedAt: string | null;
};

export type VulnBatchSettings = {
  /** Rounds of the 6 scenarios per agent (each round is scored). */
  iterations: number;
  maxTurnsPerAgent: number;
  /** Agents evaluated at the same time by the client. */
  concurrency: number;
};

export type VulnBatchEstimate = {
  agents: number;
  /** Solo sandbox runs (agents × scenarios × iterations). */
  runs: number;
  /** Upper bound on model calls: designer + every agent turn + scorer. */
  maxModelCalls: number;
  /** Rough upper bound in US$, from fixed token assumptions per call. */
  approxMaxUsd: number;
};

export type VulnBatch = {
  id: string;
  status: VulnBatchStatus;
  settings: VulnBatchSettings;
  estimate: VulnBatchEstimate;
  results: VulnBatchResult[];
  createdAt: string;
  finishedAt: string | null;
};

/** Mean of the six category scores, rounded. */
export function meanVulnScore(scores: VulnScores): number {
  const total = VULN_CATEGORIES.reduce((sum, cat) => sum + scores[cat], 0);
  return Math.round(total / VULN_CATEGORIES.length);
}
