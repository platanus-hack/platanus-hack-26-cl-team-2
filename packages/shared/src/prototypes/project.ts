import { getArea } from "./areas/index.js";
import type { AgentProfile } from "./types.js";

export type ProjectedAgentSpecInput = {
  name: string;
  role: string;
  goal: string;
};

export type ProjectedAgentSpec = ProjectedAgentSpecInput & {
  id: string;
};

/** Project editable profile → harness AgentSpecInput (for runs). */
export function profileToAgentSpecInput(
  profile: AgentProfile,
): ProjectedAgentSpecInput {
  if (profile.orgHints?.notes === "mesh:prompt-only") {
    return { name: profile.name, role: profile.systemContext, goal: profile.goalTemplate };
  }
  let areaLabel: string = profile.areaId;
  try {
    areaLabel = getArea(profile.areaId).label;
  } catch {
    /* legacy / unknown area id */
  }
  const style = profile.operatingStyle.map((b) => `- ${b}`).join("\n");
  const role = [
    `${profile.title} (${areaLabel}).`,
    profile.systemContext,
    "",
    "Operating style:",
    style,
  ].join("\n");

  return {
    name: profile.name,
    role: role.slice(0, 5000),
    goal: profile.goalTemplate,
  };
}

/** Build system prompt string used by a harness session. */
export function profileToSystemPrompt(
  profile: AgentProfile,
  agentId?: string,
): string {
  if (profile.orgHints?.notes === "mesh:prompt-only") return profile.systemContext;
  let areaLabel: string = profile.areaId;
  try {
    areaLabel = getArea(profile.areaId).label;
  } catch {
    /* legacy / unknown area id */
  }
  const style = profile.operatingStyle.map((b) => `- ${b}`).join("\n");
  return [
    `You are "${profile.name}"${agentId ? ` (id: ${agentId})` : ""}.`,
    `Title: ${profile.title} · Area: ${areaLabel}`,
    "",
    profile.systemContext,
    "",
    "Operating style:",
    style,
    "",
    `Scenario goal: ${profile.goalTemplate}`,
  ].join("\n");
}

export function profileToAgentSpec(
  profile: AgentProfile,
  agentId: string,
): ProjectedAgentSpec {
  const input = profileToAgentSpecInput(profile);
  return {
    id: agentId,
    name: input.name,
    role: input.role,
    goal: input.goal,
  };
}
