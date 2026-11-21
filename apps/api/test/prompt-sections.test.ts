import assert from "node:assert/strict";
import { it } from "node:test";
import { splitAgentPrompt } from "@sandbox/shared";

it("separa los siete roles y conserva el contexto sin mezclar sus tareas", () => {
  const context = "### Empresa: **NexusB1**\nConecta SAP B1.\n\n";
  const prompt = context + Array.from({ length: 7 }, (_, index) => `#### ${index + 1}. Agente ${index + 1}\nTarea exclusiva ${index + 1}.\n`).join("\n");
  const sections = splitAgentPrompt(prompt);
  assert.equal(sections.length, 7);
  sections.forEach((section, index) => {
    assert.equal(section.name, `Agente ${index + 1}`);
    assert.ok(section.prompt.startsWith(context));
    assert.ok(section.prompt.includes(`Tarea exclusiva ${index + 1}.`));
    assert.equal((section.prompt.match(/Tarea exclusiva/g) ?? []).length, 1);
  });
});

it("preserva literalmente un prompt sin múltiples roles numerados", () => {
  const prompt = "Atiende al cliente.\nNo agregues contexto.";
  assert.equal(splitAgentPrompt(prompt)[0].prompt, prompt);
  assert.equal(splitAgentPrompt(prompt).length, 1);
});
