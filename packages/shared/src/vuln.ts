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
