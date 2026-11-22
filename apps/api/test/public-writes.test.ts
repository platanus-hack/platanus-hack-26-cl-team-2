/**
 * ALLOW_PUBLIC_WRITES=1 opens writes even when deployed (RENDER) with ADMIN_TOKEN set.
 * Env is set before the app is imported; no API key, so nothing can reach the model.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";
process.env.RENDER = "1";
process.env.ADMIN_TOKEN = "public-writes-token";
process.env.ALLOW_PUBLIC_WRITES = "1";

type App = { request: (path: string, init?: RequestInit) => Response | Promise<Response> };
let app: App;

before(async () => {
  ({ app } = (await import("../src/app.js")) as unknown as { app: App });
});

describe("ALLOW_PUBLIC_WRITES", () => {
  it("lets a write through without x-admin-token", async () => {
    const res = await app.request("/api/agents/no-such-agent-public-writes", { method: "DELETE" });
    assert.notEqual(res.status, 401);
  });

  it("/health reports writes as public", async () => {
    const body = (await (await app.request("/health")).json()) as Record<string, unknown>;
    assert.equal(body.writesPublic, true);
    assert.equal(body.writesNeedAdminToken, false);
    assert.equal(body.writesDisabled, false);
  });
});
