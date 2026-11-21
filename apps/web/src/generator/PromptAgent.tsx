import { useState } from "react";
import type { AgentProfile } from "@sandbox/shared";
import { splitAgentPrompt } from "@sandbox/shared";
import { saveProfile } from "../api";

export function PromptAgent({ hasDatabase }: { hasDatabase: boolean }) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [split, setSplit] = useState(true);
  const [saved, setSaved] = useState<number[]>([]);
  const sections = split ? splitAgentPrompt(prompt) : [{ name: "Agente por prompt", prompt }];
  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      for (const [index, section] of sections.entries()) {
      if (saved.includes(index)) continue;
      const profile: AgentProfile = {
        id: `prompt_${crypto.randomUUID()}`,
        name: sections.length > 1 ? section.name : name.trim() || section.name,
        title: "Agente de prompt directo",
        areaId: "cs",
        knobs: { seniority: "mid", motivation: "quality", proactivity: "medium" },
        systemContext: section.prompt,
        operatingStyle: [],
        goalTemplate: "",
        orgHints: { notes: "mesh:prompt-only" },
        refinedByModel: false,
        createdAt: new Date().toISOString(),
      };
      const { agent } = await saveProfile(profile);
      setSaved(previous => [...previous, index]);
      setMessage(`«${agent.name}» guardado.`);
      }
      setMessage(`${sections.length} agente(s) guardado(s). Selecciónalos en Evaluaciones o Simulaciones.`);
    } catch (failure) { setMessage(""); setError(`${failure instanceof Error ? failure.message : "No se pudo guardar el agente."} Puedes reintentar: los ya guardados en este formulario no se duplicarán.`); }
    finally { setBusy(false); }
  }
  return <section className="panel">
    <h2>Crear agente desde un prompt</h2>
    <p className="hint">El prompt se guarda literalmente, sin generar texto con IA ni añadir plantillas de área, personalidad, empresa o conversación previa. Los campos técnicos de catálogo no se añaden al prompt.</p>
    <div className="mesh-callout">Sin contexto añadido no significa sin sesgos: el modelo conserva los de su entrenamiento. Al ejecutarse, siguen vigentes las reglas del laboratorio, sus herramientas y el escenario elegido.</div>
    <div className="profile-editor"><label>Nombre (solo para un agente individual)<input maxLength={64} value={name} onChange={event => { setName(event.target.value); setMessage(""); setSaved([]); }} disabled={busy || sections.length > 1 || saved.length > 0} /></label><label>Prompt original<textarea className="tall" maxLength={12000} value={prompt} onChange={event => { setPrompt(event.target.value); setMessage(""); setSaved([]); }} disabled={busy || saved.length > 0} placeholder="Escribe un rol o varios con títulos como: #### 1. Agente de soporte" /></label></div>
    <label><input type="checkbox" checked={split} disabled={busy || saved.length > 0} onChange={event => { setSplit(event.target.checked); setMessage(""); }} /> Separar roles con títulos Markdown numerados</label>
    <div className="mesh-callout"><strong>Vista previa: {sections.length} agente(s)</strong><p>Cada agente recibe el texto anterior al primer rol como contexto compartido y únicamente su propio apartado. No se añaden instrucciones generadas.</p><ol>{sections.map((section, index) => <li key={index}>{sections.length === 1 ? name.trim() || section.name : section.name}{saved.includes(index) ? " · Guardado" : ""}</li>)}</ol></div>
    <p className="hint">{prompt.length}/12000 caracteres · Sin refinamiento · Sin consumo de IA al crear · Herramientas básicas de comunicación</p>
    <button className="btn" disabled={busy || !hasDatabase || !prompt.trim() || saved.length === sections.length} onClick={() => void save()}>{busy ? "Guardando…" : `Crear y guardar ${sections.length - saved.length} agente(s)`}</button>
    {saved.length > 0 && !busy && <button className="btn ghost" onClick={() => { setPrompt(""); setName(""); setSaved([]); setMessage(""); setError(""); }}>Nuevo prompt</button>}
    {!hasDatabase && <p className="error">La base de datos no está disponible.</p>}
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
  </section>;
}
