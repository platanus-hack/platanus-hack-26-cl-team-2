import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientIp,
  DAILY_LIMIT_MESSAGE,
  DemoGuard,
  RATE_LIMIT_MESSAGE,
  type GuardOptions,
} from "../src/security/demo-guard.js";
import { isAdmin } from "../src/security/admin.js";
import { redactSecrets } from "../src/security/redact.js";
import { isRealMailFile } from "../src/email/scenarios.js";

function guard(opts: Partial<GuardOptions> = {}, active = () => 0) {
  let t = Date.UTC(2026, 10, 21, 12, 0, 0);
  const g = new DemoGuard(
    {
      perIpPerMinute: 3,
      maxRunsPerDay: 40,
      maxConcurrentRuns: 3,
      maxJudgeCallsPerDay: 200,
      now: () => t,
      ...opts,
    },
    active,
  );
  return { g, advance: (ms: number) => (t += ms) };
}

describe("demo guard: per-IP rate limit", () => {
  it("allows 3 model calls per minute per IP, then 429s with the Spanish message", () => {
    const { g } = guard();
    for (let i = 0; i < 3; i++) assert.equal(g.checkRun("1.1.1.1").ok, true);
    const r = g.checkRun("1.1.1.1");
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "rate");
      assert.equal(r.message, RATE_LIMIT_MESSAGE);
      assert.equal(r.message, "Límite de demo alcanzado, intenta en un minuto.");
      assert.ok(r.retryAfterSec >= 1 && r.retryAfterSec <= 60);
    }
  });

  it("judge/refine calls and runs share the same per-IP window", () => {
    const { g } = guard();
    assert.equal(g.checkRun("ip").ok, true);
    assert.equal(g.checkModelCall("ip").ok, true);
    assert.equal(g.checkModelCall("ip").ok, true);
    assert.equal(g.checkModelCall("ip").ok, false);
  });

  it("other IPs are not affected, and the window slides after a minute", () => {
    const { g, advance } = guard();
    for (let i = 0; i < 3; i++) g.checkRun("a");
    assert.equal(g.checkRun("a").ok, false);
    assert.equal(g.checkRun("b").ok, true);
    advance(60_001);
    assert.equal(g.checkRun("a").ok, true);
  });

  it("a denied request does not consume a slot", () => {
    const { g, advance } = guard({ perIpPerMinute: 1 });
    assert.equal(g.checkRun("a").ok, true);
    for (let i = 0; i < 5; i++) assert.equal(g.checkRun("a").ok, false);
    advance(60_001);
    assert.equal(g.checkRun("a").ok, true);
  });

  it("0 disables the per-IP limit", () => {
    const { g } = guard({ perIpPerMinute: 0 });
    for (let i = 0; i < 10; i++) assert.equal(g.checkModelCall("a").ok, true);
  });

  it("memory stays bounded under a flood of distinct (spoofed) addresses", () => {
    const { g } = guard({ maxTrackedIps: 100, maxJudgeCallsPerDay: 0 });
    for (let i = 0; i < 1000; i++) g.checkModelCall(`10.0.${Math.floor(i / 256)}.${i % 256}`);
    assert.ok(g.stats().trackedIps <= 100);
  });
});

describe("demo guard: global caps", () => {
  it("caps runs per day across all IPs and resets at UTC midnight", () => {
    const { g, advance } = guard({ maxRunsPerDay: 2, perIpPerMinute: 0 });
    assert.equal(g.checkRun("a").ok, true);
    assert.equal(g.checkRun("b").ok, true);
    const r = g.checkRun("c");
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "daily");
      assert.equal(r.message, DAILY_LIMIT_MESSAGE);
    }
    advance(12 * 3600_000 + 1);
    assert.equal(g.checkRun("c").ok, true);
  });

  it("caps judge/refine calls per day separately from runs", () => {
    const { g } = guard({ maxJudgeCallsPerDay: 1, perIpPerMinute: 0 });
    assert.equal(g.checkModelCall("a").ok, true);
    assert.equal(g.checkModelCall("b").ok, false);
    assert.equal(g.checkRun("b").ok, true);
  });

  it("refuses a run while MAX_CONCURRENT_RUNS are active, without counting it", () => {
    let active = 3;
    const { g } = guard({ maxConcurrentRuns: 3, maxRunsPerDay: 5 }, () => active);
    const r = g.checkRun("a");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "concurrent");
    assert.equal(g.stats().runsToday, 0);
    active = 2;
    assert.equal(g.checkRun("a").ok, true);
    assert.equal(g.stats().runsToday, 1);
  });
});

describe("client IP", () => {
  it("prefers the trusted header (Render: True-Client-IP from its Cloudflare edge)", () => {
    assert.equal(
      clientIp({
        trustedHeaderValue: "81.97.145.24",
        forwardedFor: "6.6.6.6, 81.97.145.24, 162.158.79.68, 10.226.0.196",
      }),
      "81.97.145.24",
    );
  });

  it("with trusted hops, reads X-Forwarded-For from the right (left side is client-controlled)", () => {
    assert.equal(clientIp({ forwardedFor: "6.6.6.6, 203.0.113.7", trustedHops: 1 }), "203.0.113.7");
    assert.equal(clientIp({ forwardedFor: "6.6.6.6, 203.0.113.7, 10.0.0.1", trustedHops: 2 }), "203.0.113.7");
    assert.equal(clientIp({ forwardedFor: "203.0.113.7", trustedHops: 3 }), "203.0.113.7");
  });

  it("with hops ignores garbage entries", () => {
    assert.equal(clientIp({ forwardedFor: "<script>, 2001:DB8::1", trustedHops: 1 }), "2001:db8::1");
  });

  it("without hops ignores X-Forwarded-For (client-written) and uses the socket", () => {
    assert.equal(clientIp({ forwardedFor: "203.0.113.7", remoteAddress: "10.0.0.5" }), "10.0.0.5");
    // Rotating the header does not give a fresh bucket.
    assert.equal(
      clientIp({ forwardedFor: "198.51.100.1", remoteAddress: "10.0.0.5" }),
      clientIp({ forwardedFor: "198.51.100.2", remoteAddress: "10.0.0.5" }),
    );
  });

  it("falls back to the socket address, then 'unknown'", () => {
    assert.equal(clientIp({ forwardedFor: "", remoteAddress: "::1" }), "::1");
    assert.equal(clientIp({ trustedHeaderValue: "not an ip" }), "unknown");
  });
});

describe("admin token, redaction, real-mail files", () => {
  it("writes are open without ADMIN_TOKEN and need the exact token with it", () => {
    assert.equal(isAdmin(undefined, undefined), true);
    assert.equal(isAdmin(undefined, "s3cret-token"), false);
    assert.equal(isAdmin("wrong", "s3cret-token"), false);
    assert.equal(isAdmin("s3cret-token", "s3cret-token"), true);
  });

  it("deployed (failClosed) without ADMIN_TOKEN, writes are blocked instead of open", () => {
    assert.equal(isAdmin(undefined, undefined, true), false);
    assert.equal(isAdmin("anything", undefined, true), false);
    assert.equal(isAdmin("s3cret-token", "s3cret-token", true), true);
  });

  it("redacts the API key, proxy URL and DB credentials from error text", () => {
    const msg = redactSecrets(
      "401 from https://proxy.example.com/v1 key=sk-ant-api03-abcDEF_123 other=sk-ant-zzz db postgresql://u:p@h/db",
      ["https://proxy.example.com"],
    );
    assert.doesNotMatch(msg, /proxy\.example\.com|sk-ant-|u:p@/);
    assert.match(msg, /\[redacted\]/);
  });

  it("recognises the git-ignored real-mailbox files", () => {
    assert.equal(isRealMailFile("gmail_inbox.json"), true);
    assert.equal(isRealMailFile("outlook_2026.json"), true);
    assert.equal(isRealMailFile("spoof_eval.json"), true);
    assert.equal(isRealMailFile("spoof_eval_demo.json"), false);
    assert.equal(isRealMailFile("bec_realistic.json"), false);
  });
});
