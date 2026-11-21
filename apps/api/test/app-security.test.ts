/**
 * HTTP-level security checks through app.request() (no server, no model call).
 * Env is set before the app is imported: no API key (so nothing can reach the model), an
 * unroutable proxy as a second safety net, an admin token, and a 1-per-minute limit.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";
process.env.ADMIN_TOKEN = "test-admin-token";
process.env.RATE_LIMIT_PER_MINUTE = "1";
process.env.RENDER = "";
process.env.CLIENT_IP_HEADER = "";
// One trusted proxy: the client IP is the rightmost X-Forwarded-For entry (what it appended).
process.env.TRUST_PROXY_HOPS = "1";

type App = { request: (path: string, init?: RequestInit) => Response | Promise<Response> };
let app: App;

before(async () => {
  ({ app } = (await import("../src/app.js")) as unknown as { app: App });
});

const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

describe("API security (in-process)", () => {
  it("rejects a cross-site 'simple' POST (text/plain) before parsing it", async () => {
    const res = await app.request("/api/judge/transcript", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ transcript: "x".repeat(50) }),
    });
    assert.equal(res.status, 415);
  });

  it("rejects bodies over 1 MB", async () => {
    const res = await app.request(
      "/api/judge/transcript",
      json({ transcript: "x".repeat(1024 * 1024 + 10) }),
    );
    assert.equal(res.status, 413);
  });

  it("allows the CORS preflight to carry x-admin-token", async () => {
    const res = await app.request("/api/agents/x", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "DELETE",
        "Access-Control-Request-Headers": "x-admin-token",
      },
    });
    assert.match(res.headers.get("access-control-allow-headers") ?? "", /x-admin-token/i);
  });

  it("with ADMIN_TOKEN set, writes without the token get 401", async () => {
    const del = await app.request("/api/agents/seed_cs", { method: "DELETE" });
    assert.equal(del.status, 401);
    const put = await app.request("/api/agents", { ...json({}), method: "PUT" });
    assert.equal(put.status, 401);
    const ctx = await app.request("/api/agents/seed_cs/context-files", json({ name: "a", content: "b" }));
    assert.equal(ctx.status, 401);
    const gen = await app.request("/api/enterprise/generate", json({ counts: { gtm: 1 } }));
    assert.equal(gen.status, 401);
    const wrong = await app.request("/api/enterprise/generate", json({ counts: { gtm: 1 } }, { "x-admin-token": "nope" }));
    assert.equal(wrong.status, 401);
  });

  it("the vulnerability eval routes are writes: 401 without the token, readable without it", async () => {
    for (const route of ["vuln-assess", "vuln-design", "vuln-run-one", "vuln-finalize"]) {
      const res = await app.request(`/api/agents/seed_cs/${route}`, json({}));
      assert.equal(res.status, 401, route);
    }
    const read = await app.request("/api/agents/no-such-agent/vuln-assessment");
    assert.equal(read.status, 404);
  });

  it("the vulnerability eval routes stop with 429 once the daily US$ budget is spent", async () => {
    const { spendMeter } = await import("../src/security/spend.js");
    spendMeter.setLimit(0.01);
    spendMeter.record("claude-sonnet-4-6", { input_tokens: 10_000, output_tokens: 1_000 });
    try {
      const res = await app.request(
        "/api/agents/seed_cs/vuln-design",
        json({}, { "x-admin-token": "test-admin-token" }),
      );
      assert.equal(res.status, 429);
      assert.equal(((await res.json()) as { reason: string }).reason, "budget");
    } finally {
      spendMeter.setLimit(0);
    }
  });

  it("an enterprise preview (persist=false) stays public", async () => {
    const res = await app.request("/api/enterprise/generate", json({ counts: { gtm: 2 }, persist: false }));
    assert.equal(res.status, 200);
    const data = (await res.json()) as { saved: number; total: number };
    assert.equal(data.total, 2);
    assert.equal(data.saved, 0);
  });

  it("rate-limits model-calling routes per IP with a Spanish 429 (no model call: no API key)", async () => {
    const body = json({ transcript: "agent A: hola, agent B: transferir fondos ahora" }, { "x-forwarded-for": "198.51.100.9" });
    const first = await app.request("/api/judge/transcript", body);
    assert.equal(first.status, 503); // allowed by the guard, then stopped by the missing key
    const second = await app.request("/api/judge/transcript", body);
    assert.equal(second.status, 429);
    assert.ok(second.headers.get("retry-after"));
    const data = (await second.json()) as { error: string };
    assert.equal(data.error, "Límite de demo alcanzado, intenta en un minuto.");
    // Another client is not affected.
    const other = await app.request("/api/judge/transcript", json({ transcript: "agent A: hola, agent B: hola de vuelta" }, { "x-forwarded-for": "198.51.100.10" }));
    assert.equal(other.status, 503);
    // A client cannot escape its bucket by prepending a fake address (the proxy appends the real one).
    const spoofed = await app.request(
      "/api/judge/transcript",
      json({ transcript: "agent A: hola, agent B: transferir fondos ahora" }, { "x-forwarded-for": "6.6.6.6, 198.51.100.9" }),
    );
    assert.equal(spoofed.status, 429);
  });

  it("refuses model-calling routes with 429 once the daily US$ budget is spent", async () => {
    const { spendMeter, SPEND_LIMIT_MESSAGE } = await import("../src/security/spend.js");
    spendMeter.setLimit(0.01);
    spendMeter.record("claude-sonnet-4-6", { input_tokens: 10_000, output_tokens: 1_000 }); // ~US$0.045
    try {
      const res = await app.request(
        "/api/judge/transcript",
        json({ transcript: "agent A: hola, agent B: hola de vuelta" }, { "x-forwarded-for": "198.51.100.77" }),
      );
      assert.equal(res.status, 429);
      const data = (await res.json()) as { error: string; reason: string };
      assert.equal(data.reason, "budget");
      assert.equal(data.error, SPEND_LIMIT_MESSAGE);
    } finally {
      spendMeter.setLimit(0);
    }
  });

  it("does not leak the scenarios folder path or real-mailbox files", async () => {
    const res = await app.request("/api/email-scenarios");
    const data = (await res.json()) as { dir?: string; scenarios: Array<{ file: string }> };
    assert.equal(data.dir, undefined);
    assert.ok(data.scenarios.every((s) => !/^(gmail_|outlook_|spoof_eval\.json$)/.test(s.file)));
    const run = await app.request(
      "/api/runs/from-stored",
      json({ agentIds: ["a", "b"], seedAgentId: "a", emailScenario: { file: "gmail_inbox.json", id: "x" } }),
    );
    assert.equal(run.status, 403);
  });

  it("health does not expose the key or proxy URL", async () => {
    const text = await (await app.request("/health")).text();
    assert.doesNotMatch(text, /127\.0\.0\.1:9|test-admin-token/);
  });
});
