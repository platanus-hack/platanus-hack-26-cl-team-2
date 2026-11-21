import { AREA_LIST, getArea } from "./areas/index.js";
import type {
  AgentKnobs,
  AgentProfile,
  AreaPrototype,
  ComposeProfileInput,
  Motivation,
  OrgHints,
  Proactivity,
  Seniority,
} from "./types.js";

const SENIORITY_MOD: Record<
  Seniority,
  { autonomy: string; depth: string; escalateWhen: string; titlePrefix: string }
> = {
  junior: {
    autonomy: "Ask for confirmation before irreversible actions.",
    depth: "Prefer playbooks and clear examples over novel judgment.",
    escalateWhen: "Escalate early when uncertain or when policy is ambiguous.",
    titlePrefix: "Junior",
  },
  mid: {
    autonomy: "Act within known policy; escalate only material risk.",
    depth: "Balance judgment with documented process.",
    escalateWhen: "Escalate when impact is cross-team or financially material.",
    titlePrefix: "",
  },
  senior: {
    autonomy: "Own decisions end-to-end; document rationale.",
    depth: "Challenge weak plans; propose concrete tradeoffs.",
    escalateWhen: "Escalate only when authority or legal risk is exceeded.",
    titlePrefix: "Senior",
  },
  staff: {
    autonomy: "Set direction for the situation; unblock others.",
    depth: "Think in systems and second-order effects.",
    escalateWhen: "Escalate to execs only for org-level risk or precedent-setting calls.",
    titlePrefix: "Staff",
  },
};

const MOTIVATION_MOD: Record<
  Motivation,
  { optimizes: string; sacrifices: string; bias: string }
> = {
  quality: {
    optimizes: "correctness, clarity, and long-term maintainability",
    sacrifices: "raw speed when quality is at risk",
    bias: "Will slow down to verify rather than ship a fragile answer.",
  },
  speed: {
    optimizes: "time-to-resolution and momentum",
    sacrifices: "exhaustive analysis when a good-enough path exists",
    bias: "Prefers a reversible fast move over a perfect delayed one.",
  },
  compliance: {
    optimizes: "policy adherence and auditability",
    sacrifices: "convenience and informal shortcuts",
    bias: "Refuses actions that lack an evidence trail.",
  },
  impact: {
    optimizes: "customer/business outcome",
    sacrifices: "process purity when outcome is clearly better",
    bias: "Frames every choice in terms of measurable effect.",
  },
  recognition: {
    optimizes: "visible wins and stakeholder credit",
    sacrifices: "quiet behind-the-scenes work when visibility is low",
    bias: "Surfaces progress early and seeks acknowledgment of ownership.",
  },
};

const PROACTIVITY_MOD: Record<
  Proactivity,
  { stance: string; initiation: string }
> = {
  low: {
    stance: "Respond when asked; do not invent extra workstreams.",
    initiation: "Wait for clear ownership signals before acting.",
  },
  medium: {
    stance: "Propose the next step after diagnosing the situation.",
    initiation: "Offer options, then proceed if unblocked.",
  },
  high: {
    stance: "Drive the thread; assign owners and push for closure.",
    initiation: "Start actions quickly and narrate intent as you go.",
  },
};

function titleFor(area: AreaPrototype, seniority: Seniority): string {
  const prefix = SENIORITY_MOD[seniority].titlePrefix;
  return prefix ? `${prefix} ${area.defaultTitle}` : area.defaultTitle;
}

function defaultName(area: AreaPrototype, knobs: AgentKnobs): string {
  return `${titleFor(area, knobs.seniority)}`;
}

function buildOperatingStyle(knobs: AgentKnobs): string[] {
  const s = SENIORITY_MOD[knobs.seniority];
  const m = MOTIVATION_MOD[knobs.motivation];
  const p = PROACTIVITY_MOD[knobs.proactivity];
  return [
    s.autonomy,
    s.depth,
    s.escalateWhen,
    `Optimizes for ${m.optimizes}; willingly sacrifices ${m.sacrifices}.`,
    m.bias,
    p.stance,
    p.initiation,
  ];
}

function buildSystemContext(
  area: AreaPrototype,
  knobs: AgentKnobs,
  name: string,
  title: string,
  orgHints?: OrgHints,
): string {
  const s = SENIORITY_MOD[knobs.seniority];
  const m = MOTIVATION_MOD[knobs.motivation];
  const p = PROACTIVITY_MOD[knobs.proactivity];
  const orgLine = [
    orgHints?.companyName
      ? `You work at ${orgHints.companyName}.`
      : "You work inside a mid-size company with real cross-functional pressure.",
    orgHints?.industry ? `Industry context: ${orgHints.industry}.` : null,
    orgHints?.notes ? `Org notes: ${orgHints.notes}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    `You are ${name}, ${title} in the ${area.label} area.`,
    orgLine,
    "",
    `Area purpose: ${area.purpose}`,
    `How this area works: ${area.how}`,
    `Why this area exists: ${area.why}`,
    "",
    "Behavioral modifiers (from knobs):",
    `- Seniority (${knobs.seniority}): ${s.autonomy} ${s.depth} ${s.escalateWhen}`,
    `- Motivation (${knobs.motivation}): optimize ${m.optimizes}; sacrifice ${m.sacrifices}. ${m.bias}`,
    `- Proactivity (${knobs.proactivity}): ${p.stance} ${p.initiation}`,
    "",
    "Hard rules:",
    "- Stay in your area's mandate unless explicitly coordinating.",
    "- Do not invent tool results, approvals, or facts.",
    "- Prefer short, concrete next actions.",
    `- Logical tools available later: ${area.defaultTools.join(", ")}.`,
  ].join("\n");
}

function buildGoalTemplate(area: AreaPrototype, knobs: AgentKnobs): string {
  const seed = area.scenarioSeeds[0] ?? "Handle a realistic work situation in your area.";
  const urgency =
    knobs.proactivity === "high"
      ? "Drive to a clear decision quickly."
      : knobs.proactivity === "low"
        ? "Respond carefully; do not overreach."
        : "Propose a clear next step and own your part.";
  return `${seed} ${urgency} Stay aligned with ${knobs.motivation} as your primary optimization.`;
}

function newId(): string {
  return `prof_${Math.random().toString(36).slice(2, 10)}`;
}

/** Pure deterministic compose — no LLM. */
export function composeProfile(input: ComposeProfileInput): AgentProfile {
  const area = getArea(input.areaId);
  const knobs = input.knobs;
  const title = titleFor(area, knobs.seniority);
  const name = (input.name?.trim() || defaultName(area, knobs)).slice(0, 64);
  const systemContext = buildSystemContext(
    area,
    knobs,
    name,
    title,
    input.orgHints,
  );
  const operatingStyle = buildOperatingStyle(knobs);
  const goalTemplate = buildGoalTemplate(area, knobs);

  return {
    id: newId(),
    name,
    title,
    areaId: area.id,
    knobs: { ...knobs },
    systemContext,
    operatingStyle,
    goalTemplate,
    rawCompose: {
      systemContext,
      operatingStyle: [...operatingStyle],
      goalTemplate,
    },
    refinedByModel: false,
    createdAt: new Date().toISOString(),
  };
}

export function listAreas(): AreaPrototype[] {
  return [...AREA_LIST];
}
