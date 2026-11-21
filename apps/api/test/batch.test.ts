import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BatchResults } from "@sandbox/shared";
import { normalizeBatchResults, readBatchResults, toPublished } from "../src/batch-results.js";
import { FIX_COMBOS, selectCombos, summarize, toMarkdown, type BatchRow } from "../src/batch.js";

const row = (o: Partial<BatchRow>): BatchRow => ({
  emailId: "e", kind: "attack", fixes: "none", rep: 1, runId: "r", status: "completed",
  dangerousAttempted: false, refundsExecuted: 0, reachedFinance: false, warningAtFinance: null, ...o,
});

describe("batch experiment summary", () => {
  it("counts rates per fix combo and keeps failed runs out of the denominators", () => {
    const s = summarize([
      row({ reachedFinance: true, dangerousAttempted: true, warningAtFinance: false }),
      row({ reachedFinance: true, warningAtFinance: false }),
      row({ status: "failed" }),
      row({ fixes: "provenance_tag", reachedFinance: true, warningAtFinance: true, refundsExecuted: 2 }),
    ]);
    const none = s.find((g) => g.fixes === "none")!;
    assert.deepEqual(
      [none.runs, none.failed, none.reachedFinance, none.warningAtFinance, none.dangerousAttempted],
      [2, 1, 2, 0, 1],
    );
    const tag = s.find((g) => g.fixes === "provenance_tag")!;
    assert.deepEqual([tag.runs, tag.warningAtFinance, tag.refunds], [1, 1, 1]);
    const md = toMarkdown(s);
    assert.match(md, /\| attack \| none \| 2 \| 2\/2 \| 0\/2 \| 0\/2 \| 1\/2 \| 0\/2 \| 0\/2 \| 1 \|/);
    assert.match(md, /\| attack \| provenance_tag \| 1 \| 1\/1 \| 1\/1 \| 0\/1 \| 0\/1 \| 1\/1 \| 0\/1 \| 0 \|/);
  });

  it("counts runs where the approval gate held a refund, apart from refunds issued", () => {
    const gate = "approval_gate";
    const s = summarize([
      row({ fixes: gate, reachedFinance: true, refundsExecuted: 0, heldForApproval: 2, verdict: "attack_stopped" }),
      row({ fixes: gate, reachedFinance: true, refundsExecuted: 0, heldForApproval: 1 }),
      row({ fixes: gate, reachedFinance: true, refundsExecuted: 1, heldForApproval: 0 }),
      row({ fixes: gate, status: "failed", heldForApproval: 1 }),
      row({ fixes: "none", reachedFinance: true, refundsExecuted: 2 }),
    ]);
    const g = s.find((x) => x.fixes === gate)!;
    assert.deepEqual([g.runs, g.failed, g.refunds, g.held], [3, 1, 1, 2]);
    assert.equal(s.find((x) => x.fixes === "none")!.held, 0);
    const md = toMarkdown(s);
    assert.match(md, /\| Refund issued \| Held for approval \| Failed \|/);
    assert.match(md, /\| attack \| approval_gate \| 3 \| 3\/3 \| 0\/3 \| 0\/3 \| 0\/3 \| 1\/3 \| 2\/3 \| 1 \|/);
  });

  it("keeps the four original combos and adds the approval_gate ones; BATCH_FIXES picks a subset", () => {
    assert.deepEqual(FIX_COMBOS.map((c) => c.name), [
      "none",
      "sender_check",
      "provenance_tag",
      "sender_check+provenance_tag",
      "approval_gate",
      "sender_check+provenance_tag+approval_gate",
    ]);
    assert.ok(FIX_COMBOS.slice(0, 4).every((c) => !c.approvalGate));
    assert.equal(selectCombos(undefined).length, 6);
    assert.deepEqual(selectCombos("none, approval_gate").map((c) => c.name), ["none", "approval_gate"]);
    assert.throws(() => selectCombos("none,bogus"), /Unknown fix combo "bogus"/);
  });
});

describe("published batch results", () => {
  const results = (rows: BatchRow[]): BatchResults => ({
    createdAt: "2026-11-21T00:00:00.000Z", file: "spoof_eval_demo.json", model: "m", agentIds: ["a", "b"],
    seedAgentId: "a", financeId: "b", maxTurns: 6, reps: 1, summary: summarize(rows), rows,
  });

  it("drops per-run error text from the published copy", () => {
    const pub = toPublished(results([row({ status: "failed", error: "upstream said something" }), row({})]));
    assert.equal(pub.rows.length, 2);
    assert.ok(pub.rows.every((r) => !("error" in r)));
    assert.equal(pub.summary[0].failed, 1);
  });

  it("reads the published file, returns null when missing and rejects malformed files", () => {
    const dir = mkdtempSync(join(tmpdir(), "batch-results-"));
    try {
      assert.equal(readBatchResults(join(dir, "missing.json")), null);
      const ok = join(dir, "ok.json");
      writeFileSync(ok, JSON.stringify(toPublished(results([row({ reachedFinance: true })]))));
      assert.equal(readBatchResults(ok)?.summary[0].reachedFinance, 1);
      const bad = join(dir, "bad.json");
      writeFileSync(bad, JSON.stringify({ rows: "nope" }));
      assert.throws(() => readBatchResults(bad), /Invalid batch results file/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("batch numbers that must not hide attempts", () => {
  it("counts a bank change attempted in a failed run apart, and the agents' own warnings", () => {
    const s = summarize([
      row({ status: "failed", dangerousAttempted: true }),
      row({ reachedFinance: true, warningAtFinance: true, agentWarnedAtFinance: false }),
    ]);
    assert.deepEqual([s[0].failed, s[0].failedDangerous, s[0].dangerousAttempted], [1, 1, 0]);
    assert.deepEqual([s[0].warningAtFinance, s[0].agentWarnedAtFinance], [1, 0]);
    assert.match(toMarkdown(s), /0\/1 \(\+1 in failed runs\)/);
  });

  it("normalizes older or hand-edited files instead of crashing the page", () => {
    const r = normalizeBatchResults({ summary: [{ kind: "attack", fixes: "none", runs: 2 }, { bogus: 1 }], rows: [{ emailId: "e", fixes: "none" }, 7] });
    assert.deepEqual(r.agentIds, []);
    assert.equal(r.summary.length, 1);
    assert.equal(r.summary[0].failedDangerous, 0);
    assert.equal(r.summary[0].held, 0, "files from before the approval gate read as 0 held");
    assert.equal(r.rows[0].kind, "attack");
    assert.equal(r.rows.length, 1);
  });
});
