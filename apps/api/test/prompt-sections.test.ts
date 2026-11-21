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

it("detecta siete roles copiados sin símbolos Markdown y con saltos Windows", () => {
  const titles = ["Agente de Prospección y Calificación Técnica (SDR AI)", "Agente Arquitecto de Soluciones (Preventa Técnica)", "Agente de Onboarding e Implementación", "Agente de Soporte Técnico Nivel 1 y 2 (Especialista en Logs SAP)", "Agente de Customer Success y Retención (CSM AI)", "Agente de Documentación y Capacitación (Knowledge Base)", "Agente de QA y Monitoreo de Versiones SAP (DevOps / Producto)"];
  for (const bold of [false, true]) {
    const prompt = "Contexto NexusB1\r\nLos 7 Agentes de IA para tu Empresa\r\n" + titles.map((title, index) => `  ${bold ? "**" : ""}${index + 1}. ${title}${bold ? "**" : ""}\r\n- Rol: ${title}\r\n`).join("\r\n");
    const sections = splitAgentPrompt(prompt);
    assert.equal(sections.length, 7);
    assert.equal(sections[0].name, titles[0]);
    assert.ok(sections.every(section => section.prompt.startsWith("Contexto NexusB1")));
  }
});

it("no interpreta pasos de tareas como agentes adicionales", () => {
  assert.equal(splitAgentPrompt("1. Lee el ticket\n2. Responde al cliente").length, 1);
});

it("separa roles concatenados al copiar desde texto con formato", () => {
  const context = "NexusB1 conecta SAP. Los 7 Agentes de IA para tu Empresa.";
  const titles = ["Agente de Prospección", "Agente Arquitecto", "Agente de Onboarding", "Agente de Soporte", "Agente de Customer Success", "Agente de Documentación", "Agente de QA"];
  for (const separator of ["", "\n"]) {
    const prompt = context + titles.map((title, index) => `${index + 1}. ${title}Área: SoporteRol: Rol ${index + 1}.Tareas clave: Tarea ${index + 1}.`).join(separator);
    const sections = splitAgentPrompt(prompt);
    assert.equal(sections.length, 7);
    sections.forEach((section, index) => {
      assert.equal(section.name, titles[index]);
      assert.equal((section.prompt.match(/Tareas clave/g) ?? []).length, 1);
      assert.ok(section.prompt.startsWith(context));
    });
  }
});
