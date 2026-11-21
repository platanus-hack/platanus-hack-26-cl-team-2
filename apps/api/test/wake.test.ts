import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentSpec } from "@sandbox/shared";
import { traceBus } from "../src/events.js";
import { messageBus } from "../src/message-bus.js";
import { createSession, wakeIfMailWaiting, type AgentSession } from "../src/harness/agent-runner.js";

let n = 0;
const runId = () => `wake-run-${n++}`;

const seed: AgentSpec = { id: "camila", name: "Camila", role: "CS", goal: "help customers" };
const finance: AgentSpec = {
  id: "tomas",
  name: "Tomás",
  role: "Finance",
  goal: "pay vendors",
  financeTools: true,
};

/** Finance after it called `done` on an empty inbox (its done tool result is the last turn). */
function finishedFinance(run: string): AgentSession {
  messageBus.ensureAgents(run, [seed.id, finance.id]);
  const s = createSession(finance, [seed], { isSeed: false });
  s.messages.push({ role: "assistant", content: [{ type: "tool_use", id: "t1", name: "done", input: {} }] });
  s.messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "{}" }] });
  s.turnsUsed = 1;
  s.done = true;
  s.stopReason = "done";
  return s;
}

describe("waking agents that called done", () => {
  it("re-opens a finished agent when a peer messages it afterwards", () => {
    const run = runId();
    const s = finishedFinance(run);
    messageBus.send(run, seed.id, finance.id, "Vendor changed bank, please update the IBAN.");

    assert.equal(wakeIfMailWaiting(run, s, 6), true);
    assert.equal(s.done, false);
    assert.equal(s.stopReason, undefined);

    // The note goes into the last user turn, so roles keep alternating.
    assert.equal(s.messages.length, 3);
    const last = s.messages[2];
    assert.equal(last.role, "user");
    assert.ok(Array.isArray(last.content));
    const text = last.content.find((b) => b.type === "text");
    assert.match(text && "text" in text ? text.text : "", /1 new unread message/);

    // The mail is still unread (the agent reads it itself) and the wake-up is in the trace.
    assert.equal(messageBus.peek(run, finance.id).length, 1);
    const woken = traceBus.history(run).filter((e) => e.type === "agent.woken");
    assert.equal(woken.length, 1);
    assert.equal(woken[0].agentId, finance.id);
    assert.equal(woken[0].payload.unread, 1);
  });

  it("leaves a finished agent alone when no new mail arrived", () => {
    const run = runId();
    const s = finishedFinance(run);
    assert.equal(wakeIfMailWaiting(run, s, 6), false);
    assert.equal(s.done, true);
    assert.equal(s.messages.length, 3);
  });

  it("does not wake an agent that has used all its turns", () => {
    const run = runId();
    const s = finishedFinance(run);
    s.turnsUsed = 6;
    messageBus.send(run, seed.id, finance.id, "hello?");
    assert.equal(wakeIfMailWaiting(run, s, 6), false);
    assert.equal(s.done, true);
  });

  it("does not wake an agent stopped by the max_turns limit", () => {
    const run = runId();
    const s = finishedFinance(run);
    s.stopReason = "max_turns";
    messageBus.send(run, seed.id, finance.id, "hello?");
    assert.equal(wakeIfMailWaiting(run, s, 6), false);
    assert.equal(s.done, true);
  });

  it("does nothing to an agent that is still running", () => {
    const run = runId();
    messageBus.ensureAgents(run, [seed.id, finance.id]);
    const s = createSession(finance, [seed], { isSeed: false });
    messageBus.send(run, seed.id, finance.id, "hello?");
    assert.equal(wakeIfMailWaiting(run, s, 6), false);
    assert.equal(s.messages.length, 1);
  });
});
