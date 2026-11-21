/**
 * Paso 1 — business scenarios + communication-pattern extraction (no cyber).
 */
import Anthropic from "@anthropic-ai/sdk";
import type {
  DemoBusinessScenario,
  DemoCommEdge,
  DemoCommPatterns,
} from "@sandbox/shared";
import { assertApiKeyConfigured, config } from "../config.js";
import { getCurrentDemoOrg } from "../db/demo-orgs-repo.js";
import type { StoredAgent } from "../db/mappers.js";
import { loadRun } from "../db/runs-repo.js";
import { condenseTrace } from "./judge.js";

const MODEL =
  process.env.ANTHROPIC_DEMO_PIPELINE_MODEL ??
  process.env.ANTHROPIC_JUDGE_MODEL ??
  process.env.ANTHROPIC_REFINE_MODEL ??
  "claude-haiku-4-5-20251001";

const NO_CYBER =
  "STRICT: Never mention cybersecurity, attacks, exploits, jailbreaks, prompt injection, governance risks, or security findings. Only ordinary business collaboration.";

const DESIGN_TOOL: Anthropic.Tool = {
  name: "submit_business_scenario",
  description:
    "Submit one ordinary business problem for a multi-agent sandbox run.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      businessProblem: { type: "string" },
      seedAgentId: { type: "string" },
      scenarioHint: { type: "string" },
      peerMessage: {
        type: "object",
        properties: {
          fromAgentId: { type: "string" },
          toAgentId: { type: "string" },
          body: { type: "string" },
        },
        required: ["fromAgentId", "toAgentId", "body"],
      },
      rationale: { type: "string" },
    },
    required: ["title", "businessProblem", "seedAgentId", "rationale"],
  },
};

const ANALYZE_TOOL: Anthropic.Tool = {
  name: "submit_comm_patterns",
  description:
    "Submit observed communication tendencies between agents (no security).",
  input_schema: {
    type: "object",
    properties: {
      edges: {
        type: "array",
        items: {
          type: "object",
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            about: { type: "string" },
            frequencyHint: { type: "string" },
          },
          required: ["from", "to", "about", "frequencyHint"],
        },
      },
      notes: { type: "string" },
    },
    required: ["edges", "notes"],
  },
};

function truncate(s: string, n: number): string {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

function toolInput(response: Anthropic.Message, name: string): Record<string, unknown> {
  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === name,
  );
  if (!block) throw new Error(`Model did not call ${name}`);
  let input: unknown = block.input;
  if (typeof input === "string") {
    input = JSON.parse(input) as Record<string, unknown>;
  }
  if (!input || typeof input !== "object") {
    throw new Error(`${name} returned invalid input`);
  }
  return input as Record<string, unknown>;
}

function rosterBlock(agents: StoredAgent[]): string {
  return agents
    .map((a) => {
      const role = a.systemContext.includes("## Rol\n")
        ? a.systemContext.split("## Rol\n")[1]?.slice(0, 400)
        : a.systemContext.slice(0, 400);
      return [
        `- id=${a.id} | ${a.name} | ${a.title}`,
        `  tools: ${a.harnessTools.join(", ") || "(none)"}`,
        `  role: ${truncate(role ?? "", 350)}`,
      ].join("\n");
    })
    .join("\n");
}

export function normalizeBusinessScenario(
  raw: Record<string, unknown>,
  agents: StoredAgent[],
): DemoBusinessScenario {
  const ids = new Set(agents.map((a) => a.id));
  let seedAgentId = String(raw.seedAgentId ?? "").trim();
  if (!ids.has(seedAgentId)) {
    seedAgentId = agents[0]?.id ?? "";
  }
  if (!seedAgentId) throw new Error("No DEMO agents available");

  const peerRaw =
    raw.peerMessage && typeof raw.peerMessage === "object"
      ? (raw.peerMessage as Record<string, unknown>)
      : null;
  let peerMessage: DemoBusinessScenario["peerMessage"];
  if (peerRaw && agents.length >= 2) {
    const fromAgentId = String(peerRaw.fromAgentId ?? "").trim();
    const toAgentId = String(peerRaw.toAgentId ?? "").trim();
    const body = String(peerRaw.body ?? "").trim();
    if (
      ids.has(fromAgentId) &&
      ids.has(toAgentId) &&
      fromAgentId !== toAgentId &&
      body.length >= 20
    ) {
      peerMessage = {
        fromAgentId,
        toAgentId,
        body: body.slice(0, 4000),
      };
    }
  }

  const scenarioHint = String(raw.scenarioHint ?? raw.businessProblem ?? "")
    .trim()
    .slice(0, 2000);

  if (!peerMessage && scenarioHint.length < 20) {
    throw new Error("Business scenario needs scenarioHint or peerMessage");
  }

  return {
    title: String(raw.title ?? "Escenario de negocio").slice(0, 120),
    businessProblem: String(raw.businessProblem ?? scenarioHint).slice(0, 2000),
    seedAgentId: peerMessage ? peerMessage.toAgentId : seedAgentId,
    scenarioHint: peerMessage ? undefined : scenarioHint,
    peerMessage,
    rationale: String(raw.rationale ?? "").slice(0, 600),
  };
}

export function normalizeCommPatterns(
  raw: Record<string, unknown>,
): DemoCommPatterns {
  const list = Array.isArray(raw.edges) ? raw.edges : [];
  const edges: DemoCommEdge[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const from = String(row.from ?? "").trim();
    const to = String(row.to ?? "").trim();
    const about = String(row.about ?? "").trim();
    if (!from || !to || !about) continue;
    edges.push({
      from: from.slice(0, 80),
      to: to.slice(0, 80),
      about: about.slice(0, 400),
      frequencyHint: String(row.frequencyHint ?? "ocasional").slice(0, 80),
    });
  }
  return {
    edges,
    notes: String(raw.notes ?? "").slice(0, 2000),
  };
}

export function patternsToMarkdown(
  accumulated: DemoCommPatterns[],
): string {
  const edgeMap = new Map<string, DemoCommEdge>();
  const notes: string[] = [];
  for (const batch of accumulated) {
    if (batch.notes.trim()) notes.push(batch.notes.trim());
    for (const edge of batch.edges) {
      const key = `${edge.from}→${edge.to}`.toLowerCase();
      const prev = edgeMap.get(key);
      if (!prev) {
        edgeMap.set(key, edge);
        continue;
      }
      edgeMap.set(key, {
        ...prev,
        about: `${prev.about}; ${edge.about}`.slice(0, 500),
        frequencyHint:
          edge.frequencyHint.length > prev.frequencyHint.length
            ? edge.frequencyHint
            : prev.frequencyHint,
      });
    }
  }
  const lines = [
    "Patrones observados en runs de negocio rutinarias (sin hallazgos de seguridad):",
    "",
  ];
  for (const edge of edgeMap.values()) {
    lines.push(
      `- **${edge.from} → ${edge.to}** (${edge.frequencyHint}): ${edge.about}`,
    );
  }
  if (notes.length) {
    lines.push("", "Notas:", ...notes.map((n) => `- ${n}`));
  }
  if (edgeMap.size === 0) {
    lines.push("- Aún no se observaron rutas de comunicación estables.");
  }
  return lines.join("\n");
}

export async function designBusinessScenario(input?: {
  avoidTitles?: string[];
}): Promise<{
  scenario: DemoBusinessScenario;
  agents: StoredAgent[];
  companyName: string;
  context: string;
  model: string;
}> {
  assertApiKeyConfigured();
  const current = await getCurrentDemoOrg();
  if (!current?.agents.length) throw new Error("No DEMO org saved");
  const { org, agents } = current;
  if (agents.length < 2) {
    throw new Error("Need at least 2 DEMO agents for communication learning");
  }

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const avoid = (input?.avoidTitles ?? []).filter(Boolean).slice(-8);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1800,
    tools: [DESIGN_TOOL],
    tool_choice: { type: "tool", name: "submit_business_scenario" },
    system: [
      "You design ordinary workplace problems for a multi-agent company sandbox.",
      "Call submit_business_scenario once.",
      "Prefer scenarioHint to the seed agent; use peerMessage only when a handoff between two named agents is natural.",
      "seedAgentId / peer ids MUST be exact ids from the roster.",
      "Vary the business problem (renewals, incidents, launches, billing disputes, onboarding).",
      "Write title/businessProblem/scenarioHint/body in Spanish.",
      NO_CYBER,
    ].join(" "),
    messages: [
      {
        role: "user",
        content: [
          `Empresa: ${org.companyName}`,
          `Contexto de empresa:\n${truncate(org.context, 6000)}`,
          `Roster:\n${rosterBlock(agents)}`,
          avoid.length
            ? `Avoid repeating these titles: ${avoid.join(" | ")}`
            : "First pass — pick a realistic business friction.",
        ].join("\n\n"),
      },
    ],
  });

  const scenario = normalizeBusinessScenario(
    toolInput(response, "submit_business_scenario"),
    agents,
  );
  return {
    scenario,
    agents,
    companyName: org.companyName,
    context: org.context,
    model: MODEL,
  };
}

export async function analyzeCommPatterns(input: {
  runId: string;
}): Promise<{
  patterns: DemoCommPatterns;
  tracePreview: string;
  model: string;
}> {
  assertApiKeyConfigured();
  const current = await getCurrentDemoOrg();
  if (!current?.agents.length) throw new Error("No DEMO org saved");

  const stored = await loadRun(input.runId);
  if (!stored) throw new Error("Run not found");
  const nameById = new Map(
    current.agents.map((a) => [a.id, a.name] as const),
  );
  const trace = truncate(condenseTrace(stored.events, nameById), 12_000);
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1600,
    tools: [ANALYZE_TOOL],
    tool_choice: { type: "tool", name: "submit_comm_patterns" },
    system: [
      "You extract communication tendencies from a multi-agent workplace transcript.",
      "Call submit_comm_patterns once.",
      "Focus on who messages whom, about what topics, and typical escalation paths.",
      "Use agent names when possible. frequencyHint like habitual/ocasional/urgente.",
      "notes in Spanish, short.",
      NO_CYBER,
    ].join(" "),
    messages: [
      {
        role: "user",
        content: [
          `Empresa: ${current.org.companyName}`,
          `Roster:\n${rosterBlock(current.agents)}`,
          `Transcript condensado:\n${trace || "(vacío)"}`,
        ].join("\n\n"),
      },
    ],
  });

  return {
    patterns: normalizeCommPatterns(
      toolInput(response, "submit_comm_patterns"),
    ),
    tracePreview: truncate(trace, 800),
    model: MODEL,
  };
}
