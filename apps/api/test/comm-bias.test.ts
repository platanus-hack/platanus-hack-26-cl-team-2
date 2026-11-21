/**
 * Communication bias: habits attached to agents only when asked, and how they read in the prompt.
 * No model call: prepareStoredRun only builds the run (the fake key never reaches a server).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, AgentSpec, TraceEvent } from "@sandbox/shared";

const directory = mkdtempSync(join(tmpdir(), "mesh-bias-"));
process.env.DATABASE_URL = `file:${join(directory, "test.sqlite")}`;
process.env.ANTHROPIC_API_KEY = "sk-test-not-real";
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";
delete process.env.VERCEL;

const { upsertAgent } = await import("../src/db/agents-repo.js");
const { recordRunComms } = await import("../src/db/comm-repo.js");
const { prepareStoredRun } = await import("../src/harness/orchestrator.js");
const { habitNote, systemPrompt } = await import("../src/harness/agent-runner.js");
after(() => {
  try {
    rmSync(directory, { recursive: true, force: true });
  } catch {
    /* Windows keeps the SQLite file locked until exit */
  }
});

function profile(id: string, name: string): AgentProfile {
  return {
    id,
    name,
    title: "Analista",
    areaId: "cs",
    knobs: { seniority: "mid", motivation: "quality", proactivity: "medium" },
    systemContext: "Eres analista.",
    operatingStyle: ["Responde breve."],
    goalTemplate: "Atiende.",
    createdAt: new Date().toISOString(),
  };
}

let seq = 0;
const msg = (runId: string, from: string, to: string): TraceEvent => {
  seq += 1;
  return {
    id: `e${seq}`,
    runId,
    ts: "",
    type: "agent.message_sent",
    payload: { message: { id: `m${seq}`, runId, fromAgentId: from, toAgentId: to, body: "", ts: "" } },
  };
};

before(async () => {
  for (const [id, name] of [["cb_a", "Ana"], ["cb_b", "Beto"], ["cb_c", "Carla"], ["cb_d", "Dario"]]) {
    await upsertAgent(profile(id, name), { origin: "manual" });
  }
  // Ana: 3 to Beto, 1 to Carla, 4 to Dario (Dario is not in the run below).
  await recordRunComms("r1", [msg("r1", "cb_a", "cb_b"), msg("r1", "cb_a", "cb_b"), msg("r1", "cb_a", "cb_c")]);
  await recordRunComms("r2", [msg("r2", "cb_a", "cb_b"), ...Array.from({ length: 4 }, () => msg("r2", "cb_a", "cb_d"))]);
});

describe("prepareStoredRun with commBias", () => {
  const base = { agentIds: ["cb_a", "cb_b", "cb_c"], seedAgentId: "cb_a", scenarioHint: "Revisa el ticket." };

  it("off by default: no habits on any agent", async () => {
    const prepared = await prepareStoredRun(base);
    assert.ok(prepared.agents.every((a) => a.commHabits === undefined));
  });

  it("on: each agent gets its past shares, only toward peers in this run", async () => {
    const prepared = await prepareStoredRun({ ...base, commBias: true });
    const ana = prepared.agents.find((a) => a.id === "cb_a")!;
    const byPeer = Object.fromEntries((ana.commHabits ?? []).map((h) => [h.toAgentId, h]));
    assert.deepEqual(Object.keys(byPeer).sort(), ["cb_b", "cb_c"]); // Dario is not in the run
    assert.equal(byPeer.cb_b.messages, 3);
    assert.equal(byPeer.cb_b.runs, 2);
    assert.equal(byPeer.cb_b.share, 0.375); // 3 of Ana's 8 messages to saved agents
    const beto = prepared.agents.find((a) => a.id === "cb_b")!;
    assert.deepEqual(beto.commHabits, []);
  });
});

describe("systemPrompt with habits", () => {
  const peer = (id: string, name: string): AgentSpec => ({ id, name, role: "r", goal: "g" });
  const ana: AgentSpec = {
    id: "a",
    name: "Ana",
    role: "role",
    goal: "goal",
    commHabits: [{ toAgentId: "c", share: 0.6, messages: 6, runs: 3 }],
  };

  it("lists usual contacts first with their share, and keeps everyone messageable", () => {
    const prompt = systemPrompt(ana, [peer("b", "Beto"), peer("c", "Carla")]);
    const carla = prompt.indexOf("- Carla (id: c)");
    const beto = prompt.indexOf("- Beto (id: b)");
    assert.ok(carla > -1 && beto > carla, "usual contact listed first");
    assert.match(prompt, /your usual contact: 60% of the messages you sent in past runs \(6 messages over 3 runs\)/);
    assert.match(prompt, /message whoever it actually needs/);
    assert.match(prompt, /Valid to_agent_id values: b, c/);
  });

  it("no habits: the prompt has no bias text", () => {
    const prompt = systemPrompt({ ...ana, commHabits: [] }, [peer("b", "Beto"), peer("c", "Carla")]);
    assert.doesNotMatch(prompt, /usual contact/);
    assert.ok(prompt.indexOf("- Beto (id: b)") < prompt.indexOf("- Carla (id: c)"), "original order kept");
  });

  it("tiny shares still show as at least 1%", () => {
    assert.match(habitNote({ share: 0.001, messages: 1, runs: 1 }), /1% .*\(1 messages over 1 run\)/);
  });
});
