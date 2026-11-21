/** Daily US$ spend cap (security/spend.ts) and its wiring into the client and the guard. No model calls. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { meterClient } from "../src/anthropic-client.js";
import { DemoGuard } from "../src/security/demo-guard.js";
import {
  SPEND_LIMIT_MESSAGE,
  SpendLimitError,
  SpendMeter,
  costUsd,
  modelErrorStatus,
} from "../src/security/spend.js";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

describe("spend: cost of a response", () => {
  it("prices Sonnet 4.6 and Haiku 4.5 per million tokens", () => {
    close(costUsd("claude-sonnet-4-6", { input_tokens: 1_000_000, output_tokens: 1_000_000 }), 18);
    close(costUsd("claude-haiku-4-5-20251001", { input_tokens: 1_000_000, output_tokens: 1_000_000 }), 6);
  });

  it("counts cache writes at 1.25x and cache reads at 0.1x of the input price", () => {
    close(
      costUsd("claude-sonnet-4-6", {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 1_000_000,
        cache_read_input_tokens: 1_000_000,
      }),
      3 * 1.25 + 3 * 0.1,
    );
  });

  it("prices an unknown model or old Opus 4/4.1 high (never under-counts) and ignores missing usage", () => {
    assert.ok(costUsd("some-future-model", { input_tokens: 1_000_000 }) >= 15);
    assert.ok(costUsd("claude-opus-4-1-20250805", { input_tokens: 1_000_000 }) >= 15);
    close(costUsd("claude-opus-4-6", { input_tokens: 1_000_000 }), 5);
    assert.equal(costUsd("claude-sonnet-4-6", null), 0);
    assert.equal(costUsd("claude-sonnet-4-6", { input_tokens: null, output_tokens: -5 }), 0);
  });
});

describe("spend: meter", () => {
  it("refuses once the day's budget is spent, then resets at UTC midnight", () => {
    let t = Date.UTC(2026, 10, 21, 23, 0, 0);
    const m = new SpendMeter({ limitUsd: 1, now: () => t });
    assert.deepEqual(m.check(), { ok: true });
    m.record("claude-sonnet-4-6", { input_tokens: 200_000, output_tokens: 30_000 }); // 0.6 + 0.45
    const denied = m.check();
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.message, SPEND_LIMIT_MESSAGE);
      assert.equal(denied.retryAfterSec, 3600);
    }
    t += 3600 * 1000;
    assert.deepEqual(m.check(), { ok: true });
    assert.equal(m.stats().spentUsd, 0);
  });

  it("CLI scripts (batch, mcp:quick) get no cap: only the HTTP server's guard module sets one", async () => {
    // This file loads anthropic-client and demo-guard, like the scripts, but never security/budget.
    const { spendMeter } = await import("../src/security/spend.js");
    assert.equal(spendMeter.stats().limitUsd, 0);
    assert.deepEqual(spendMeter.check(), { ok: true });
  });

  it("with limit 0 counts but never refuses", () => {
    const m = new SpendMeter();
    m.record("claude-sonnet-4-6", { input_tokens: 100_000_000 });
    assert.deepEqual(m.check(), { ok: true });
    assert.ok(m.stats().spentUsd > 0);
  });
});

describe("spend: metered client", () => {
  function fakeClient(usage: Anthropic.Usage | null) {
    let calls = 0;
    const client = {
      messages: {
        create: async () => {
          calls += 1;
          return { usage };
        },
      },
    } as unknown as Anthropic;
    return { client, calls: () => calls };
  }

  it("records the usage of every response", async () => {
    const meter = new SpendMeter({ limitUsd: 100 });
    const { client } = fakeClient({ input_tokens: 1_000_000, output_tokens: 0 } as Anthropic.Usage);
    meterClient(client, meter);
    await client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 10, messages: [] });
    await new Promise((r) => setImmediate(r));
    close(meter.stats().spentUsd, 3);
    assert.equal(meter.stats().calls, 1);
  });

  it("returns the SDK's own promise (APIPromise helpers like withResponse keep working)", async () => {
    const meter = new SpendMeter({ limitUsd: 100 });
    const original = Object.assign(Promise.resolve({ usage: { input_tokens: 1, output_tokens: 1 } }), {
      withResponse: () => "kept",
    });
    const client = { messages: { create: () => original } } as unknown as Anthropic;
    meterClient(client, meter);
    const returned = client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 10, messages: [] });
    assert.equal(returned, original);
    assert.equal((returned as unknown as { withResponse: () => string }).withResponse(), "kept");
    await returned;
  });

  it("charges a response without usage as if it used all of max_tokens (cap never goes blind)", async () => {
    const meter = new SpendMeter({ limitUsd: 100 });
    const { client } = fakeClient(null);
    meterClient(client, meter);
    await client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [] });
    await new Promise((r) => setImmediate(r));
    close(meter.stats().spentUsd, (1000 * 15) / 1_000_000);
  });

  it("over budget, throws before any request reaches the provider", async () => {
    const meter = new SpendMeter({ limitUsd: 0.5 });
    meter.record("claude-sonnet-4-6", { input_tokens: 1_000_000 });
    const { client, calls } = fakeClient(null);
    meterClient(client, meter);
    assert.throws(
      () => client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 10, messages: [] }),
      SpendLimitError,
    );
    assert.equal(calls(), 0);
  });

  it("maps a spend refusal to 429, a missing key to 503, anything else to 502", () => {
    assert.equal(modelErrorStatus(new SpendLimitError(), SPEND_LIMIT_MESSAGE), 429);
    assert.equal(modelErrorStatus(new Error("x"), "ANTHROPIC_API_KEY missing"), 503);
    assert.equal(modelErrorStatus(new Error("Connection error."), "Connection error."), 502);
  });
});

describe("spend: demo guard", () => {
  it("denies runs and model calls with reason 'budget' when the spend gate is closed", () => {
    let open = true;
    const g = new DemoGuard(
      {
        perIpPerMinute: 3,
        maxRunsPerDay: 40,
        maxConcurrentRuns: 3,
        maxJudgeCallsPerDay: 200,
        spendGate: () => (open ? { ok: true } : { ok: false, message: SPEND_LIMIT_MESSAGE, retryAfterSec: 60 }),
      },
      () => 0,
    );
    assert.equal(g.checkRun("1.1.1.1").ok, true);
    open = false;
    for (const r of [g.checkRun("2.2.2.2"), g.checkModelCall("3.3.3.3")]) {
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.reason, "budget");
    }
    // A refused request does not use up the client's per-IP slots or the daily counters.
    assert.equal(g.stats().runsToday, 1);
    assert.equal(g.stats().judgeCallsToday, 0);
    assert.equal(g.stats().trackedIps, 1); // only 1.1.1.1, from the allowed run
    open = true;
    for (let i = 0; i < 3; i++) assert.equal(g.checkRun("2.2.2.2").ok, true); // full quota intact
  });
});
