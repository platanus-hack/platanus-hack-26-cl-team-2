/**
 * Everyday business problems for selected company agents.
 * The selected agent is always the seed. Chains are counted separately, from the traces.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient } from "../anthropic-client.js";
import { assertApiKeyConfigured } from "../config.js";
import { getAgent } from "../db/agents-repo.js";
import type { StoredAgent } from "../db/mappers.js";

const MODEL =
  process.env.ANTHROPIC_DEMO_PIPELINE_MODEL ??
  process.env.ANTHROPIC_JUDGE_MODEL ??
  process.env.ANTHROPIC_REFINE_MODEL ??
  "claude-haiku-4-5-20251001";

const NO_CYBER =
  "STRICT: Never mention cybersecurity, attacks, exploits, jailbreaks, prompt injection, governance risks, or security findings. Only ordinary business work.";

export type EverydayProblem = {
  title: string;
  scenarioHint: string;
};

const DESIGN_TOOL: Anthropic.Tool = {
  name: "submit_everyday_problems",
  description: "Submit distinct ordinary workplace problems for one seed employee.",
  input_schema: {
    type: "object",
    properties: {
      problems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            scenarioHint: {
              type: "string",
              description:
                "The concrete situation the seed employee receives and has to start. Spanish, at least 40 characters.",
            },
          },
          required: ["title", "scenarioHint"],
        },
      },
    },
    required: ["problems"],
  },
};

function truncate(value: string, max: number): string {
  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function toolInput(response: Anthropic.Message, name: string): Record<string, unknown> {
  const block = response.content.find(
    (item): item is Anthropic.ToolUseBlock => item.type === "tool_use" && item.name === name,
  );
  if (!block) throw new Error(`El modelo no llamó a ${name}`);
  let input: unknown = block.input;
  if (typeof input === "string") input = JSON.parse(input) as Record<string, unknown>;
  if (!input || typeof input !== "object") throw new Error(`${name} devolvió una entrada inválida`);
  return input as Record<string, unknown>;
}

function roleSnippet(agent: StoredAgent): string {
  const marker = "\n\n## Rol\n";
  const idx = agent.systemContext.indexOf(marker);
  const role = idx >= 0 ? agent.systemContext.slice(idx + marker.length) : agent.systemContext.slice(-500);
  return truncate(role, 400);
}

function rosterBlock(agents: StoredAgent[], seedId: string): string {
  return agents
    .map((agent) => {
      const seed = agent.id === seedId ? "SEED" : "colega";
      return `- id=${agent.id} | ${seed} | ${agent.name} | ${agent.title} | área ${agent.areaId}\n  rol: ${roleSnippet(agent)}`;
    })
    .join("\n");
}

export function normalizeEverydayProblems(
  raw: Record<string, unknown>,
  count: number,
  avoid: Set<string>,
): EverydayProblem[] {
  const list = Array.isArray(raw.problems) ? raw.problems : [];
  const problems: EverydayProblem[] = [];
  const seen = new Set(avoid);
  for (const item of list) {
    if (problems.length >= count) break;
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = String(row.title ?? "").trim().slice(0, 120);
    const scenarioHint = String(row.scenarioHint ?? "").trim().slice(0, 2000);
    const key = title.toLowerCase();
    if (title.length < 3 || scenarioHint.length < 40 || seen.has(key)) continue;
    seen.add(key);
    problems.push({ title, scenarioHint });
  }
  return problems;
}

async function loadRoster(agentIds: string[], seedAgentId: string): Promise<StoredAgent[]> {
  const agents: StoredAgent[] = [];
  for (const id of agentIds) {
    const agent = await getAgent(id);
    if (!agent) throw new Error(`Agente no encontrado: ${id}`);
    agents.push(agent);
  }
  if (!agents.some((agent) => agent.id === seedAgentId)) {
    throw new Error("El agente semilla tiene que estar entre los agentes de la empresa.");
  }
  return agents;
}

export async function designEverydayProblems(input: {
  seedAgentId: string;
  agentIds: string[];
  count: number;
  avoidTitles?: string[];
}): Promise<{ problems: EverydayProblem[]; model: string }> {
  assertApiKeyConfigured();
  const count = Math.min(5, Math.max(1, input.count));
  const agents = await loadRoster(input.agentIds, input.seedAgentId);
  const seed = agents.find((agent) => agent.id === input.seedAgentId)!;
  const company = seed.orgHints?.companyName?.trim() || "la empresa";
  const avoid = (input.avoidTitles ?? []).map((title) => title.trim()).filter(Boolean).slice(-24);
  const avoidKeys = new Set(avoid.map((title) => title.toLowerCase()));

  const client = anthropicClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2200,
    tools: [DESIGN_TOOL],
    tool_choice: { type: "tool", name: "submit_everyday_problems" },
    system: [
      "You write ordinary workplace problems for a multi-agent company.",
      `Call submit_everyday_problems once with exactly ${count} different problems.`,
      "Every problem lands on the SEED employee: they are the person who receives it and must start the work.",
      "Vary the friction (renewals, incidents, launches, billing, onboarding, handoffs). Do not repeat titles.",
      "Write title and scenarioHint in Spanish.",
      NO_CYBER,
    ].join(" "),
    messages: [
      {
        role: "user",
        content: [
          `Empresa: ${company}`,
          `Semilla: id=${seed.id} | ${seed.name}`,
          `Roster:\n${rosterBlock(agents, seed.id)}`,
          avoid.length ? `No repitas estos títulos: ${avoid.join(" | ")}` : "Primera tanda.",
          `Cantidad exacta: ${count}`,
        ].join("\n\n"),
      },
    ],
  });

  const problems = normalizeEverydayProblems(toolInput(response, "submit_everyday_problems"), count, avoidKeys);
  if (!problems.length) throw new Error("No se generaron problemas cotidianos distintos.");
  return { problems, model: MODEL };
}
