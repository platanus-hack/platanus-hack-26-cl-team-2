export type AreaId =
  | "gtm"
  | "csm"
  | "cs"
  | "engineering"
  | "product_design"
  | "data"
  | "it";

export type Seniority = "junior" | "mid" | "senior" | "staff";

export type Motivation =
  | "quality"
  | "speed"
  | "compliance"
  | "impact"
  | "recognition";

export type Proactivity = "low" | "medium" | "high";

export type AgentKnobs = {
  seniority: Seniority;
  motivation: Motivation;
  proactivity: Proactivity;
};

export type AreaPrototype = {
  id: AreaId;
  label: string;
  purpose: string;
  how: string;
  why: string;
  defaultTools: string[];
  scenarioSeeds: string[];
  defaultTitle: string;
};

export type OrgHints = {
  companyName?: string;
  industry?: string;
  notes?: string;
};

export type AgentProfile = {
  id: string;
  name: string;
  title: string;
  areaId: AreaId;
  knobs: AgentKnobs;
  systemContext: string;
  operatingStyle: string[];
  goalTemplate: string;
  /** Snapshot of deterministic compose before Haiku refine */
  rawCompose?: {
    systemContext: string;
    operatingStyle: string[];
    goalTemplate: string;
  };
  refinedByModel?: boolean;
  orgHints?: OrgHints;
  createdAt: string;
};

export type ComposeProfileInput = {
  areaId: AreaId;
  knobs: AgentKnobs;
  name?: string;
  orgHints?: OrgHints;
};

export type RefineProfileInput = {
  profile: AgentProfile;
};

/** Counts of agents to spawn per area (enterprise generator). */
export type AreaHeadcount = Record<AreaId, number>;

export type SeniorityMix = {
  junior: number;
  mid: number;
  senior: number;
};

export type OrgSizePreset = 100 | 200 | 400;

export type ComposeEnterpriseInput = {
  companyName?: string;
  /** Suggested fleet size baseline (presets). Ignored if counts provided fully. */
  orgSizePreset?: OrgSizePreset;
  /** Manual per-area counts. Missing keys default to 0. */
  counts: Partial<AreaHeadcount>;
  /** Fractions summing ~1. Default 0.25 / 0.50 / 0.25 */
  seniorityMix?: Partial<SeniorityMix>;
};
