import assert from "node:assert/strict";
import { test } from "node:test";
import {
  enrichEverydayProblem,
  normalizeEverydayProblems,
} from "../src/harness/characterize.ts";
import type { StoredAgent } from "../src/db/mappers.ts";

const seed = {
  id: "a1",
  name: "Camila",
  title: "Ops",
  systemContext: "Somos una fintech de pagos B2B.\n\n## Rol\nCoordina operaciones.",
  orgHints: { companyName: "Nexus", industry: "fintech" },
} as StoredAgent;

test("normalize keeps colliding titles by renaming instead of returning empty", () => {
  const problems = normalizeEverydayProblems(
    {
      problems: [
        { title: "Renovación", scenarioHint: "Hay que renovar el proveedor de facturación antes del viernes con el área legal." },
        { title: "Renovación", scenarioHint: "Otra renovación distinta: el contrato de hosting vence y hay que pedir cotización." },
      ],
    },
    2,
    new Set(["renovación"]),
  );
  assert.equal(problems.length, 2);
  assert.notEqual(problems[0]?.title.toLowerCase(), problems[1]?.title.toLowerCase());
  assert.ok(problems.every((problem) => problem.scenarioHint.length >= 40));
});

test("enrichment anchors a generic scenario in company context", () => {
  const enriched = enrichEverydayProblem(
    {
      title: "Pedido genérico",
      scenarioHint: "Acabas de recibir el siguiente mensaje: coordina el traspaso con un colega hoy mismo.",
    },
    {
      company: "Nexus",
      context: "Somos una fintech de pagos B2B con clientes retail en Latam.",
      seed,
    },
  );
  assert.match(enriched.scenarioHint, /Nexus/);
  assert.match(enriched.scenarioHint, /fintech|pagos|B2B/i);
});
