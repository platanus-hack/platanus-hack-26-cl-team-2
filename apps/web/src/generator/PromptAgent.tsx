import { useState } from "react";
import type { AgentProfile } from "@sandbox/shared";
import { saveProfile } from "../api";

export function PromptAgent({ hasDatabase }: { hasDatabase: boolean }) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const profile: AgentProfile = {
        id: `prompt_${crypto.randomUUID()}`,
        name: name.trim() || "Agente por prompt",
        title: "Agente de prompt directo",
        areaId: "cs",
        knobs: { seniority: "mid", motivation: "quality", proactivity: "medium" },
        systemContext: prompt,
        operatingStyle: [],
        goalTemplate: "",
        orgHints: { notes: "mesh:prompt-only" },
        refinedByModel: false,
        createdAt: new Date().toISOString(),
      };
      const { agent } = await saveProfile(profile);
      setMessage(`«${agent.name}» guardado. Selecciónalo en Evaluaciones o Simulaciones.`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo guardar el agente."); }
    finally { setBusy(false); }
  }
  return <section className="panel">
    <h2>Crear agente desde un prompt</h2>
    <p className="hint">El prompt se guarda literalmente, sin generar texto con IA ni añadir plantillas de área, personalidad, empresa o conversación previa. Los campos técnicos de catálogo no se añaden al prompt.</p>
    <div className="mesh-callout">Sin contexto añadido no significa sin sesgos: el modelo conserva los de su entrenamiento. Al ejecutarse, siguen vigentes las reglas del laboratorio, sus herramientas y el escenario elegido.</div>
    <div className="profile-editor"><label>Nombre (solo para identificarlo)<input maxLength={64} value={name} onChange={event => { setName(event.target.value); setMessage(""); }} disabled={busy} /></label><label>Prompt original<textarea className="tall" maxLength={12000} value={prompt} onChange={event => { setPrompt(event.target.value); setMessage(""); }} disabled={busy} placeholder="Escribe aquí únicamente las instrucciones que quieres darle al agente…" /></label></div>
    <p className="hint">{prompt.length}/12000 caracteres · Sin refinamiento · Sin consumo de IA al crear · Herramientas básicas de comunicación</p>
    <button className="btn" disabled={busy || !hasDatabase || !prompt.trim() || Boolean(message)} onClick={() => void save()}>{busy ? "Guardando…" : "Crear y guardar agente"}</button>
    {!hasDatabase && <p className="error">La base de datos no está disponible.</p>}
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
  </section>;
}
