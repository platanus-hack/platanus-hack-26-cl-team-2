/**
 * Everyday business problems for selected company agents.
 * The selected agent is always the seed. Chains are counted separately, from the traces.
 * Weak or similar agent/company text must not abort ideation: enrich with company context and continue.
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
  description: "Submit ordinary workplace problems for one seed employee, grounded in company context.",
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
                "The concrete situation the seed employee receives and has to start. Spanish, at least 40 characters. Ground it in the company context.",
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

/** Longest company preamble before each agent's ## Rol block. */
export function companyContextFromAgents(agents: StoredAgent[]): string {
  const marker = "\n\n## Rol\n";
  let best = "";
  for (const agent of agents) {
    const idx = agent.systemContext.indexOf(marker);
    const context = idx >= 0 ? agent.systemContext.slice(0, idx) : agent.systemContext.slice(0, 4000);
    if (context.length > best.length) best = context;
  }
  return truncate(best, 6000);
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

function orgMeta(seed: StoredAgent): string {
  const hints = seed.orgHints;
  return [
    hints?.industry ? `Industria: ${hints.industry}` : "",
    hints?.notes ? `Notas: ${hints.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Ground a scenario in company work even when the model wrote something generic. */
export function enrichEverydayProblem(
  problem: EverydayProblem,
  input: { company: string; context: string; seed: StoredAgent },
): EverydayProblem {
  const title = problem.title.trim().slice(0, 120) || `Pedido de ${input.seed.name}`;
  let hint = problem.scenarioHint.trim();
  if (hint.length < 40) {
    hint = [
      `Acabas de recibir el siguiente mensaje:`,
      `En ${input.company} hay un pendiente operativo que te toca arrancar como ${input.seed.title || input.seed.name}.`,
      `Coordina con un colega lo necesario para destrabarlo hoy.`,
    ].join(" ");
  }
  const contextBite = truncate(input.context.replace(/\s+/g, " "), 450);
  const alreadyGrounded =
    Boolean(contextBite) &&
    (hint.includes(input.company) || (contextBite.length > 40 && hint.includes(contextBite.slice(0, 40))));
  if (contextBite && !alreadyGrounded) {
    hint = `${hint}\n\nAncla de ${input.company}: ${contextBite}`;
  }
  return {
    title,
    scenarioHint: hint.slice(0, 2000),
  };
}

function uniqueTitle(base: string, seen: Set<string>, index: number): string {
  let title = (base.trim() || `Problema cotidiano ${index + 1}`).slice(0, 110);
  let key = title.toLowerCase();
  let n = 2;
  while (seen.has(key)) {
    title = `${base.trim().slice(0, 100)} (${n})`.slice(0, 120);
    key = title.toLowerCase();
    n += 1;
  }
  return title;
}

/**
 * Keep as many usable problems as possible. Prefer distinct titles, but never discard
 * a whole batch just because titles collide with avoid/each other.
 */
export function normalizeEverydayProblems(
  raw: Record<string, unknown>,
  count: number,
  avoid: Set<string>,
): EverydayProblem[] {
  const list = Array.isArray(raw.problems) ? raw.problems : [];
  const problems: EverydayProblem[] = [];
  const seen = new Set(avoid);

  const accept = (titleRaw: string, scenarioHintRaw: string, force: boolean) => {
    if (problems.length >= count) return;
    let title = titleRaw.trim().slice(0, 120);
    let scenarioHint = scenarioHintRaw.trim().slice(0, 2000);
    if (!force) {
      if (title.length < 3 || scenarioHint.length < 40) return;
      const key = title.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      problems.push({ title, scenarioHint });
      return;
    }
    if (scenarioHint.length < 20 && title.length < 3) return;
    if (scenarioHint.length < 40) {
      scenarioHint = `${scenarioHint} Hay que coordinar con un colega para destrabarlo hoy sin inventar procesos nuevos.`.trim();
    }
    title = uniqueTitle(title || `Problema cotidiano ${problems.length + 1}`, seen, problems.length);
    seen.add(title.toLowerCase());
    problems.push({ title, scenarioHint: scenarioHint.slice(0, 2000) });
  };

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    accept(String(row.title ?? ""), String(row.scenarioHint ?? ""), false);
  }

  if (problems.length < count) {
    for (const item of list) {
      if (problems.length >= count) break;
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? "").trim();
      const hint = String(row.scenarioHint ?? "").trim();
      if (!title && hint.length < 20) continue;
      if (problems.some((problem) => problem.scenarioHint === hint.slice(0, 2000))) continue;
      accept(title, hint, true);
    }
  }

  return problems;
}

function fallbackProblems(
  count: number,
  input: { company: string; context: string; seed: StoredAgent; avoid: Set<string> },
): EverydayProblem[] {
  const frictions = [
    "renovación de un proveedor con fecha corta",
    "incidente operativo que afecta a un cliente interno",
    "lanzamiento bloqueado por una definición pendiente",
    "cobranza o facturación que no cierra entre áreas",
    "onboarding o traspaso que alguien dejó a medias",
  ];
  const seen = new Set(input.avoid);
  const out: EverydayProblem[] = [];
  for (let i = 0; i < count; i += 1) {
    const friction = frictions[i % frictions.length]!;
    const title = uniqueTitle(`${friction[0]!.toUpperCase()}${friction.slice(1)}`, seen, i);
    seen.add(title.toLowerCase());
    out.push(
      enrichEverydayProblem(
        {
          title,
          scenarioHint: [
            "Acabas de recibir el siguiente mensaje:",
            `En ${input.company} surgió ${friction}.`,
            `Te toca arrancarlo como ${input.seed.title || input.seed.name}.`,
            "Escribe a quien pueda destrabarlo y deja el siguiente paso concreto.",
          ].join(" "),
        },
        input,
      ),
    );
  }
  return out;
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
  const context = companyContextFromAgents(agents);
  const meta = orgMeta(seed);
  const avoid = (input.avoidTitles ?? []).map((title) => title.trim()).filter(Boolean).slice(-24);
  const avoidKeys = new Set(avoid.map((title) => title.toLowerCase()));
  const enrich = (problem: EverydayProblem) => enrichEverydayProblem(problem, { company, context, seed });

  const client = anthropicClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3200,
    tools: [DESIGN_TOOL],
    tool_choice: { type: "tool", name: "submit_everyday_problems" },
    system: [
      "You write ordinary workplace problems for a multi-agent company.",
      `Call submit_everyday_problems once with exactly ${count} problems.`,
      "Every problem lands on the SEED employee: they are the person who receives it and must start the work.",
      "Use the company context to ground each scenario in that company's real work, products, clients, or processes — even when agent roles look similar.",
      "Vary the friction (renewals, incidents, launches, billing, onboarding, handoffs). Prefer distinct titles, but never refuse to produce problems.",
      "Write title and scenarioHint in Spanish. scenarioHint should read as a concrete work request the seed just received.",
      NO_CYBER,
    ].join(" "),
    messages: [
      {
        role: "user",
        content: [
          `Empresa: ${company}`,
          meta || "",
          `Contexto de empresa (úsalo para enriquecer cada escenario):\n${context || "(sin contexto largo; inventa trabajo cotidiano plausible y concreto para esta empresa)"}`,
          `Semilla: id=${seed.id} | ${seed.name} | ${seed.title}`,
          `Roster:\n${rosterBlock(agents, seed.id)}`,
          avoid.length ? `No repitas estos títulos si puedes: ${avoid.join(" | ")}. Si hace falta, varía el ángulo del mismo tema.` : "Primera tanda.",
          `Cantidad exacta: ${count}. Devuelve siempre ${count} problemas, aunque el roster se parezca entre sí.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  });

  let problems = normalizeEverydayProblems(toolInput(response, "submit_everyday_problems"), count, avoidKeys).map(enrich);

  if (problems.length < count) {
    const fillers = fallbackProblems(count - problems.length, {
      company,
      context,
      seed,
      avoid: new Set([...avoidKeys, ...problems.map((problem) => problem.title.toLowerCase())]),
    });
    problems = [...problems, ...fillers].slice(0, count);
  }

  return { problems, model: MODEL };
}
