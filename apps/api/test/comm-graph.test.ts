/**
 * Communication weights: counting messages from traces, turning totals into weights, and the
 * per-run rows staying idempotent. No model call.
 */
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, CommGraph, TraceEvent } from "@sandbox/shared";

const directory = mkdtempSync(join(tmpdir(), "mesh-comm-"));
process.env.DATABASE_URL = `file:${join(directory, "test.sqlite")}`;
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";
process.env.ADMIN_TOKEN = "comm-admin";
process.env.RATE_LIMIT_PER_MINUTE = "1000";
delete process.env.VERCEL;

const { default: app } = await import("../src/app.js");
const { upsertAgent } = await import("../src/db/agents-repo.js");
const { saveRun } = await import("../src/db/runs-repo.js");
const { recordRunComms, getCommGraph } = await import("../src/db/comm-repo.js");
const { buildCommGraph, countRunMessages } = await import("../src/harness/comm-graph.js");
after(() => {
  try {
    rmSync(directory, { recursive: true, force: true });
  } catch {
    /* Windows keeps the SQLite file locked until exit */
  }
});

let seq = 0;
function msg(runId: string, from: string, to: string, injected = false): TraceEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    runId,
    ts: "2026-11-21T10:00:00Z",
    type: "agent.message_sent",
    agentId: from,
    payload: { message: { id: `m${seq}`, runId, fromAgentId: from, toAgentId: to, body: "hola", ts: "" }, ...(injected ? { injected: true } : {}) },
  };
}

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

describe("countRunMessages", () => {
  it("counts sent messages per direction and skips injected, self and malformed ones", () => {
    const counts = countRunMessages([
      msg("r", "a", "b"),
      msg("r", "a", "b"),
      msg("r", "b", "a"),
      msg("r", "a", "b", true),
      msg("r", "a", "a"),
      { id: "x", runId: "r", ts: "", type: "agent.message_sent", payload: {} },
      { id: "y", runId: "r", ts: "", type: "agent.message_received", payload: { message: { fromAgentId: "a", toAgentId: "b" } } },
    ]);
    const byPair = Object.fromEntries(counts.map((c) => [`${c.from}>${c.to}`, c.messages]));
    assert.deepEqual(byPair, { "a>b": 2, "b>a": 1 });
  });
});

describe("buildCommGraph", () => {
  it("share is per sender, weight is relative to the busiest edge, unknown agents drop out", () => {
    const at = new Date("2026-11-21T10:00:00Z");
    const graph = buildCommGraph(
      [
        { from: "a", to: "b", messages: 6, runs: 3, lastAt: at },
        { from: "a", to: "c", messages: 2, runs: 1, lastAt: at },
        { from: "c", to: "a", messages: 3, runs: 2, lastAt: at },
        { from: "a", to: "ghost", messages: 50, runs: 9, lastAt: at },
      ],
      new Set(["a", "b", "c"]),
    );
    assert.equal(graph.totalMessages, 11);
    const ab = graph.edges.find((e) => e.from === "a" && e.to === "b")!;
    assert.equal(ab.share, 0.75); // 6 of the 8 a sent to saved agents
    assert.equal(ab.weight, 1);
    const ca = graph.edges.find((e) => e.from === "c" && e.to === "a")!;
    assert.equal(ca.share, 1);
    assert.equal(ca.weight, 0.5);
    assert.equal(graph.edges.some((e) => e.to === "ghost"), false);
    assert.equal(graph.edges[0].from, "a"); // busiest first
  });

  it("no data gives an empty graph", () => {
    assert.deepEqual(buildCommGraph([], new Set(["a"])).edges, []);
  });
});

describe("comm observations in the database", () => {
  it("recording a run twice replaces it instead of doubling, and the route sums runs", async () => {
    await upsertAgent(profile("cg_a", "Ana"), { origin: "manual" });
    await upsertAgent(profile("cg_b", "Beto"), { origin: "manual" });

    await recordRunComms("run1", [msg("run1", "cg_a", "cg_b"), msg("run1", "cg_a", "cg_b")]);
    await recordRunComms("run1", [msg("run1", "cg_a", "cg_b"), msg("run1", "cg_a", "cg_b")]);
    await recordRunComms("run2", [msg("run2", "cg_a", "cg_b"), msg("run2", "cg_b", "cg_a")]);

    const graph = await getCommGraph();
    const ab = graph.edges.find((e) => e.from === "cg_a" && e.to === "cg_b")!;
    assert.equal(ab.messages, 3);
    assert.equal(ab.runs, 2);
    assert.equal(graph.runsWithMessages, 2);

    const res = await app.request("/api/comm-graph");
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as { graph: CommGraph }).graph.totalMessages, 4);
  });

  it("rebuild needs the admin token and re-counts stored runs", async () => {
    const post = (headers: Record<string, string>) =>
      app.request("/api/comm-graph/rebuild", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: "{}" });
    assert.equal((await post({})).status, 401);

    await saveRun(
      { id: "run3", status: "completed", createdAt: "2026-11-21T11:00:00Z", finishedAt: "2026-11-21T11:01:00Z", agents: [], scenarioHint: "x" },
      [msg("run3", "cg_b", "cg_a"), msg("run3", "cg_b", "cg_a")],
    );
    const res = await post({ "x-admin-token": "comm-admin" });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { graph: CommGraph };
    const ba = body.graph.edges.find((e) => e.from === "cg_b" && e.to === "cg_a")!;
    // run3 (stored) adds 2 to the 1 from run2; rows of runs that were never stored are kept as they are.
    assert.equal(ba.messages, 3);
    assert.equal(ba.runs, 2);
  });
});
