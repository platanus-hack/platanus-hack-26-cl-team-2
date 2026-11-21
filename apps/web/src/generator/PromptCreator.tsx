import { useState } from "react";
import { AREA_LIST, type AgentProfile, type AreaId } from "@sandbox/shared";
import { saveProfile } from "../api";
import { areaLabel } from "./labels";
import "./prompt-creator.css";
import { LoadingProgress } from "../LoadingProgress";

type Props = { hasDatabase: boolean; onSaved?: () => Promise<void> };
const example = JSON.stringify({
  companyName: "Nexo TI",
  context: "Empresa de servicios informáticos y soporte a clientes.",
  agents: [
    { name: "Ana · Soporte", areaId: "cs", prompt: "Recibe tickets, diagnostica problemas y deriva casos a la jefatura de soporte." },
    { name: "Pedro · Jefe de soporte", areaId: "it", prompt: "Coordina al equipo de soporte y valida las solicitudes de escalamiento." },
    { name: "Laura · Finanzas", areaId: "finance", prompt: "Gestiona solicitudes financieras y verifica sus autorizaciones." },
  ],
}, null, 2);

function textField(value: unknown, label: string, max: number, required = true): string {
  if (value == null && !required) return "";
  if (typeof value !== "string" || (required && !value.trim()) || value.length > max) {
    throw new Error(`${label}: escribe texto${required ? " no vacío" : ""} de hasta ${max} caracteres.`);
  }
  return value;
}

export function parsePromptImport(raw: string, requireCompany = false): AgentProfile[] {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new Error("JSON inválido. Revisa las comillas y las comas."); }
  if (!data || typeof data !== "object") throw new Error("Usa un objeto con agents o una lista de agentes.");
  const root = data as Record<string, unknown>;
  const companyName = textField(root.companyName, "Nombre de empresa", 120, requireCompany);
  const context = textField(root.context, "Contexto de empresa", 11000, false);
  const agents = Array.isArray(data) ? data : root.agents;
  if (!Array.isArray(agents) || agents.length < 1 || agents.length > 100) {
    throw new Error("agents debe ser una lista de entre 1 y 100 agentes.");
  }
  return agents.map((item: unknown, i: number) => {
    if (!item || typeof item !== "object") throw new Error(`Agente ${i + 1}: formato inválido.`);
    const row = item as Record<string, unknown>;
    const name = textField(row.name, `Agente ${i + 1}: nombre`, 64);
    const prompt = textField(row.prompt, `${name}: prompt`, 12000);
    const areaId = row.areaId ?? "cs";
    if (!AREA_LIST.some((area) => area.id === areaId)) {
      throw new Error(`${name}: areaId inválida. Usa ${AREA_LIST.map((a) => a.id).join(", ")}.`);
    }
    const systemContext = context ? `${context}\n\n${prompt}` : prompt;
    if (systemContext.length > 12000) throw new Error(`${name}: contexto y prompt superan 12000 caracteres.`);
    return {
      id: crypto.randomUUID(), name, title: name, areaId: areaId as AreaId,
      knobs: { seniority: "mid", motivation: "quality", proactivity: "medium" },
      systemContext, operatingStyle: [], goalTemplate: "", refinedByModel: false,
      orgHints: { ...(companyName ? { companyName } : {}), notes: "mesh:prompt-only" },
      createdAt: new Date().toISOString(),
    };
  });
}

export function PromptCreator({ hasDatabase, onSaved }: Props) {
  const [bulk, setBulk] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [context, setContext] = useState("");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [areaId, setAreaId] = useState<AreaId>("cs");
  const [json, setJson] = useState("");
  const [drafts, setDrafts] = useState<AgentProfile[] | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const locked = busy || saved.length > 0;
  function resetPreview() { setDrafts(null); setError(""); setNotice(""); }
  function preview() {
    try {
      setError(""); setNotice(""); setSaved([]);
      setDrafts(parsePromptImport(bulk ? json : JSON.stringify({ companyName, context, agents: [{ name, prompt, areaId }] })));
    } catch (err) { setDrafts(null); setError(err instanceof Error ? err.message : String(err)); }
  }
  async function save() {
    if (!drafts || busy) return;
    setBusy(true); setError(""); setNotice("");
    const done = new Set(saved);
    try {
      for (const profile of drafts) {
        if (done.has(profile.id)) continue;
        await saveProfile(profile);
        done.add(profile.id);
        setSaved([...done]);
      }
      setNotice(`${done.size} agente(s) guardado(s).`);
    } catch (err) {
      setError(`${done.size}/${drafts.length} guardados. ${err instanceof Error ? err.message : String(err)}. Puedes reintentar los pendientes.`);
    } finally {
      try { await onSaved?.(); } catch { setError((prev) => `${prev} No se pudo actualizar la lista; recarga la página.`); }
      setBusy(false);
    }
  }
  return <div className="prompt-creator">
    <h3>Crear empresa y agentes</h3>
    <p>Se guarda tu texto sin refinamiento con IA ni instrucciones de rol generadas. El contexto de empresa, si lo incluyes, se antepone al prompt de cada agente.</p>
    <label className="prompt-bulk-toggle">
      <input type="checkbox" checked={bulk} disabled={locked} onChange={(e) => { setBulk(e.target.checked); resetPreview(); }} />
      Agregar masivamente
    </label>
    {!bulk ? <>
      <label>Nombre de empresa (opcional)<input value={companyName} maxLength={120} disabled={locked} onChange={(e) => { setCompanyName(e.target.value); resetPreview(); }} /></label>
      <label>Contexto de empresa (opcional)<textarea rows={4} value={context} maxLength={11000} disabled={locked} onChange={(e) => { setContext(e.target.value); resetPreview(); }} /></label>
      <label>Nombre<input value={name} maxLength={64} disabled={locked} onChange={(e) => { setName(e.target.value); resetPreview(); }} /></label>
      <label>Área<select value={areaId} disabled={locked} onChange={(e) => { setAreaId(e.target.value as AreaId); resetPreview(); }}>
        {AREA_LIST.map((a) => <option key={a.id} value={a.id}>{areaLabel(a.id)}</option>)}
      </select></label>
      <label>Prompt del agente<textarea rows={8} value={prompt} maxLength={12000} disabled={locked} onChange={(e) => { setPrompt(e.target.value); resetPreview(); }} /></label>
    </> : <>
      <label>JSON de empresa y agentes<textarea rows={14} value={json} disabled={locked} placeholder={example} onChange={(e) => { setJson(e.target.value); resetPreview(); }} /></label>
      <button type="button" className="linkish" disabled={locked} onClick={() => { setJson(example); resetPreview(); }}>Cargar ejemplo de 3 agentes</button>
      <p>Formato: companyName, context y agents con name, prompt y areaId opcional. Máximo 100 agentes; 12000 caracteres de contexto y prompt por agente.</p>
    </>}
    <div className="controls">
      <button className="btn" type="button" disabled={locked} onClick={preview}>Validar y previsualizar</button>
      {drafts && <button className="btn" type="button" disabled={busy || !hasDatabase || saved.length === drafts.length} onClick={save}>
        {busy ? `Guardando ${saved.length}/${drafts.length}…` : `Guardar ${drafts.length - saved.length} agente(s)`}
      </button>}
      {saved.length > 0 && <button type="button" disabled={busy} onClick={() => { setSaved([]); resetPreview(); }}>Nueva carga</button>}
    </div>
    {drafts && <div className="notice"><strong>Vista previa: {drafts.length} agente(s)</strong><ul>
      {drafts.map((a) => <li key={a.id}><details><summary>{a.name} · {areaLabel(a.areaId)}{saved.includes(a.id) ? " · Guardado" : ""}</summary><pre style={{ whiteSpace: "pre-wrap" }}>{a.systemContext}</pre></details></li>)}
    </ul></div>}
    {busy && <LoadingProgress label="Guardando agentes…" value={saved.length} total={drafts?.length} />}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
  </div>;
}
