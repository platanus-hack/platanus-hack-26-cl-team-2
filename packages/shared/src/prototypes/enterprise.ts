import { AREA_IDS, getArea } from "./areas/index.js";
import { composeProfile } from "./compose.js";
import type {
  AgentProfile,
  AreaHeadcount,
  ComposeEnterpriseInput,
  Motivation,
  OrgSizePreset,
  Proactivity,
  Seniority,
  SeniorityMix,
} from "./types.js";

/**
 * Preset = exact total agents to generate, distributed across areas
 * (SaaS-ish weights: Eng heavy, then GTM/CS, then CSM/Product/Data/IT).
 * 100 → 100 agents, 200 → 200, 400 → 400.
 */
export const ENTERPRISE_PRESETS: Record<OrgSizePreset, AreaHeadcount> = {
  100: {
    gtm: 13,
    csm: 10,
    cs: 13,
    engineering: 27,
    product_design: 12,
    data: 8,
    it: 9,
    finance: 8,
  },
  200: {
    gtm: 26,
    csm: 20,
    cs: 26,
    engineering: 54,
    product_design: 24,
    data: 16,
    it: 18,
    finance: 16,
  },
  400: {
    gtm: 52,
    csm: 40,
    cs: 52,
    engineering: 108,
    product_design: 48,
    data: 32,
    it: 36,
    finance: 32,
  },
};

export const DEFAULT_SENIORITY_MIX: SeniorityMix = {
  junior: 0.25,
  mid: 0.5,
  senior: 0.25,
};

const MOTIVATIONS: Motivation[] = [
  "quality",
  "speed",
  "compliance",
  "impact",
  "recognition",
];

const PROACTIVITIES: Proactivity[] = ["low", "medium", "high"];

/** Deterministic seniority slots: ~25% junior, 50% mid, 25% senior. */
export function allocateSeniorities(
  count: number,
  mix: SeniorityMix = DEFAULT_SENIORITY_MIX,
): Seniority[] {
  if (count <= 0) return [];
  if (count === 1) return ["mid"];

  let juniors = Math.round(count * mix.junior);
  let seniors = Math.round(count * mix.senior);
  let mids = count - juniors - seniors;

  if (mids < 0) {
    const overflow = -mids;
    if (juniors >= seniors) juniors = Math.max(0, juniors - overflow);
    else seniors = Math.max(0, seniors - overflow);
    mids = count - juniors - seniors;
  }

  while (juniors + mids + seniors < count) mids += 1;
  while (juniors + mids + seniors > count) {
    if (mids > 0) mids -= 1;
    else if (juniors > 0) juniors -= 1;
    else seniors -= 1;
  }

  const slots: Seniority[] = [
    ...Array.from({ length: juniors }, () => "junior" as const),
    ...Array.from({ length: mids }, () => "mid" as const),
    ...Array.from({ length: seniors }, () => "senior" as const),
  ];

  // Stable shuffle by count so fleets aren't always junior-first visually.
  return rotate(slots, count % Math.max(slots.length, 1));
}

function rotate<T>(arr: T[], by: number): T[] {
  if (arr.length === 0) return arr;
  const n = ((by % arr.length) + arr.length) % arr.length;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

export function normalizeCounts(
  partial: Partial<AreaHeadcount>,
): AreaHeadcount {
  const counts = {} as AreaHeadcount;
  for (const id of AREA_IDS) {
    const n = partial[id] ?? 0;
    counts[id] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  return counts;
}

export function totalAgents(counts: AreaHeadcount): number {
  return AREA_IDS.reduce((sum, id) => sum + counts[id], 0);
}

export function resolveSeniorityMix(
  partial?: Partial<SeniorityMix>,
): SeniorityMix {
  const mix = {
    junior: partial?.junior ?? DEFAULT_SENIORITY_MIX.junior,
    mid: partial?.mid ?? DEFAULT_SENIORITY_MIX.mid,
    senior: partial?.senior ?? DEFAULT_SENIORITY_MIX.senior,
  };
  const sum = mix.junior + mix.mid + mix.senior;
  if (sum <= 0) return { ...DEFAULT_SENIORITY_MIX };
  return {
    junior: mix.junior / sum,
    mid: mix.mid / sum,
    senior: mix.senior / sum,
  };
}

/**
 * Pure deterministic enterprise fleet generator.
 * NO LLM calls — templates + knobs only.
 */
export function composeEnterprise(input: ComposeEnterpriseInput): {
  profiles: AgentProfile[];
  counts: AreaHeadcount;
  seniorityMix: SeniorityMix;
  companyName: string;
} {
  const companyName = input.companyName?.trim() || "Acme Corp";
  const base =
    input.orgSizePreset != null
      ? ENTERPRISE_PRESETS[input.orgSizePreset]
      : undefined;

  const counts = normalizeCounts({
    ...(base ?? {}),
    ...input.counts,
  });

  const seniorityMix = resolveSeniorityMix(input.seniorityMix);
  const profiles: AgentProfile[] = [];
  let globalIndex = 0;

  for (const areaId of AREA_IDS) {
    const n = counts[areaId];
    if (n <= 0) continue;
    const area = getArea(areaId);
    const seniorities = allocateSeniorities(n, seniorityMix);

    for (let i = 0; i < n; i++) {
      const seniority = seniorities[i] ?? "mid";
      const motivation = MOTIVATIONS[(globalIndex + i) % MOTIVATIONS.length];
      const proactivity =
        PROACTIVITIES[(globalIndex * 2 + i) % PROACTIVITIES.length];

      const profile = composeProfile({
        areaId,
        knobs: { seniority, motivation, proactivity },
        name: `${area.label} ${i + 1}`,
        orgHints: {
          companyName,
          notes: `enterprise-generator · preset=${input.orgSizePreset ?? "custom"} · no-ai`,
        },
      });

      // Never mark as model-refined — bulk path is templates only.
      profiles.push({
        ...profile,
        refinedByModel: false,
      });
      globalIndex += 1;
    }
  }

  return { profiles, counts, seniorityMix, companyName };
}

export function emptyCounts(): AreaHeadcount {
  return normalizeCounts({});
}

export function onesAcrossAreas(): AreaHeadcount {
  const counts = emptyCounts();
  for (const id of AREA_IDS) counts[id] = 1;
  return counts;
}
