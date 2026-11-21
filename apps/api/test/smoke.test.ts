/**
 * Smoke tests against a RUNNING app (pnpm run dev). Skipped if the API is not up.
 * They never call the model: every run request here is rejected before an agent starts,
 * so they cost nothing. Override the address with SMOKE_API_URL.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

const API = process.env.SMOKE_API_URL ?? "http://localhost:8787";

async function up(): Promise<boolean> {
  try {
    return (await fetch(`${API}/health`, { signal: AbortSignal.timeout(2000) })).ok;
  } catch {
    return false;
  }
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { error?: string } };
}

describe(`running app at ${API}`, async () => {
  const running = await up();
  let agentIds: string[] = [];

  before(async () => {
    if (!running) return;
    const data = (await (await fetch(`${API}/api/agents`)).json()) as { agents: Array<{ id: string }> };
    agentIds = data.agents.map((a) => a.id);
  });

  const test = (name: string, fn: () => Promise<void>, needsAgents = false) =>
    it(name, async (t) => {
      if (!running) return t.skip("API not running (start it with: pnpm run dev)");
      if (needsAgents && agentIds.length < 2) return t.skip("needs 2 saved agents (Enterprise generator)");
      await fn();
    });

  test("health reports database and API key", async () => {
    const h = (await (await fetch(`${API}/health`)).json()) as Record<string, unknown>;
    assert.equal(h.ok, true);
    assert.equal(h.hasDatabase, true);
    assert.equal(typeof h.hasApiKey, "boolean");
  });

  test("lists the email-harness emails with sender checks", async () => {
    const res = await fetch(`${API}/api/email-scenarios`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as {
      scenarios: Array<{ id: string; senderCheck: { verdict: string } }>;
      errors: string[];
    };
    assert.deepEqual(data.errors, []);
    assert.ok(data.scenarios.length >= 25);
    const spoof = data.scenarios.find((s) => s.id === "spoof_02_fake_microsoft_bank");
    assert.equal(spoof?.senderCheck.verdict, "SUSPICIOUS");
  });

  test("rejects a scenario file name that tries to leave the folder", async () => {
    const r = await post("/api/runs/from-stored", {
      agentIds: ["a", "b"], seedAgentId: "a",
      emailScenario: { file: "../secret.json", id: "x" },
    });
    assert.equal(r.status, 400);
  });

  test("rejects finance tools for an agent that is not in the run", async () => {
    const [a, b] = agentIds;
    const r = await post("/api/runs/from-stored", {
      agentIds: [a, b], seedAgentId: a, financeAgentIds: ["not-in-run"],
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error ?? "", /financeAgentIds/);
  }, true);

  test("returns 404 for an unknown email id", async () => {
    const [a, b] = agentIds;
    const r = await post("/api/runs/from-stored", {
      agentIds: [a, b], seedAgentId: a,
      emailScenario: { file: "spoof_eval_demo.json", id: "does_not_exist" },
    });
    assert.equal(r.status, 404);
  }, true);

  test("returns 404 for an unknown run", async () => {
    const res = await fetch(`${API}/api/runs/no-such-run`);
    assert.equal(res.status, 404);
  });
});
