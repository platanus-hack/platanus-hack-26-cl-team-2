/** A visitor's own Anthropic key (src/user-api-key.ts): format check, per-request scope, job handoff. No model calls. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.ANTHROPIC_API_KEY = "";

const { assertApiKeyConfigured } = await import("../src/config.js");
const { activeApiKey, normalizeUserApiKey, rememberJobApiKey, takeJobApiKey, userApiKey, withUserApiKey } = await import(
  "../src/user-api-key.js"
);
const { app } = await import("../src/app.js");

const KEY = "sk-ant-api03-" + "a".repeat(40);

describe("user API key", () => {
  it("accepts only strings shaped like an Anthropic key", () => {
    assert.equal(normalizeUserApiKey(`  ${KEY} `), KEY);
    assert.equal(normalizeUserApiKey("sk-ant-short"), "");
    assert.equal(normalizeUserApiKey("not a key"), "");
    assert.equal(normalizeUserApiKey(`${KEY}\nX-Evil: 1`), "");
    assert.equal(normalizeUserApiKey(undefined), "");
  });

  it("is visible only inside its request, including async work it starts", async () => {
    assert.equal(userApiKey(), "");
    await withUserApiKey(KEY, async () => {
      await new Promise((r) => setTimeout(r, 1));
      assert.equal(userApiKey(), KEY);
      assert.equal(activeApiKey(), KEY);
    });
    assert.equal(userApiKey(), "");
  });

  it("lets model calls start without a server key when the visitor sent one", () => {
    assert.throws(() => assertApiKeyConfigured(), /ANTHROPIC_API_KEY/);
    withUserApiKey(KEY, () => assert.doesNotThrow(() => assertApiKeyConfigured()));
  });

  it("hands a queued job's key to the worker once, then forgets it", () => {
    rememberJobApiKey("job-1", KEY);
    assert.equal(takeJobApiKey("job-1"), KEY);
    assert.equal(takeJobApiKey("job-1"), "");
    rememberJobApiKey("job-2", "");
    assert.equal(takeJobApiKey("job-2"), "");
  });

  it("allows the header through CORS and never echoes it back", async () => {
    const pre = await app.request("/api/runs", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-anthropic-api-key" },
    });
    assert.match(pre.headers.get("access-control-allow-headers") ?? "", /x-anthropic-api-key/i);
    const health = await app.request("/health", { headers: { "x-anthropic-api-key": KEY } });
    assert.ok(!(await health.text()).includes(KEY));
  });
});
