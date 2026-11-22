import { anthropicClient } from "../anthropic-client.js";
import { nanoid } from "nanoid";
import type {
  CommEdge,
  AgentSpec,
  CreateRunRequest,
  CreateStoredRunRequest,
  EmailScenarioKind,
  RiskPathAnalysis,
  PeerMessageScenario,
  RunEvaluation,
  RunRiskPaths,
  RunSummary,
  SenderCheck,
  TraceEvent,
} from "@sandbox/shared";
import { assertApiKeyConfigured, config } from "../config.js";
import { redactSecrets } from "../security/redact.js";
import { getAgent } from "../db/agents-repo.js";
import { buildInvokePayload } from "../db/invoke.js";
import { emailScenarioHint, getEmailScenario } from "../email/scenarios.js";
import { messageBus } from "../message-bus.js";
import { traceBus } from "../events.js";
import { createSession, runOneTurn, wakeIfMailWaiting } from "./agent-runner.js";
import { evaluateRun } from "./evaluator.js";
import { provenanceTag } from "./provenance.js";
import { analyzeRiskPaths, observeRiskPaths, type CommCount, type RiskSetup } from "./risk-paths.js";
import { approvalRefundLimit } from "./sandbox.js";
import type { RunJudgment } from "./judge.js";
import { loadRun, loadRuns, saveJudgment, saveRun } from "../db/runs-repo.js";
import { getCurrentDemoOrg } from "../db/demo-orgs-repo.js";
import { getCommGraph, recordRunComms } from "../db/comm-repo.js";
import { filterMockDbToolNames } from "./mock-db.js";
import { filterDemoFileToolNames } from "./demo-files.js";

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
  /** provenance_tag fix: agent-to-agent messages carry the email's origin. */
  provenanceTag?: boolean;
  /**
   * approval_gate fix: the sandbox holds refunds above approvalRefundLimit and bank changes
   * (the run started from an external email). The agents are not told; they see the result.
   */
  approvalGate?: boolean;
  /** APPROVAL_REFUND_LIMIT read when the run was prepared (only with approvalGate). */
  approvalRefundLimit?: number;
};

export type InternalRun = RunSummary & {
  expiresAt?: string;
  seedAgentId?: string;
  scenarioHint?: string;
  email?: RunEmailInfo;
  peerMessage?: PeerMessageScenario;
  roster?: RunRosterEntry[];
  judgment?: RunJudgment;
  /** Messages between this run's agents in earlier runs, taken at start: weights its risk paths. */
  commCounts?: CommCount[];
  /** Experiments: this run's messages are not added to the communication weights. */
  skipCommRecording?: boolean;
};

/** Soft cap to avoid burning credits on huge fleets in one run. */
export const MAX_PARTICIPANTS = 24;

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

/**
 * Runs started by this process (the live objects executeRun mutates). The database is the
 * source of truth for reads; this map only counts budget slots and bounds the in-memory
 * trace and inbox buses.
 */
const runs = new Map<string, InternalRun>();

/** Runs that still hold a model budget slot (for MAX_CONCURRENT_RUNS). */
export function activeRunCount(): number {
  let n = 0;
  for (const r of runs.values()) if (r.status === "pending" || r.status === "running") n += 1;
  return n;
}

/** A request may ask for fewer turns than MAX_TURNS_PER_AGENT, never more (budget ceiling). */
export function clampTurns(requested: number | undefined): number {
  const ceiling = config.maxTurnsPerAgent;
  if (!requested || !Number.isFinite(requested)) return ceiling;
  return Math.max(1, Math.min(Math.floor(requested), ceiling));
}

/** Keep memory bounded: drop the oldest finished runs (and their traces) past MAX_STORED_RUNS. */
function evictOldRuns(): void {
  if (runs.size <= config.maxStoredRuns) return;
  for (const [id, r] of runs) {
    if (runs.size <= config.maxStoredRuns) break;
    if (r.status === "pending" || r.status === "running") continue;
    runs.delete(id);
    traceBus.drop(id);
    messageBus.dropRun(id);
  }
}

export async function listRuns(): Promise<RunSummary[]> {
  return (await loadRuns()).map(publicRun);
}

export async function getRun(runId: string): Promise<RunSummary | undefined> {
  const run = (await loadRun(runId))?.run;
  return run ? publicRun(run) : undefined;
}

export async function getInternalRun(runId: string): Promise<InternalRun | undefined> {
  return (await loadRun(runId))?.run;
}

export function evaluateInternalRun(run: InternalRun, events: TraceEvent[] = traceBus.history(run.id)): RunEvaluation {
  return evaluateRun({
    events,
    email: run.email,
    financeAgentIds: run.agents.filter((a) => a.financeTools).map((a) => a.id),
    seedAgentId: run.seedAgentId,
  });
}

function riskSetupFor(run: InternalRun): RiskSetup {
  return {
    agents: run.agents.map((a) => ({ id: a.id, name: a.name, finance: Boolean(a.financeTools) })),
    seedAgentId: run.seedAgentId ?? run.agents[0]?.id ?? "",
    email: run.email ? { from: run.email.from, senderCheck: run.email.forensics } : null,
    fixes: {
      senderCheck: Boolean(run.email?.senderCheck),
      provenanceTag: Boolean(run.email?.provenanceTag),
      approvalGate: Boolean(run.email?.approvalGate),
    },
    comm: run.commCounts,
  };
}

/** Predicted paths from the run setup, and the ones the trace shows were actually taken. */
export function riskPathsForRun(run: InternalRun, events: TraceEvent[] = traceBus.history(run.id)): RunRiskPaths {
  const setup = riskSetupFor(run);
  const predicted = analyzeRiskPaths(setup);
  return {
    predicted,
    observed: observeRiskPaths(events, setup, predicted.paths),
  };
}

/**
 * Same analysis before launching (no run, no model call): what MESH predicts for this setup.
 * Validates like createAndStartStoredRun so the preview matches what would run.
 */
export async function previewRiskPaths(body: {
  agentIds: string[];
  seedAgentId: string;
  financeAgentIds?: string[];
  emailScenario?: CreateStoredRunRequest["emailScenario"];
}): Promise<RiskPathAnalysis> {
  const agentIds = [...new Set(body.agentIds.map((id) => id.trim()).filter(Boolean))];
  const seedAgentId = body.seedAgentId.trim();
  if (!agentIds.includes(seedAgentId)) {
    throw new Error("seedAgentId must be one of the selected agents.");
  }
  const financeIds = new Set((body.financeAgentIds ?? []).map((id) => id.trim()));
  const agents: RiskSetup["agents"] = [];
  for (const id of agentIds) {
    const stored = await getAgent(id);
    if (!stored) throw new Error(`Agent not found: ${id}`);
    agents.push({ id, name: stored.name, finance: financeIds.has(id) });
  }
  const scen = body.emailScenario ? getEmailScenario(body.emailScenario) : null;
  const comm = (await getCommGraph().catch(() => ({ edges: [] as CommEdge[] }))).edges.map((e) => ({
    from: e.from,
    to: e.to,
    messages: e.messages,
  }));
  return analyzeRiskPaths({
    comm,
    agents,
    seedAgentId,
    email: scen ? { from: scen.from, senderCheck: scen.senderCheck } : null,
    fixes: {
      senderCheck: Boolean(body.emailScenario?.senderCheck),
      provenanceTag: Boolean(body.emailScenario?.provenanceTag),
      approvalGate: Boolean(body.emailScenario?.approvalGate),
    },
  });
}

export async function setRunJudgment(runId: string, judgment: RunJudgment): Promise<void> {
  await saveJudgment(runId, judgment);
}

/** Poll persisted run until completed/failed (for sequential vuln evals). */
export async function waitForRun(
  runId: string,
  timeoutMs = 180_000,
  pollMs = 400,
): Promise<RunSummary> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const run = await getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    if (run.status === "completed" || run.status === "failed") return run;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`Run timed out after ${timeoutMs}ms: ${runId}`);
}

export function publicRun(run: InternalRun): RunSummary {
  const {
    seedAgentId: _s,
    scenarioHint: _h,
    email: _e,
    peerMessage: _p,
    roster: _r,
    judgment: _j,
    expiresAt: _expires,
    commCounts: _c,
    skipCommRecording: _skip,
    ...rest
  } = run;
  return rest;
}

async function startRun(
  agents: AgentSpec[],
  maxTurns: number,
  opts?: {
    seedAgentId?: string;
    scenarioHint?: string;
    email?: RunEmailInfo;
    peerMessage?: PeerMessageScenario;
    openings?: { agentId: string; scenarioHint: string }[];
    extraPeerMessages?: PeerMessageScenario[];
    roster?: RunRosterEntry[];
    commCounts?: CommCount[];
    skipCommRecording?: boolean;
  },
): Promise<RunSummary> {
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
    expiresAt: new Date(Date.now() + (process.env.VERCEL ? 270_000 : 630_000)).toISOString(),
    seedAgentId,
    scenarioHint: opts?.scenarioHint,
    email: opts?.email,
    peerMessage: opts?.peerMessage,
    ...(opts?.commCounts?.length ? { commCounts: opts.commCounts } : {}),
    ...(opts?.skipCommRecording ? { skipCommRecording: true } : {}),
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
  // Registered before the first await, so a budget check right before this call cannot race
  // with another start (activeRunCount already sees this run).
  runs.set(runId, run);
  evictOldRuns();
  try {
    await saveRun(run, []);
  } catch (err) {
    runs.delete(runId);
    throw err;
  }
  messageBus.ensureAgents(
    runId,
    agents.map((a) => a.id),
  );

  const injected = [...(opts?.peerMessage ? [opts.peerMessage] : []), ...(opts?.extraPeerMessages ?? [])];
  for (const message of injected) {
    const msg = messageBus.send(runId, message.fromAgentId, message.toAgentId, message.body);
    // Same trace shape as a real send_message tool call, so the UI/judge see a peer edge.
    traceBus.emit(runId, "agent.message_sent", { message: msg, injected: true }, message.fromAgentId);
    traceBus.emit(runId, "agent.message_received", { message: msg, injected: true }, message.toAgentId);
  }

  const execution = executeRun(run, maxTurns, {
    seedAgentId,
    scenarioHint: opts?.scenarioHint,
    email: opts?.email,
    peerMessage: opts?.peerMessage,
    openings: opts?.openings,
    extraPeerMessages: opts?.extraPeerMessages,
  });
  if (process.env.VERCEL) await execution;
  else void execution.catch(error => console.error("No se pudo persistir la ejecución", error));
  return publicRun(run);
}

export function createAndStartRun(body: CreateRunRequest): Promise<RunSummary> {
  const agents: AgentSpec[] = body.agents.map((a, i) => ({
    id: `${slug(a.name) || `agent-${i + 1}`}-${nanoid(4)}`,
    name: a.name.trim(),
    role: a.role.trim(),
    goal: a.goal.trim(),
  }));

  const [a, b] = agents;
  if (a.id === b.id) b.id = `${b.id}-b`;

  return startRun(agents, clampTurns(body.maxTurnsPerAgent), {
    seedAgentId: a.id,
  });
}

export type PreparedStoredRun = {
  agents: AgentSpec[];
  maxTurns: number;
  opts: {
    seedAgentId: string;
    scenarioHint?: string;
    email?: RunEmailInfo;
    peerMessage?: PeerMessageScenario;
    openings?: { agentId: string; scenarioHint: string }[];
    extraPeerMessages?: PeerMessageScenario[];
    roster: RunRosterEntry[];
    commCounts?: CommCount[];
    skipCommRecording?: boolean;
  };
};

/** Load N DB agents; only seedAgent receives the scenario instruction. */
export async function createAndStartStoredRun(
  body: CreateStoredRunRequest,
): Promise<RunSummary> {
  return startPreparedRun(await prepareStoredRun(body));
}

/**
 * The run takes its budget slot synchronously (before the first await inside startRun), so a
 * budget check right before this call cannot race with another start.
 */
export function startPreparedRun(p: PreparedStoredRun): Promise<RunSummary> {
  return startRun(p.agents, p.maxTurns, p.opts);
}

/**
 * Everything that can fail for a bad request (agents, email, finance ids, API key), with no
 * model call: the HTTP route checks the demo budget only after this succeeds.
 */
export async function prepareStoredRun(
  body: CreateStoredRunRequest,
): Promise<PreparedStoredRun> {
  // Ensure DEMO .txt tools are registered before tool filtering.
  await getCurrentDemoOrg().catch(() => null);

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
      provenanceTag: Boolean(body.emailScenario.provenanceTag),
      ...(body.emailScenario.approvalGate
        ? { approvalGate: true, approvalRefundLimit: approvalRefundLimit() }
        : {}),
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

  // Past messages between this run's agents: weights the risk paths and, with commBias, the prompts.
  const commEdges = (await getCommGraph().catch(() => ({ edges: [] as CommEdge[] }))).edges.filter(
    (e) => e.from !== e.to && agentIds.includes(e.from) && agentIds.includes(e.to),
  );
  const commCounts: CommCount[] = commEdges.map((e) => ({ from: e.from, to: e.to, messages: e.messages }));
  const habitsFor = (agentId: string) =>
    commEdges
      .filter((e) => e.from === agentId && e.to !== agentId && agentIds.includes(e.to))
      .map((e) => ({ toAgentId: e.to, share: e.share, messages: e.messages, runs: e.runs }));

  const agents: AgentSpec[] = [];
  const roster: RunRosterEntry[] = [];
  for (const id of agentIds) {
    const stored = await getAgent(id);
    if (!stored) {
      throw new Error(`Agent not found: ${id}`);
    }
    const inv = buildInvokePayload(stored);
    const mockDbTools = [
      ...filterMockDbToolNames(stored.harnessTools),
      ...filterDemoFileToolNames(stored.harnessTools),
    ];
    agents.push({
      id: stored.id,
      name: stored.name,
      role: inv.projection.systemPrompt.slice(0, 14000),
      goal: stored.goalTemplate,
      financeTools: financeIds.has(stored.id),
      mockDbTools,
      ...(body.commBias ? { commHabits: habitsFor(stored.id) } : {}),
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

  if (agents.length > MAX_PARTICIPANTS) {
    throw new Error(`Max ${MAX_PARTICIPANTS} agents per run (token safety). Turn some off.`);
  }
  assertApiKeyConfigured();

  return {
    agents,
    maxTurns: clampTurns(body.maxTurnsPerAgent),
    opts: {
      seedAgentId,
      scenarioHint,
      email,
      peerMessage,
      roster,
      commCounts,
      ...(body.skipCommRecording ? { skipCommRecording: true } : {}),
    },
  };
}

async function executeRun(
  run: InternalRun,
  maxTurns: number,
  opts: {
    seedAgentId: string;
    scenarioHint?: string;
    email?: RunEmailInfo;
    peerMessage?: PeerMessageScenario;
    openings?: { agentId: string; scenarioHint: string }[];
    extraPeerMessages?: PeerMessageScenario[];
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

  // No SDK retries on Vercel: the function has a hard time limit (see signal below).
  const client = anthropicClient(process.env.VERCEL ? { maxRetries: 0 } : undefined);
  const tag = opts.email?.provenanceTag
    ? provenanceTag({ from: opts.email.from, senderCheck: opts.email.senderCheck })
    : undefined;
  // Only email runs: the gate is about work that came from an external email.
  const gate = opts.email?.approvalGate
    ? { refundLimit: opts.email.approvalRefundLimit ?? approvalRefundLimit() }
    : undefined;
  const signal = AbortSignal.timeout(process.env.VERCEL ? 240_000 : 600_000);
  const openings = new Map<string, string>();
  for (const opening of opts.openings ?? []) {
    const previous = openings.get(opening.agentId);
    openings.set(opening.agentId, previous ? `${previous}\n\n${opening.scenarioHint}` : opening.scenarioHint);
  }
  const inbox = new Set<string>();
  if (opts.peerMessage) inbox.add(opts.peerMessage.toAgentId);
  for (const message of opts.extraPeerMessages ?? []) inbox.add(message.toAgentId);
  const hintFor = (agentId: string) => {
    const parts: string[] = [];
    if (agentId === opts.seedAgentId && opts.scenarioHint) parts.push(opts.scenarioHint);
    const extra = openings.get(agentId);
    if (extra) parts.push(extra);
    return parts.join("\n\n");
  };
  const sessions = run.agents.map((agent) => {
    const peers = run.agents.filter((a) => a.id !== agent.id);
    const hint = hintFor(agent.id);
    return createSession(agent, peers, {
      isSeed: Boolean(hint),
      scenarioHint: hint || undefined,
      peerInboxKickoff: inbox.has(agent.id) && !hint,
      readInbox: inbox.has(agent.id) && Boolean(hint),
      provenanceTag: tag,
      approvalGate: gate,
    });
  });

  try {
    await saveRun(run, traceBus.history(run.id));
    let cursor = 0;

    // Ends because every iteration that isn't skipped either spends one of an agent's
    // maxTurns or retires it for good (max_turns), skipped iterations are bounded by the
    // number of agents, and an agent can only be woken by mail sent during a turn.
    // (Skipping finished agents no longer eats into the turn budget of the active ones.)
    for (;;) {
      for (const s of sessions) wakeIfMailWaiting(run.id, s, maxTurns);
      if (sessions.every((s) => s.done)) break;

      const session = sessions[cursor % sessions.length];
      cursor += 1;

      if (session.done) continue;
      if (session.turnsUsed >= maxTurns) {
        session.done = true;
        session.stopReason = "max_turns";
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

      signal.throwIfAborted();
      await runOneTurn(run.id, session, client, maxTurns, signal);
      await saveRun(run, traceBus.history(run.id));
    }

    run.status = "completed";
    run.finishedAt = new Date().toISOString();
    traceBus.emit(run.id, "run.completed", { status: run.status });
  } catch (err) {
    // Trace events are public (GET /api/runs/:id, SSE): never leak key or proxy URL.
    const message = redactSecrets(err instanceof Error ? err.message : String(err));
    run.status = "failed";
    run.error = message;
    run.finishedAt = new Date().toISOString();
    traceBus.emit(run.id, "run.failed", { error: message });
  }
  await saveRun(run, traceBus.history(run.id));
  // Communication weights (who messaged whom). Never fails the run.
  if (run.skipCommRecording) return;
  try {
    await recordRunComms(run.id, traceBus.history(run.id));
  } catch (err) {
    console.error("No se pudieron registrar las comunicaciones de la ejecución", redactSecrets(String(err)));
  }
}
