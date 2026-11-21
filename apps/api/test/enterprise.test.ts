import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AREA_IDS } from "@sandbox/shared";
import { enterpriseRoutes } from "../src/enterprise/routes.js";

/** persist: false keeps these tests off the database; generation is deterministic (no model). */
async function generate(counts: Record<string, number>) {
  const res = await enterpriseRoutes.request("/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ counts, persist: false }),
  });
  return {
    status: res.status,
    body: (await res.json()) as { total?: number; error?: string; summary?: { byArea: Record<string, number> } },
  };
}

describe("Creador de empresas: cantidades por área", () => {
  it("acepta las 8 áreas, incluida finanzas", async () => {
    assert.equal(AREA_IDS.length, 8);
    const { status, body } = await generate(Object.fromEntries(AREA_IDS.map((id) => [id, 1])));
    assert.equal(status, 200);
    assert.equal(body.total, 8);
    for (const id of AREA_IDS) assert.equal(body.summary?.byArea[id], 1, id);
  });

  it("genera un agente de finanzas cuando es la única área", async () => {
    const { status, body } = await generate({ finance: 1 });
    assert.equal(status, 200);
    assert.equal(body.total, 1);
    assert.equal(body.summary?.byArea.finance, 1);
  });

  it("rechaza un área desconocida en vez de ignorarla", async () => {
    const { status } = await generate({ finanzas: 1 });
    assert.equal(status, 400);
  });

  it("rechaza una empresa sin agentes", async () => {
    const { status } = await generate({});
    assert.equal(status, 400);
  });
});
