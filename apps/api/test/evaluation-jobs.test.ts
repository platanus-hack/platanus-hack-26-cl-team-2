import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// Dedicated database, no real model credentials or network calls.
process.env.DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "mesh-eval-jobs-")), "test.sqlite")}`;
process.env.DB_DRIVER = "sqlite";
process.env.VERCEL = "";
process.env.ANTHROPIC_API_KEY = "";
process.env.MAX_JUDGE_CALLS_PER_DAY = "0";
process.env.MAX_SPEND_USD_PER_DAY = "0";
process.env.RATE_LIMIT_PER_MINUTE = "0";
process.env.ADMIN_TOKEN = "async-test-token";

test("durable asynchronous evaluation queue", async (t) => {
  const { composeProfile, normalizeVulnScores, VULN_CATEGORIES } = await import("@sandbox/shared");
  const { upsertAgent } = await import("../src/db/agents-repo.js");
  const repo = await import("../src/db/evaluation-jobs-repo.js");
  const { processEvaluationJob } = await import("../src/evaluation-jobs/worker.js");
  const { getVulnAssessment, upsertVulnAssessment } = await import("../src/db/vuln-repo.js");
  const agent = await upsertAgent(composeProfile({ areaId: "cs", name: "Soporte", knobs: { seniority: "mid", motivation: "quality", proactivity: "medium" } }));
  const brief = {
    classification: { areaId: "cs" as const, function: "Soporte de clientes", rationale: "Atiende tickets de la empresa." },
    scenarios: VULN_CATEGORIES.map((category) => ({ category, title: category, scenarioHint: "Contenido sintético para pruebas controladas.", grantFinanceTools: false, rationale: "test" })),
  };
  const create = (version = agent.updatedAt) => repo.createEvaluationJob({ company: "Prueba", iterations: 1, agents: [{ id: agent.id, name: agent.name, version }], completedSteps: 0, totalSteps: 8, phase: "En cola", agentStatus: {}, logs: [] });
  let calls = 0;
  const steps: Parameters<typeof processEvaluationJob>[1] = {
    design: async () => ({ agent, brief }),
    run: async ({ scenario }) => ({ category: scenario.category, runId: `mock-${++calls}`, status: "completed", trace: "No se ejecutaron acciones sensibles." }),
    finalize: async ({ runTraces }) => ({
      assessment: await upsertVulnAssessment({ agentId: agent.id, scores: normalizeVulnScores({ tool_misuse: 12 }), summary: "Prueba sintética", designerBrief: brief, runIds: runTraces.map((r) => r.runId) }),
      descriptionUpdated: false, previousScores: null,
    }),
  };

  await t.test("a job survives rereading and is claimed only once", async () => {
    const job = await create();
    assert.equal((await repo.getEvaluationJob(job.id))?.status, "queued");
    await Promise.all([processEvaluationJob(job.id, steps), processEvaluationJob(job.id, steps)]);
    const done = await repo.getEvaluationJob(job.id);
    assert.equal(done?.status, "completed", done?.phase);
    assert.equal(done?.completedSteps, 8);
    assert.equal(calls, 6);
    assert.equal((await getVulnAssessment(agent.id))?.designerBrief?.classification?.function, "Soporte de clientes");
  });
  await t.test("cancelling a queued job prevents execution", async () => {
    const job = await create();
    await repo.cancelEvaluationJob(job.id);
    await processEvaluationJob(job.id, steps);
    assert.equal((await repo.getEvaluationJob(job.id))?.status, "cancelled");
    assert.equal(calls, 6);
  });
  await t.test("cancels after a running step without overwriting previous attributes", async () => {
    const job = await create();
    await processEvaluationJob(job.id, { ...steps, run: async (input) => {
      const result = await steps.run(input);
      await repo.cancelEvaluationJob(job.id);
      return result;
    } });
    assert.equal((await repo.getEvaluationJob(job.id))?.status, "cancelled");
    assert.equal(calls, 7);
    assert.equal((await getVulnAssessment(agent.id))?.runIds.length, 6);
  });
  await t.test("failed model calls do not produce successful assessments", async () => {
    const job = await create();
    await processEvaluationJob(job.id, { ...steps, design: async () => { throw new Error("Synthetic model failure"); } });
    assert.equal((await repo.getEvaluationJob(job.id))?.status, "failed");
    assert.equal((await getVulnAssessment(agent.id))?.runIds.length, 6);
  });
  await t.test("does not evaluate a changed profile", async () => {
    const job = await create("old-profile-version");
    await processEvaluationJob(job.id, steps);
    assert.equal((await repo.getEvaluationJob(job.id))?.status, "failed");
    assert.equal(calls, 7);
  });
  await t.test("a lost worker is marked failed without automatic replay", async () => {
    const job = await create();
    await repo.claimEvaluationJob(job.id, "lost-worker");
    const { getSqliteDb } = await import("../src/db/client.js");
    const { evaluationJobsSqlite } = await import("../src/db/schema.sqlite.js");
    const { eq } = await import("drizzle-orm");
    getSqliteDb().update(evaluationJobsSqlite).set({ updatedAt: new Date(Date.now() - 6 * 60_000) }).where(eq(evaluationJobsSqlite.id, job.id)).run();
    await repo.expireEvaluationJobs();
    assert.equal((await repo.getEvaluationJob(job.id))?.status, "failed");
    assert.equal(await repo.claimEvaluationJob(job.id, "another-worker"), false);
  });
  await t.test("queue routes require admin authorization and expose persisted jobs", async () => {
    const { app } = await import("../src/app.js");
    for (const [path, method] of [["/api/evaluation-jobs", "GET"], ["/api/evaluation-jobs", "POST"], ["/api/evaluation-jobs/missing/cancel", "POST"]]) {
      assert.equal((await app.request(path, { method, headers: { "content-type": "application/json" }, ...(method === "POST" ? { body: "{}" } : {}) })).status, 401);
    }
    const response = await app.request("/api/evaluation-jobs", { headers: { "x-admin-token": "async-test-token" } });
    assert.equal(response.status, 200);
    assert.ok((await response.json()).jobs.length > 0);
  });
  await t.test("agents run together while each agent's iterations stay in order", async () => {
    const other = await upsertAgent(composeProfile({ areaId: "finance", name: "Finanzas", knobs: { seniority: "mid", motivation: "quality", proactivity: "medium" } }));
    const roster = [agent, other];
    const job = await repo.createEvaluationJob({
      company: "Prueba",
      iterations: 2,
      agents: roster.map((member) => ({ id: member.id, name: member.name, version: member.updatedAt })),
      completedSteps: 0,
      totalSteps: 28,
      phase: "En cola",
      agentStatus: {},
      logs: [],
    });
    let inFlight = 0;
    let maxInFlight = 0;
    const order: string[] = [];
    await processEvaluationJob(job.id, {
      design: async (agentId) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 30));
        inFlight -= 1;
        order.push(`design:${agentId}`);
        return { agent: roster.find((member) => member.id === agentId) ?? agent, brief };
      },
      run: async ({ agentId, scenario, iteration }) => {
        order.push(`${agentId}:${iteration}:${scenario.category}`);
        return { category: scenario.category, runId: `parallel-${agentId}-${iteration}-${scenario.category}`, status: "completed", trace: "No se ejecutaron acciones sensibles." };
      },
      finalize: steps.finalize,
    });
    assert.equal(maxInFlight, 2);
    for (const member of roster) {
      const runs = order.filter((entry) => entry.startsWith(`${member.id}:`));
      const firstSecond = runs.findIndex((entry) => entry.startsWith(`${member.id}:2:`));
      assert.ok(firstSecond > 0);
      assert.ok(runs.slice(0, firstSecond).every((entry) => entry.startsWith(`${member.id}:1:`)));
    }
    const done = await repo.getEvaluationJob(job.id);
    assert.equal(done?.status, "completed", done?.phase);
    assert.equal(done?.completedSteps, 28);
  });
});
