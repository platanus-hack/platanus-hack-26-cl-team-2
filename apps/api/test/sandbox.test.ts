import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { traceBus } from "../src/events.js";
import {
  DANGEROUS_TOOL,
  DEFAULT_ALLOWED,
  execSandboxed,
  FINANCE_TOOLS,
} from "../src/harness/sandbox.js";

let n = 0;
const runId = () => `test-run-${n++}`;

describe("finance sandbox (port of sandbox.py + tools.py)", () => {
  it("exposes the same two tools as email-harness Agent C", () => {
    assert.deepEqual(FINANCE_TOOLS.map((t) => t.name), ["issue_refund", "update_vendor_bank_account"]);
    assert.ok(!DEFAULT_ALLOWED.has(DANGEROUS_TOOL), "bank change must never be allowed by default");
  });

  it("simulates refunds", () => {
    const id = runId();
    const r = execSandboxed(id, "fin", "issue_refund", { order_id: "7712", amount: 19.99 });
    assert.deepEqual(r, { status: "ok", simulated: true, order_id: "7712", amount: 19.99 });
    const [ev] = traceBus.history(id);
    assert.equal(ev.type, "sandbox.tool_attempt");
    assert.equal(ev.payload.blocked, false);
    assert.equal(ev.payload.dangerous, false);
  });

  it("blocks the bank account change but still records the attempt", () => {
    const id = runId();
    const args = { vendor_id: "V-2210", iban: "GB29NWBK60161331926819" };
    const r = execSandboxed(id, "fin", DANGEROUS_TOOL, args);
    assert.deepEqual(r, { status: "blocked_by_sandbox", tool: DANGEROUS_TOOL });
    const events = traceBus.history(id);
    assert.equal(events.length, 1);
    assert.equal(events[0].agentId, "fin");
    assert.deepEqual(events[0].payload.args, args);
    assert.equal(events[0].payload.blocked, true);
    assert.equal(events[0].payload.dangerous, true);
  });

  it("blocks tools it does not know", () => {
    const id = runId();
    const r = execSandboxed(id, "fin", "delete_everything", {});
    assert.equal(r.status, "blocked_by_sandbox");
    assert.equal(traceBus.history(id)[0].payload.blocked, true);
  });

  it("only simulates the bank change even if someone adds it to the allow list", () => {
    // Allowed only means it runs the fake: it must still only return a simulated result.
    const id = runId();
    const r = execSandboxed(id, "fin", DANGEROUS_TOOL, { vendor_id: "V-1", iban: "X" }, new Set([DANGEROUS_TOOL]));
    assert.deepEqual(r, { status: "ok", simulated: true });
  });
});
