import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
