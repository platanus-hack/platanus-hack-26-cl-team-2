import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkSender, senderBanner } from "../src/email/sender-check.js";
import { listEmailScenarios } from "../src/email/scenarios.js";

const REPO = resolve(process.cwd(), "../..");

describe("sender check (port of sender_check.py)", () => {
  it("flags brand impersonation", () => {
    const r = checkSender("From: Microsoft Partner Payments <payments@ms-partner-billing.net>\n");
    assert.equal(r.verdict, "SUSPICIOUS");
    assert.match(r.reasons.join(), /claims 'microsoft' but domain is ms-partner-billing\.net/);
  });

  it("flags a fake subdomain of a consumer mail service", () => {
    const r = checkSender("From: PayPal Payouts <no-reply@payouts.paypal-resolution.hotmail.com>\n");
    assert.equal(r.verdict, "SUSPICIOUS");
    assert.ok(r.reasons.some((x) => x.includes("fake subdomain of consumer mail service hotmail.com")));
  });

  it("flags random-looking strings in the address", () => {
    const r = checkSender("From: Bonus <no-reply@uWRv1hyc8ZPI4OTfy70iEW0sn9lX.live.com>\n");
    assert.equal(r.verdict, "SUSPICIOUS");
    assert.ok(r.reasons.includes("random-looking string in the address"));
  });

  it("accepts an ordinary sender", () => {
    const r = checkSender("From: Maria Soto <maria.soto88@gmail.com>\nSubject: hi\n");
    assert.deepEqual(r, { verdict: "OK", reasons: [], address: "maria.soto88@gmail.com" });
  });

  it("accepts a brand name on the brand's own domain", () => {
    const r = checkSender("From: LinkedIn <games-discovery-noreply@linkedin.com>\n");
    assert.equal(r.verdict, "OK");
  });

  it("returns UNKNOWN without a From line", () => {
    assert.equal(checkSender("Please change the IBAN").verdict, "UNKNOWN");
  });

  it("builds the banner the agents see", () => {
    assert.equal(
      senderBanner({ verdict: "SUSPICIOUS", reasons: ["a", "b"], address: "x@y.z" }),
      "[Automated sender check: SUSPICIOUS - a; b]",
    );
    assert.equal(senderBanner({ verdict: "OK", reasons: [], address: null }), "[Automated sender check: OK]");
  });

  it("gives the same result as the Python version on every scenario email", (t) => {
    const script = [
      "import json, glob, os, sys, importlib.util",
      "spec = importlib.util.spec_from_file_location('sc', 'email-harness/src/mesh_harness/sender_check.py')",
      "m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)",
      "out = {}",
      "for f in sorted(glob.glob('email-harness/scenarios/*.json')):",
      "    for s in json.load(open(f, encoding='utf-8')):",
      "        r = m.check_sender(s['ticket'])",
      "        out[os.path.basename(f) + '#' + s['id']] = [r['verdict'], sorted(r['reasons'])]",
      "sys.stdout.write(json.dumps(out))",
    ].join("\n");
    // Many systems ship only `python3` (no `python`), others (Windows) only `python`.
    const run = (bin: string) =>
      spawnSync(bin, ["-I", "-c", script], { cwd: REPO, encoding: "utf-8" });
    let py = run("python3");
    if (py.error || py.status !== 0) py = run("python");
    if (py.error || py.status !== 0) {
      t.skip(`python3/python not available (${py.error?.message ?? py.stderr.trim()})`);
      return;
    }
    const expected = JSON.parse(py.stdout) as Record<string, [string, string[]]>;
    const { scenarios } = listEmailScenarios();
    assert.equal(scenarios.length, Object.keys(expected).length);
    for (const s of scenarios) {
      const key = `${s.file}#${s.id}`;
      assert.deepEqual([s.senderCheck.verdict, [...s.senderCheck.reasons].sort()], expected[key], key);
    }
  });
});
