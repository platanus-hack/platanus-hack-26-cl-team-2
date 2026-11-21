import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TraceEvent } from "@sandbox/shared";
import {
  habitsFrom,
  runMessages,
  summarizeBias,
  topContact,
  type BiasRow,
} from "../src/harness/comm-bias-compare.js";

let n = 0;
const msg = (from: string, to: string, injected = false): TraceEvent => ({
  id: String(n++),
  runId: "r",
  ts: "",
  type: "agent.message_sent",
  agentId: from,
  payload: { message: { fromAgentId: from, toAgentId: to, body: "hi" }, ...(injected ? { injected: true } : {}) },
});

const ids = ["cam", "tom", "mat", "it"];
// Camila mostly talks to Tomas, then Mateo. IT talks to Tomas. Outsiders are ignored.
const habits = habitsFrom(
  [
    { from: "cam", to: "tom", messages: 13 },
    { from: "cam", to: "mat", messages: 8 },
    { from: "it", to: "tom", messages: 6 },
    { from: "cam", to: "outsider", messages: 50 },
  ],
  ids,
);

describe("bias on vs off comparison", () => {
  it("keeps only pairs inside the run and finds each sender's #1 contact", () => {
    assert.deepEqual([...habits.get("cam")!.keys()].sort(), ["mat", "tom"]);
    assert.equal(topContact(habits, "cam"), "tom");
    assert.equal(topContact(habits, "it"), "tom");
    assert.equal(topContact(habits, "mat"), null);
  });

  it("records each sender's first recipient and skips injected messages", () => {
    const m = runMessages([msg("cam", "it", true), msg("cam", "mat"), msg("cam", "tom"), msg("mat", "cam")]);
    assert.deepEqual(m.firstTo, { cam: "mat", mat: "cam" });
    assert.equal(m.pairs.reduce((s, p) => s + p.messages, 0), 3);
  });

  it("measures how many messages follow usual edges, per side", () => {
    const row = (bias: "on" | "off", events: TraceEvent[], extra: Partial<BiasRow> = {}): BiasRow => ({
      bias,
      rep: 1,
      runId: "x",
      status: "completed",
      messages: runMessages(events),
      ...extra,
    });
    const rows: BiasRow[] = [
      // on: Camila -> Tomas first (her #1), IT -> Tomas (his #1): 3 of 3 usual.
      row("on", [msg("cam", "tom"), msg("it", "tom"), msg("cam", "mat")], { reachedFinance: true }),
      // off: Camila -> IT first (not usual), then Tomas: 1 of 2 usual.
      row("off", [msg("cam", "it"), msg("cam", "tom")]),
      { bias: "off", rep: 2, runId: "y", status: "failed", error: "boom" },
    ];
    const [on, off] = summarizeBias(rows, habits);
    assert.equal(on.usualShare, 1);
    assert.equal(on.topContactFirst, 2);
    assert.equal(on.sendersWithHabits, 2);
    assert.equal(on.reachedFinance, 1);
    assert.equal(off.runs, 1);
    assert.equal(off.failed, 1);
    assert.equal(off.usualShare, 0.5);
    assert.equal(off.topContactFirst, 0);
    assert.equal(off.sendersWithHabits, 1, "only Camila sent anything");
    // on: cam->tom (13/21), it->tom (6/6), cam->mat (8/21): to #1 = 2 of 3.
    assert.equal(on.topShare, 0.667);
    assert.equal(on.habitWeight, Math.round(((13 / 21 + 1 + 8 / 21) / 3) * 1000) / 1000);
    // off: cam->it (never), cam->tom (13/21).
    assert.equal(off.topShare, 0.5);
    assert.equal(off.habitWeight, Math.round((13 / 21 / 2) * 1000) / 1000);
  });

  it("splits where the seed's first message went: #1 contact, finance, or someone else", () => {
    const done = (bias: "on" | "off", first: string): BiasRow => ({
      bias, rep: 1, runId: "x", status: "completed", messages: runMessages([msg("cam", first)]),
    });
    const [on, off] = summarizeBias(
      [done("on", "tom"), done("on", "tom"), done("off", "mat"), done("off", "it")],
      habits,
      { seedId: "cam", financeIds: ["mat"] },
    );
    assert.deepEqual(on.seedFirst, { runs: 2, toTop: 2, toFinance: 0, other: 0 });
    assert.deepEqual(off.seedFirst, { runs: 2, toTop: 0, toFinance: 1, other: 1 });
  });
});
