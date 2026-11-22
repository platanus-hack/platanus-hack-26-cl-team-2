/**
 * "Evaluate every agent" batches: cost estimate, snapshots and the admin check.
 * No model call: the per-agent pipeline is driven by the browser, and here assessments are
 * written straight to the repository to stand in for it.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyVulnScores, inferAgentOrigin, type AgentProfile, type VulnBatch } from "@sandbox/shared";

const directory = mkdtempSync(join(tmpdir(), "mesh-vbatch-"));
process.env.DATABASE_URL = `file:${join(directory, "test.sqlite")}`;
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";
process.env.ADMIN_TOKEN = "batch-admin";
process.env.RATE_LIMIT_PER_MINUTE = "1000";
delete process.env.VERCEL;

const { default: app } = await import("../src/app.js");
const { getAgent, upsertAgent } = await import("../src/db/agents-repo.js");
const { upsertVulnAssessment } = await import("../src/db/vuln-repo.js");
const { estimateVulnBatch } = await import("../src/vuln-batches/routes.js");
after(() => {
  // Windows keeps the open SQLite file locked until the process exits; the OS temp dir is fine to leave.
  try {
    rmSync(directory, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

const ADMIN = { "x-admin-token": "batch-admin" };
const post = (path: string, body: unknown, headers: Record<string, string> = ADMIN) =>
  app.request(path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

function profile(id: string, name: string): AgentProfile {
  return {
    id,
    name,
    title: "Analista",
    areaId: "finance",
    knobs: { seniority: "mid", motivation: "quality", proactivity: "medium" },
    systemContext: "Eres analista de finanzas.",
    operatingStyle: ["Revisa antes de pagar."],
    goalTemplate: "Atiende la solicitud.",
    createdAt: new Date().toISOString(),
  };
}

before(async () => {
  await upsertAgent(profile("vb_a", "Ana"), { origin: "manual" });
  await upsertAgent(profile("vb_b", "Beto"), { origin: "manual" });
  // Not made by a person: the batch must leave these out unless picked by id.
  await upsertAgent(profile("vb_gen", "Finance 1"), { origin: "enterprise" });
  await upsertAgent(profile("vuln_test_1", "Vuln Test Agent"));
  // Ana was evaluated before; Beto never was.
  await upsertVulnAssessment({ agentId: "vb_a", scores: emptyVulnScores(40), summary: "antes" });
});

describe("agent origin", () => {
  it("infers generated and test agents saved before the origin was stored", () => {
    assert.equal(inferAgentOrigin({ id: "prof_1", name: "CSM 1" }), "enterprise");
    assert.equal(inferAgentOrigin({ id: "prof_2", name: "GTM (Sales) 12" }), "enterprise");
    assert.equal(inferAgentOrigin({ id: "prof_3", name: "Product + Design 2" }), "enterprise");
    assert.equal(inferAgentOrigin({ id: "prof_4", name: "Tomas" }), "manual");
    assert.equal(inferAgentOrigin({ id: "vuln_test_9", name: "Vuln Test Agent" }), "test");
    assert.equal(inferAgentOrigin({ id: "seed_cs", name: "Camila" }), "seed");
  });

  it("the agent creator saves as manual, and later saves keep the first origin", async () => {
    const res = await post("/api/profiles/save", { profile: profile("vb_new", "Nora") });
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as { agent: { origin: string } }).agent.origin, "manual");
    // The eval pipeline re-saves agents (to update notes) without an origin: it must not change.
    const gen = await getAgent("vb_gen");
    await upsertAgent(gen!, { orgHints: { notes: "resumen" } });
    assert.equal((await getAgent("vb_gen"))?.origin, "enterprise");
    assert.equal((await getAgent("vuln_test_1"))?.origin, "test");
  });
});

describe("estimateVulnBatch", () => {
  it("counts runs and calls from agents × 6 categories × rounds × turns", () => {
    const e = estimateVulnBatch({
      agentModels: ["claude-haiku-4-5", "claude-haiku-4-5"],
      settings: { iterations: 2, maxTurnsPerAgent: 3, concurrency: 2 },
      designerModel: "claude-haiku-4-5",
    });
    assert.equal(e.agents, 2);
    assert.equal(e.runs, 2 * 6 * 2);
    assert.equal(e.maxModelCalls, 2 * (2 + 6 * 2 * 3));
    assert.ok(e.approxMaxUsd > 0);
  });

  it("a pricier agent model raises the bound", () => {
    const settings = { iterations: 1, maxTurnsPerAgent: 6, concurrency: 1 };
    const cheap = estimateVulnBatch({ agentModels: ["claude-haiku-4-5"], settings, designerModel: "claude-haiku-4-5" });
    const dear = estimateVulnBatch({ agentModels: ["claude-sonnet-4-6"], settings, designerModel: "claude-haiku-4-5" });
    assert.ok(dear.approxMaxUsd > cheap.approxMaxUsd);
  });
});

describe("/api/vuln-batches", () => {
  it("writes need the admin token; reads and the estimate do not", async () => {
    assert.equal((await post("/api/vuln-batches", {}, {})).status, 401);
    assert.equal((await post("/api/vuln-batches/x/agents/vb_a", { status: "ok" }, {})).status, 401);
    assert.equal((await post("/api/vuln-batches/x/finish", { status: "completed" }, {})).status, 401);
    assert.equal((await app.request("/api/vuln-batches")).status, 200);
    const est = await post("/api/vuln-batches/estimate", {}, {});
    assert.equal(est.status, 200);
    // Default = only manual agents: Ana, Beto and Nora (saved in the test above), not "Finance 1" or the test agent.
    assert.equal(((await est.json()) as { estimate: { agents: number } }).estimate.agents, 3);
  });

  it("rejects unknown agents and bad settings", async () => {
    assert.equal((await post("/api/vuln-batches", { agentIds: ["nope"] })).status, 404);
    assert.equal((await post("/api/vuln-batches", { iterations: 9 })).status, 400);
  });

  it("snapshots scores before, records each agent after, then closes", async () => {
    const created = await post("/api/vuln-batches", { agentIds: ["vb_a", "vb_b"] });
    assert.equal(created.status, 201);
    const { batch } = (await created.json()) as { batch: VulnBatch };
    assert.equal(batch.status, "running");
    const [ana, beto] = batch.results;
    assert.equal(ana.agentId, "vb_a");
    assert.equal(ana.status, "pending");
    assert.equal(ana.previousScores?.tool_misuse, 40);
    assert.equal(beto.previousScores, null);

    // Ana's pipeline saves a new assessment; the batch copies it from the server.
    await upsertVulnAssessment({ agentId: "vb_a", scores: emptyVulnScores(65), summary: "después", runIds: ["r1"] });
    const okRes = await post(`/api/vuln-batches/${batch.id}/agents/vb_a`, { status: "ok" });
    assert.equal(okRes.status, 200);
    const afterAna = ((await okRes.json()) as { batch: VulnBatch }).batch.results[0];
    assert.equal(afterAna.status, "ok");
    assert.equal(afterAna.scores?.tool_misuse, 65);
    assert.deepEqual(afterAna.runIds, ["r1"]);

    // "ok" with no assessment saved during the batch is recorded as a failure.
    const stale = await post(`/api/vuln-batches/${batch.id}/agents/vb_b`, { status: "ok" });
    const afterBeto = ((await stale.json()) as { batch: VulnBatch }).batch.results[1];
    assert.equal(afterBeto.status, "failed");
    assert.equal(afterBeto.scores, null);
    assert.ok(afterBeto.error);

    assert.equal((await post(`/api/vuln-batches/${batch.id}/agents/ghost`, { status: "ok" })).status, 404);

    const finished = await post(`/api/vuln-batches/${batch.id}/finish`, { status: "completed" });
    assert.equal(((await finished.json()) as { batch: VulnBatch }).batch.status, "completed");
    assert.equal((await post(`/api/vuln-batches/${batch.id}/agents/vb_a`, { status: "ok" })).status, 409);

    const list = (await (await app.request("/api/vuln-batches")).json()) as { batches: VulnBatch[] };
    assert.equal(list.batches[0].id, batch.id);
    const one = await app.request(`/api/vuln-batches/${batch.id}`);
    assert.equal(((await one.json()) as { batch: VulnBatch }).batch.results.length, 2);
    assert.equal((await app.request("/api/vuln-batches/missing")).status, 404);
  });
});
