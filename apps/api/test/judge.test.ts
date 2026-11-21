import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TraceEvent } from "@sandbox/shared";
import { FIX_NAMES } from "../src/harness/fixes.js";
import { condenseTrace, judgeTool, normalizeAudit } from "../src/harness/judge.js";

type Schema = { properties: Record<string, { enum?: string[] }>; required: string[] };
const schemaOf = (withAudit: boolean) => judgeTool(withAudit).input_schema as unknown as Schema;

describe("judge with email auditor", () => {
  it("adds the audit fields only for email runs", () => {
    const plain = schemaOf(false);
    const audit = schemaOf(true);
    for (const k of ["outcomeOk", "reasoningOk", "missedRisk", "recommendedFix"]) {
      assert.ok(!(k in plain.properties), `plain judge has ${k}`);
      assert.ok(k in audit.properties, `audit judge lacks ${k}`);
      assert.ok(audit.required.includes(k), `${k} not required`);
    }
    // The original fields stay required.
    for (const k of plain.required) assert.ok(audit.required.includes(k), k);
  });

  it("only lets the judge pick fixes from the catalog", () => {
    assert.deepEqual(schemaOf(true).properties.recommendedFix.enum, [...FIX_NAMES, "none"]);
    assert.ok(FIX_NAMES.includes("sender_check"));
  });

  it("turns an invented fix into 'none'", () => {
    const a = normalizeAudit({ outcomeOk: true, reasoningOk: false, missedRisk: "x", recommendedFix: "rm_rf" });
    assert.deepEqual(a, { outcomeOk: true, reasoningOk: false, missedRisk: "x", recommendedFix: "none" });
  });

  it("returns no audit when the booleans are missing", () => {
    assert.equal(normalizeAudit({ summary: "s", score: 5 }), undefined);
  });

  it("shows sandbox attempts in the condensed trace", () => {
    const events: TraceEvent[] = [
      { id: "1", runId: "r", ts: "", type: "sandbox.tool_attempt", agentId: "fin",
        payload: { tool: "update_vendor_bank_account", args: { vendor_id: "V-1" }, blocked: true } },
      { id: "2", runId: "r", ts: "", type: "sandbox.tool_attempt", agentId: "fin",
        payload: { tool: "issue_refund", args: { order_id: "7" }, blocked: false } },
    ];
    const text = condenseTrace(events, new Map([["fin", "Finance Bot"]]));
    assert.match(text, /TOOL Finance Bot: update_vendor_bank_account .*\[BLOCKED BY SANDBOX\]/);
    assert.match(text, /TOOL Finance Bot: issue_refund .*\[executed, simulated\]/);
  });
});
