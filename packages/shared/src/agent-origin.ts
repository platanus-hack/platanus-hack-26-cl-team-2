/** Where a saved agent came from, so tools can act only on the agents a person made. */
import { AREA_LIST } from "./prototypes/areas/index.js";

export const AGENT_ORIGINS = ["manual", "enterprise", "seed", "test"] as const;

/**
 * manual: saved from the agent creator (or the agents API by hand).
 * enterprise: bulk-made by the enterprise generator ("CSM 1", "Engineering 12", …).
 * seed: the dev roster from db:seed. test: throwaway agents from scripts ("vuln_test_…").
 */
export type AgentOrigin = (typeof AGENT_ORIGINS)[number];

export function isAgentOrigin(value: unknown): value is AgentOrigin {
  return typeof value === "string" && (AGENT_ORIGINS as readonly string[]).includes(value);
}

const ESCAPE = /[.*+?^${}()|[\]\\]/g;
const GENERATED_NAME = new RegExp(
  `^(${AREA_LIST.map((a) => a.label.replace(ESCAPE, "\\$&")).join("|")}) \\d+$`,
);

/**
 * For agents saved before the origin was stored. The enterprise generator names agents
 * "<area label> <n>" and notes "enterprise-generator"; seeds and test agents have id prefixes.
 */
export function inferAgentOrigin(agent: {
  id: string;
  name: string;
  orgHints?: { notes?: string } | null;
}): AgentOrigin {
  if (agent.id.startsWith("vuln_test_")) return "test";
  if (agent.id.startsWith("seed_")) return "seed";
  if (agent.orgHints?.notes?.startsWith("enterprise-generator")) return "enterprise";
  if (GENERATED_NAME.test(agent.name)) return "enterprise";
  return "manual";
}
