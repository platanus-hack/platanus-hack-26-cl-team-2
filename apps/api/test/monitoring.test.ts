import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeMonitoring, type MonitoringRun, type TraceEvent } from "@sandbox/shared";

function event(id: string, type: TraceEvent["type"], payload: Record<string, unknown> = {}): TraceEvent {
  return { id, type, payload, runId: "run", ts: "2026-11-21T10:00:00Z" };
}

function snapshot(events: TraceEvent[], judgment: MonitoringRun["judgment"] = null): MonitoringRun {
  return { run: { id: "run", status: "completed", agents: [], createdAt: "2026-11-21T10:00:00Z", finishedAt: "2026-11-21T10:01:00Z" }, events, judgment };
}

describe("Métricas de monitoreo", () => {
  it("distingue ausencia de datos de un promedio de cero", () => {
    const empty = summarizeMonitoring([]);
    assert.equal(empty.average, null);
    assert.equal(empty.riskyRate, null);
    assert.equal(empty.score, null);
    assert.equal(summarizeMonitoring([snapshot([])]).average, 0);
  });

  it("cuenta mensajes enviados y llamadas una vez, sin duplicar recepción ni sandbox", () => {
    const sent = event("message", "agent.message_sent");
    const metrics = summarizeMonitoring([snapshot([sent, sent, event("received", "agent.message_received"), event("tool", "agent.tool_call"), event("attempt", "sandbox.tool_attempt", { dangerous: true, blocked: true })])]);
    assert.equal(metrics.interactions, 2);
    assert.equal(metrics.messages, 1);
    assert.equal(metrics.tools, 1);
    assert.equal(metrics.risky, 1);
    assert.equal(metrics.blocked, 1);
    assert.equal(metrics.riskyRate, 100);
  });

  it("separa hallazgos de IA de intentos observados y promedia solo puntajes disponibles", () => {
    const judged = snapshot([], { score: 8, risks: [{ title: "Presión de autoridad", severity: "high" }] });
    const metrics = summarizeMonitoring([judged, snapshot([])]);
    assert.equal(metrics.risky, 0);
    assert.equal(metrics.findings, 1);
    assert.equal(metrics.riskyRuns, 1);
    assert.equal(metrics.riskyRate, 50);
    assert.equal(metrics.score, 8);
    assert.equal(metrics.judged, 1);
  });

  it("incluye ejecuciones activas en volumen y excluye sus duraciones incompletas", () => {
    const active = snapshot([event("message", "agent.message_sent")]);
    active.run.status = "running";
    delete active.run.finishedAt;
    const metrics = summarizeMonitoring([active, snapshot([])]);
    assert.equal(metrics.average, 0.5);
    assert.equal(metrics.duration, 60000);
  });

  it("un evento peligroso y bloqueado cuenta como un solo intento de riesgo", () => {
    const metrics = summarizeMonitoring([snapshot([event("one", "sandbox.tool_attempt", { dangerous: true, blocked: true }), event("two", "sandbox.tool_attempt", { dangerous: false, blocked: false })])]);
    assert.equal(metrics.risky, 1);
    assert.equal(metrics.blocked, 1);
  });
});
