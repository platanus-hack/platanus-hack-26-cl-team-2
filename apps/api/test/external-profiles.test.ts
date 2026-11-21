import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXTERNAL_PERSONAS, composeExternalProfile, profileToSystemPrompt } from "@sandbox/shared";

describe("Perfiles de actores externos", () => {
  for (const persona of Object.keys(EXTERNAL_PERSONAS) as Array<keyof typeof EXTERNAL_PERSONAS>) {
    it(`genera el perfil ${persona} con identidad externa y contexto ejecutable`, () => {
      const profile = composeExternalProfile({ persona, knobs: { seniority: "mid", motivation: "quality", proactivity: "high" }, companyName: "Empresa de prueba" });
      assert.equal(profile.areaId, "cs");
      assert.match(profile.title, /^Actor externo/);
      assert.match(profile.systemContext, /no trabajas en esa empresa/);
      assert.match(profile.systemContext, /no uses credenciales reales/);
      assert.equal(profile.rawCompose?.goalTemplate, profile.goalTemplate);
      assert.ok(profileToSystemPrompt(profile).includes(EXTERNAL_PERSONAS[persona].behavior));
    });
  }

  it("permite personalizar el nombre y objetivo sin cambiar el catálogo interno", () => {
    const profile = composeExternalProfile({ persona: "persistent", name: "Cliente de prueba", objective: "  Solicitar revisión humana  ", knobs: { seniority: "mid", motivation: "quality", proactivity: "low" } });
    assert.equal(profile.name, "Cliente de prueba");
    assert.equal(profile.goalTemplate, "Solicitar revisión humana");
    assert.match(profile.systemContext, /Iniciativa: low/);
    assert.equal(profile.refinedByModel, false);
  });
});
