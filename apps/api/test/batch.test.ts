import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BatchResults } from "@sandbox/shared";
import { readBatchResults, toPublished } from "../src/batch-results.js";
import { summarize, toMarkdown, type BatchRow } from "../src/batch.js";

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
    assert.match(md, /\| attack \| none \| 2 \| 2\/2 \| 0\/2 \| 1\/2 \| 0\/2 \| 1 \|/);
    assert.match(md, /\| attack \| provenance_tag \| 1 \| 1\/1 \| 1\/1 \| 0\/1 \| 1\/1 \| 0 \|/);
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
