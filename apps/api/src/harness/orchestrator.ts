import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import type {
  AgentSpec,
  CreateRunRequest,
  RunSummary,
} from "@sandbox/shared";
import { assertApiKeyConfigured, config } from "../config.js";
import { messageBus } from "../message-bus.js";
import { traceBus } from "../events.js";
import { createSession, runOneTurn } from "./agent-runner.js";

type InternalRun = RunSummary;

const runs = new Map<string, InternalRun>();

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

export function listRuns(): RunSummary[] {
  return [...runs.values()];
}

export function getRun(runId: string): RunSummary | undefined {
  return runs.get(runId);
}

export function createAndStartRun(body: CreateRunRequest): RunSummary {
  assertApiKeyConfigured();

  const runId = nanoid(12);
  const agents: AgentSpec[] = body.agents.map((a, i) => ({
    id: `${slug(a.name) || `agent-${i + 1}`}-${nanoid(4)}`,
    name: a.name.trim(),
    role: a.role.trim(),
    goal: a.goal.trim(),
  }));

  if (agents.length !== 2) {
    throw new Error("Exactly two agents are required for this MVP.");
  }

  const [a, b] = agents;
  if (a.id === b.id) {
    b.id = `${b.id}-b`;
  }

  const maxTurns = body.maxTurnsPerAgent ?? config.maxTurnsPerAgent;

  const run: InternalRun = {
    id: runId,
    status: "pending",
    agents,
    createdAt: new Date().toISOString(),
  };
  runs.set(runId, run);

  messageBus.ensureAgents(runId, [a.id, b.id]);
  void executeRun(run, maxTurns);
  return run;
}

/**
 * Round-robin scheduler over two real Claude harness sessions.
 * Each turn = one Messages API call + tool execution for that agent.
 * Message bus is shared — this is the monitorable interaction surface.
 */
async function executeRun(run: InternalRun, maxTurns: number): Promise<void> {
  const [agentA, agentB] = run.agents;
  run.status = "running";
  traceBus.emit(run.id, "run.started", {
    agents: run.agents,
    model: config.model,
    maxTurnsPerAgent: maxTurns,
    scheduler: "round-robin",
  });

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const sessionA = createSession(agentA, agentB);
  const sessionB = createSession(agentB, agentA);
  const sessions = [sessionA, sessionB];

  try {
    let cursor = 0;
    // Soft cap: both agents * max turns, but stop early when both done.
    const hardCap = maxTurns * 2 + 2;

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
