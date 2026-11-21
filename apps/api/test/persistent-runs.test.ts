import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TraceEvent } from "@sandbox/shared";
import type { InternalRun } from "../src/harness/orchestrator.js";
import type { RunJudgment } from "../src/harness/judge.js";

const directory = mkdtempSync(join(tmpdir(), "mesh-runs-"));
process.env.DATABASE_URL = `file:${join(directory, "test.sqlite")}`;
delete process.env.VERCEL;
const { saveRun, loadRun, loadRuns, saveJudgment } = await import("../src/db/runs-repo.js");
const { default: app } = await import("../src/app.js");
const { default: handler } = await import("../../../api/index.js");
after(() => rmSync(directory, { recursive: true, force: true }));

const run: InternalRun = { id: "persisted", status: "completed", createdAt: "2026-11-21T10:00:00Z", finishedAt: "2026-11-21T10:01:00Z", agents: [], scenarioHint: "Prueba persistida" };
const event: TraceEvent = { id: "final-event", runId: run.id, ts: run.finishedAt!, type: "run.completed", payload: { status: "completed" } };

describe("Ejecuciones persistidas y rutas serverless", () => {
  it("recupera la ejecución y sus trazas desde el repositorio", async () => {
    await saveRun(run, [event]);
    const stored = await loadRun(run.id);
    assert.equal(stored?.run.scenarioHint, "Prueba persistida");
    assert.deepEqual(stored?.events, [event]);
    assert.ok((await loadRuns()).some(item => item.id === run.id));
  });

  it("conserva el dictamen al actualizar el estado y los eventos", async () => {
    await saveRun({ ...run, id: "judged" }, []);
    const judgment: RunJudgment = { summary: "Resumen", decisions: [], risks: [], governanceNotes: "Notas", score: 8, scoreRationale: "Motivo", model: "test" };
    await saveJudgment("judged", judgment);
    await saveRun({ ...run, id: "judged" }, [event]);
    assert.deepEqual((await loadRun("judged"))?.run.judgment, judgment);
  });

  it("sirve listado, detalle y SSE sin depender del bus de eventos local", async () => {
    await saveRun(run, [event]);
    const listing = await app.request("/api/runs");
    assert.equal(listing.status, 200);
    assert.equal(listing.headers.get("cache-control"), "no-store");
    const detail = await app.request(`/api/runs/${run.id}`);
    const data = await detail.json();
    assert.deepEqual(data.events, [event]);
    assert.equal(data.run.scenarioHint, undefined);
    const stream = await app.request(`/api/runs/${run.id}/events`);
    assert.match(await stream.text(), /final-event/);
    assert.equal((await app.request("/api/runs/missing")).status, 404);
  });

  it("dirige health y rutas api desde la función de Vercel", async () => {
    const health = await handler.fetch(new Request("https://mesh.example/api?__mesh_path=health"));
    assert.equal(health.status, 200);
    const listing = await handler.fetch(new Request("https://mesh.example/api?__mesh_path=api/runs"));
    assert.equal(listing.status, 200);
    const invalid = await handler.fetch(new Request("https://mesh.example/api?__mesh_path=api/runs/from-stored", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
    assert.equal(invalid.status, 400);
  });

  it("identifica ejecuciones interrumpidas sin dejarlas en curso indefinidamente", async () => {
    await saveRun({ ...run, id: "expired", status: "running", finishedAt: undefined, expiresAt: "2020-01-01T00:00:00Z" }, []);
    const snapshot = await loadRun("expired");
    assert.equal(snapshot?.run.status, "failed");
    assert.equal(snapshot?.events[0].type, "run.failed");
    assert.equal((await loadRuns()).find(item => item.id === "expired")?.status, "failed");
  });
});
