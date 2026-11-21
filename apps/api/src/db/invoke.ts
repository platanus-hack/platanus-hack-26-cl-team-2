import {
  profileToAgentSpecInput,
  profileToSystemPrompt,
} from "@sandbox/shared";
import type { StoredAgent } from "./mappers.js";

/** Build everything needed to invoke a stored agent harness. */
export function buildInvokePayload(agent: StoredAgent) {
  const contextBlock =
    agent.contextFiles.length === 0
      ? ""
      : [
          "",
          "Attached context files:",
          ...agent.contextFiles.map(
            (f) => `### ${f.name} (${f.kind})\n${f.content}`,
          ),
        ].join("\n\n");

  const systemPrompt = `${profileToSystemPrompt(agent)}${contextBlock}`;
  const agentSpecInput = profileToAgentSpecInput(agent);

  return {
    agent,
    projection: {
      agentSpecInput: {
        ...agentSpecInput,
        role: `${agentSpecInput.role}${contextBlock}`.slice(0, 12000),
      },
      systemPrompt,
      tools: agent.harnessTools,
      model: agent.harnessModel,
    },
  };
}
