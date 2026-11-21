import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import type {
  AgentSpec,
  CreateRunRequest,
  CreateStoredRunRequest,
  EmailScenarioKind,
  PeerMessageScenario,
  RunEvaluation,
  RunSummary,
  SenderCheck,
} from "@sandbox/shared";
import { assertApiKeyConfigured, config } from "../config.js";
import { getAgent } from "../db/agents-repo.js";
import { buildInvokePayload } from "../db/invoke.js";
import { emailScenarioHint, getEmailScenario } from "../email/scenarios.js";
import { messageBus } from "../message-bus.js";
import { traceBus } from "../events.js";
import { createSession, runOneTurn } from "./agent-runner.js";
import { evaluateRun } from "./evaluator.js";
import type { RunJudgment } from "./judge.js";
import { filterMockDbToolNames } from "./mock-db.js";

export type RunRosterEntry = {
  id: string;
  name: string;
  title: string;
  areaId: string;
  seniority: string;
  motivation: string;
  financeTools?: boolean;
  mockDbTools?: string[];
};

/** Which email (if any) started the run; senderCheck is set only when the banner was shown. */
export type RunEmailInfo = {
  file: string;
  id: string;
  kind: EmailScenarioKind;
  technique: string;
  from: string | null;
  subject: string | null;
  senderCheck: SenderCheck | null;
  /** Sender check result, always computed (for the judge), even when not shown to agents. */
  forensics: SenderCheck;
  /** The raw email, for the judge. */
  email: string;
};

type InternalRun = RunSummary & {
  seedAgentId?: string;
  scenarioHint?: string;
  email?: RunEmailInfo;
  peerMessage?: PeerMessageScenario;
  roster?: RunRosterEntry[];
  judgment?: RunJudgment;
};

const runs = new Map<string, InternalRun>();

/** Soft cap to avoid burning credits on huge fleets in one run. */
export const MAX_PARTICIPANTS = 8;

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

export function listRuns(): RunSummary[] {
  return [...runs.values()].map(publicRun);
}

export function getRun(runId: string): RunSummary | undefined {
  const run = runs.get(runId);
  return run ? publicRun(run) : undefined;
}

export function getInternalRun(runId: string): InternalRun | undefined {
  return runs.get(runId);
}

export function evaluateInternalRun(run: InternalRun): RunEvaluation {
  return evaluateRun({
    events: traceBus.history(run.id),
    email: run.email,
    financeAgentIds: run.agents.filter((a) => a.financeTools).map((a) => a.id),
    seedAgentId: run.seedAgentId,
  });
}

export function setRunJudgment(runId: string, judgment: RunJudgment): void {
  const run = runs.get(runId);
  if (run) run.judgment = judgment;
}

/** Poll in-memory run until completed/failed (for sequential vuln evals). */
export async function waitForRun(
  runId: string,
  timeoutMs = 180_000,
  pollMs = 400,
): Promise<RunSummary> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const run = getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    if (run.status === "completed" || run.status === "failed") return run;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`Run timed out after ${timeoutMs}ms: ${runId}`);
}

function publicRun(run: InternalRun): RunSummary {
  const {
    seedAgentId: _s,
    scenarioHint: _h,
    email: _e,
    peerMessage: _p,
    roster: _r,
    judgment: _j,
    ...rest
  } = run;
  return rest;
}

function startRun(
  agents: AgentSpec[],
  maxTurns: number,
  opts?: {
    seedAgentId?: string;
    scenarioHint?: string;
    email?: RunEmailInfo;
    peerMessage?: PeerMessageScenario;
    roster?: RunRosterEntry[];
  },
): RunSummary {
  if (agents.length < 1) {
    throw new Error("Select at least 1 agent.");
  }
  if (agents.length > MAX_PARTICIPANTS) {
    throw new Error(
      `Max ${MAX_PARTICIPANTS} agents per run (token safety). Turn some off.`,
    );
  }
  const ids = new Set(agents.map((a) => a.id));
  if (ids.size !== agents.length) {
    throw new Error("Duplicate agent ids in the run.");
  }

  assertApiKeyConfigured();

  const seedAgentId = opts?.seedAgentId ?? agents[0].id;
  if (!ids.has(seedAgentId)) {
    throw new Error("seedAgentId must be one of the selected agents.");
  }

  const runId = nanoid(12);
  const run: InternalRun = {
    id: runId,
    status: "pending",
    agents,
    createdAt: new Date().toISOString(),
    seedAgentId,
    scenarioHint: opts?.scenarioHint,
    email: opts?.email,
    peerMessage: opts?.peerMessage,
    roster:
      opts?.roster ??
      agents.map((a) => ({
        id: a.id,
        name: a.name,
        title: a.name,
        areaId: "unknown",
        seniority: "mid",
        motivation: "impact",
      })),
  };
  runs.set(runId, run);
  messageBus.ensureAgents(
    runId,
    agents.map((a) => a.id),
  );

  if (opts?.peerMessage) {
    const { fromAgentId, toAgentId, body } = opts.peerMessage;
    const msg = messageBus.send(runId, fromAgentId, toAgentId, body);
    // Same trace shape as a real send_message tool call, so the UI/judge see a peer edge.
    traceBus.emit(runId, "agent.message_sent", { message: msg, injected: true }, fromAgentId);
    traceBus.emit(runId, "agent.message_received", { message: msg, injected: true }, toAgentId);
  }

  void executeRun(run, maxTurns, {
    seedAgentId,
    scenarioHint: opts?.scenarioHint,
    email: opts?.email,
    peerMessage: opts?.peerMessage,
  });
  return getRun(runId)!;
}

export function createAndStartRun(body: CreateRunRequest): RunSummary {
  const agents: AgentSpec[] = body.agents.map((a, i) => ({
    id: `${slug(a.name) || `agent-${i + 1}`}-${nanoid(4)}`,
    name: a.name.trim(),
    role: a.role.trim(),
    goal: a.goal.trim(),
  }));

  const [a, b] = agents;
  if (a.id === b.id) b.id = `${b.id}-b`;

  return startRun(agents, body.maxTurnsPerAgent ?? config.maxTurnsPerAgent, {
    seedAgentId: a.id,
  });
}

/** Load N DB agents; only seedAgent receives the scenario instruction. */
export async function createAndStartStoredRun(
  body: CreateStoredRunRequest,
): Promise<RunSummary> {
  const agentIds = [
    ...new Set(body.agentIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (agentIds.length < 1) {
    throw new Error("Select at least 1 agent.");
  }
  if (agentIds.length > MAX_PARTICIPANTS) {
    throw new Error(
      `Max ${MAX_PARTICIPANTS} agents per run (token safety). Turn some off.`,
    );
  }

  let peerMessage = body.peerMessage
    ? {
        fromAgentId: body.peerMessage.fromAgentId.trim(),
        toAgentId: body.peerMessage.toAgentId.trim(),
        body: body.peerMessage.body.trim(),
      }
    : undefined;

  if (peerMessage) {
    if (agentIds.length < 2) {
      throw new Error("peerMessage requires at least 2 agents.");
    }
    if (!peerMessage.body) {
      throw new Error("peerMessage.body is required.");
    }
    if (peerMessage.fromAgentId === peerMessage.toAgentId) {
      throw new Error("peerMessage from and to must be different agents.");
    }
    if (!agentIds.includes(peerMessage.fromAgentId)) {
      throw new Error("peerMessage.fromAgentId must be a selected agent.");
    }
    if (!agentIds.includes(peerMessage.toAgentId)) {
      throw new Error("peerMessage.toAgentId must be a selected agent.");
    }
  }

  // Recipient of an injected peer message is the kickoff agent.
  const seedAgentId = peerMessage
    ? peerMessage.toAgentId
    : (body.seedAgentId ?? agentIds[0]).trim();
  if (!agentIds.includes(seedAgentId)) {
    throw new Error("seedAgentId must be one of the selected agents.");
  }

  // An email scenario replaces the free-text hint (resolved before loading agents
  // so a bad file/id fails fast). Ignored when peerMessage is set.
  let scenarioHint = peerMessage ? undefined : body.scenarioHint?.trim();
  let email: RunEmailInfo | undefined;
  if (!peerMessage && body.emailScenario) {
    const scen = getEmailScenario(body.emailScenario);
    const banner = body.emailScenario.senderCheck ? scen.senderCheck : undefined;
    scenarioHint = emailScenarioHint(scen.email, banner);
    email = {
      file: scen.file,
      id: scen.id,
      kind: scen.kind,
      technique: scen.technique,
      from: scen.from,
      subject: scen.subject,
      senderCheck: banner ?? null,
      forensics: scen.senderCheck,
      email: scen.email,
    };
  }

  const financeIds = new Set(
    (body.financeAgentIds ?? []).map((id) => id.trim()).filter(Boolean),
  );
  for (const id of financeIds) {
    if (!agentIds.includes(id)) {
      throw new Error(`financeAgentIds must be selected agents (got ${id}).`);
    }
  }

  const agents: AgentSpec[] = [];
  const roster: RunRosterEntry[] = [];
  for (const id of agentIds) {
    const stored = await getAgent(id);
    if (!stored) {
      throw new Error(`Agent not found: ${id}`);
    }
    const inv = buildInvokePayload(stored);
    const mockDbTools = filterMockDbToolNames(stored.harnessTools);
    agents.push({
      id: stored.id,
      name: stored.name,
      role: inv.projection.systemPrompt.slice(0, 14000),
      goal: stored.goalTemplate,
      financeTools: financeIds.has(stored.id),
      mockDbTools,
    });
    roster.push({
      id: stored.id,
      name: stored.name,
      title: stored.title,
      areaId: stored.areaId,
      seniority: stored.knobs.seniority,
      motivation: stored.knobs.motivation,
      financeTools: financeIds.has(stored.id),
      mockDbTools,
    });
  }

  agents.sort((a, b) => {
    if (a.id === seedAgentId) return -1;
    if (b.id === seedAgentId) return 1;
    return 0;
  });
  roster.sort((a, b) => {
    if (a.id === seedAgentId) return -1;
    if (b.id === seedAgentId) return 1;
    return 0;
  });

  return startRun(agents, body.maxTurnsPerAgent ?? config.maxTurnsPerAgent, {
    seedAgentId,
    scenarioHint,
    email,
    peerMessage,
    roster,
  });
}

async function executeRun(
  run: InternalRun,
  maxTurns: number,
  opts: {
    seedAgentId: string;
    scenarioHint?: string;
    email?: RunEmailInfo;
    peerMessage?: PeerMessageScenario;
  },
): Promise<void> {
  run.status = "running";
  traceBus.emit(run.id, "run.started", {
    agents: run.agents,
    model: config.model,
    maxTurnsPerAgent: maxTurns,
    scheduler: "round-robin",
    seedAgentId: opts.seedAgentId,
    scenarioHint: opts.scenarioHint ?? null,
    email: opts.email
      ? (({ email: _raw, ...meta }) => meta)(opts.email)
      : null,
    peerMessage: opts.peerMessage
      ? {
          fromAgentId: opts.peerMessage.fromAgentId,
          toAgentId: opts.peerMessage.toAgentId,
          bodyPreview: opts.peerMessage.body.slice(0, 240),
        }
      : null,
    financeAgentIds: run.agents.filter((a) => a.financeTools).map((a) => a.id),
    participantCount: run.agents.length,
  });

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const peerKickoffId = opts.peerMessage?.toAgentId;
  const sessions = run.agents.map((agent) => {
    const peers = run.agents.filter((a) => a.id !== agent.id);
    const isKickoff = agent.id === opts.seedAgentId;
    return createSession(agent, peers, {
      isSeed: isKickoff && !peerKickoffId,
      scenarioHint:
        isKickoff && !peerKickoffId ? opts.scenarioHint : undefined,
      peerInboxKickoff: Boolean(peerKickoffId && agent.id === peerKickoffId),
    });
  });

  try {
    let cursor = 0;
    const hardCap = maxTurns * sessions.length + sessions.length;

    for (let step = 0; step < hardCap; step++) {
      if (sessions.every((s) => s.done)) break;

      const session = sessions[cursor % sessions.length];
      cursor += 1;

      if (session.done) continue;
      if (session.turnsUsed >= maxTurns) {
        session.done = true;
        traceBus.emit(
          run.id,
          "agent.done",
          {
            summary: `Stopped after ${maxTurns} turns without calling done.`,
            reason: "max_turns",
          },
          session.agent.id,
        );
        continue;
      }

      await runOneTurn(run.id, session, client, maxTurns);
    }

    run.status = "completed";
    run.finishedAt = new Date().toISOString();
    traceBus.emit(run.id, "run.completed", { status: run.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    run.status = "failed";
    run.error = message;
    run.finishedAt = new Date().toISOString();
    traceBus.emit(run.id, "run.failed", { error: message });
  }
}
