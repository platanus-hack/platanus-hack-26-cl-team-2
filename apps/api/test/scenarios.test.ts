import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emailScenarioHint,
  getEmailScenario,
  listEmailScenarios,
} from "../src/email/scenarios.js";

describe("email scenarios (email-harness/scenarios)", () => {
  it("loads every scenario file without errors", () => {
    const { scenarios, errors } = listEmailScenarios();
    assert.deepEqual(errors, []);
    assert.ok(scenarios.length >= 25, `expected >= 25 emails, got ${scenarios.length}`);
    for (const s of scenarios) {
      assert.ok(["attack", "benign", "real_email"].includes(s.kind), `${s.id}: kind ${s.kind}`);
      assert.ok(s.email.length > 0, `${s.id}: empty email`);
    }
  });

  it("parses From and Subject headers", () => {
    const s = getEmailScenario({ file: "spoof_eval_demo.json", id: "spoof_02_fake_microsoft_bank" });
    assert.equal(s.kind, "attack");
    assert.equal(s.from, "Microsoft Partner Payments <payments@ms-partner-billing.net>");
    assert.equal(s.subject, "Action required: vendor remittance details");
    assert.equal(s.senderCheck.verdict, "SUSPICIOUS");
  });

  it("rejects file names that could escape the scenarios folder", () => {
    for (const file of ["../secret.json", "..\\secret.json", "a/b.json", "notes.txt"]) {
      assert.throws(() => getEmailScenario({ file, id: "x" }), /Invalid scenario file name/, file);
    }
  });

  it("reports an unknown id", () => {
    assert.throws(
      () => getEmailScenario({ file: "spoof_eval_demo.json", id: "does_not_exist" }),
      /Email scenario not found/,
    );
  });

  it("shows the sender-check banner only when the fix is on", () => {
    const s = getEmailScenario({ file: "spoof_eval_demo.json", id: "spoof_02_fake_microsoft_bank" });
    const off = emailScenarioHint(s.email);
    const on = emailScenarioHint(s.email, s.senderCheck);
    assert.ok(!off.includes("Automated sender check"));
    assert.ok(on.includes("[Automated sender check: SUSPICIOUS"));
    for (const hint of [off, on]) {
      assert.ok(hint.includes(s.email.trim()), "email body is passed through whole");
    }
  });

  it("keeps the seed prompt neutral (no resist/obey hints)", () => {
    const hint = emailScenarioHint("From: a <a@b.cd>\n\nhello").toLowerCase();
    for (const word of ["fraud", "phishing", "suspicious", "refuse", "ignore", "must comply"]) {
      assert.ok(!hint.includes(word), `prompt contains "${word}"`);
    }
  });
});
