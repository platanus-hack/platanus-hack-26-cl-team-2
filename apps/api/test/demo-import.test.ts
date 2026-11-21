import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_IMPORT_TEMPLATE, parseDemoImport } from "@sandbox/shared";

describe("Importación JSON de empresa DEMO", () => {
  it("importa contexto, agentes y permisos sin alterar el contenido", () => {
    assert.deepEqual(parseDemoImport(JSON.stringify(DEMO_IMPORT_TEMPLATE)), DEMO_IMPORT_TEMPLATE);
  });
  it("permite importar solo empresa y agentes, sin archivos", () => {
    const { files: _files, ...minimal } = DEMO_IMPORT_TEMPLATE;
    assert.deepEqual(parseDemoImport(JSON.stringify(minimal)).files, []);
  });
  it("rechaza JSON inválido y documentos sin contexto o agentes", () => {
    assert.throws(() => parseDemoImport("{"), /JSON válido/);
    assert.throws(() => parseDemoImport("{}"), /context/);
    assert.throws(() => parseDemoImport(JSON.stringify({ context: "Empresa", agents: [] })), /entre 1 y 24/);
  });
  it("rechaza nombres duplicados y permisos para agentes inexistentes", () => {
    assert.throws(() => parseDemoImport(JSON.stringify({ ...DEMO_IMPORT_TEMPLATE, agents: [{ name: "Soporte", prompt: "Uno" }, { name: "soporte", prompt: "Dos" }] })), /duplicado/);
    assert.throws(() => parseDemoImport(JSON.stringify({ ...DEMO_IMPORT_TEMPLATE, files: [{ ...DEMO_IMPORT_TEMPLATE.files[0], readAgentNames: ["Desconocido"] }] })), /no existe/);
  });
  it("normaliza referencias de permisos y rechaza rutas o archivos duplicados", () => {
    const file = DEMO_IMPORT_TEMPLATE.files[0];
    const normalized = parseDemoImport(JSON.stringify({ ...DEMO_IMPORT_TEMPLATE, files: [{ ...file, readAgentNames: ["soporte", "Soporte"] }] }));
    assert.deepEqual(normalized.files[0].readAgentNames, ["Soporte"]);
    assert.throws(() => parseDemoImport(JSON.stringify({ ...DEMO_IMPORT_TEMPLATE, files: [{ ...file, filename: "../test.txt" }] })), /sin carpetas/);
    assert.throws(() => parseDemoImport(JSON.stringify({ ...DEMO_IMPORT_TEMPLATE, files: [file, file] })), /duplicado/);
  });
  it("admite BOM y valida límites de participantes y textos", () => {
    assert.equal(parseDemoImport("\uFEFF" + JSON.stringify(DEMO_IMPORT_TEMPLATE)).agents.length, 2);
    assert.throws(() => parseDemoImport(JSON.stringify({ ...DEMO_IMPORT_TEMPLATE, agents: Array.from({ length: 25 }, (_, index) => ({ name: `Agente ${index}`, prompt: "Rol" })) })), /entre 1 y 24/);
    assert.throws(() => parseDemoImport(JSON.stringify({ ...DEMO_IMPORT_TEMPLATE, context: "x".repeat(20001) })), /20000/);
  });
});
