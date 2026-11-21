import { useEffect, useRef, useState } from "react";
import { Dashboard } from "./Dashboard";
import { RealWorkspace } from "./RealWorkspace";
import { AgentEvalsPage } from "./AgentEvalsPage";
import { VulnBatchPanel } from "./VulnBatchPanel";
import { EntityGlyph } from "./EntityGlyph";
import { fetchHealth, listAgents } from "../api";
import { LabPage } from "../LabPage";
import { ResultsPage } from "../ResultsPage";
import { BatchResultsPanel } from "../BatchResults";
import { GeneratorPage } from "../generator/GeneratorPage";
import { EnterprisePage } from "../generator/EnterprisePage";
import { areaLabel } from "../generator/labels";

type Entity = { id: string; name: string; kind: string; area: string; role: string; tools: string[]; x: number; y: number };
const demoNodes: Entity[] = [
  { id: "ticket", name: "Ticket externo", kind: "external", area: "Soporte", role: "Contenido no confiable de un cliente que ingresa a la organización.", tools: [], x: 110, y: 190 },
  { id: "support", name: "Agente de soporte", kind: "agent", area: "Soporte", role: "Clasifica solicitudes de clientes y delega tareas operativas.", tools: ["read_ticket", "delegate_task"], x: 310, y: 260 },
  { id: "ops", name: "Agente de operaciones", kind: "agent", area: "Operaciones", role: "Valida solicitudes y coordina cambios de proveedores.", tools: ["read_vendor", "send_message"], x: 520, y: 160 },
  { id: "finance", name: "Agente de finanzas", kind: "agent", area: "Finanzas", role: "Procesa pagos y cambios de cuentas. Acceso R/W a credit_cards.txt.", tools: ["issue_refund", "update_vendor_bank_account", "credit_cards_db"], x: 720, y: 280 },
  { id: "data", name: "Agente de datos", kind: "agent", area: "Data", role: "Analiza datos internos. Acceso R/W a users_health.txt y credit_cards.txt.", tools: ["users_health_db", "credit_cards_db"], x: 700, y: 120 },
  { id: "it_agent", name: "Agente de IT", kind: "agent", area: "IT", role: "Gestiona secretos y acceso. Acceso R/W a user_keys.txt.", tools: ["user_keys_db"], x: 880, y: 200 },
  { id: "eng", name: "Agente de engineering", kind: "agent", area: "Engineering", role: "Construye software. Acceso R/W a user_keys.txt.", tools: ["user_keys_db"], x: 880, y: 360 },
  { id: "erp", name: "ERP de pruebas", kind: "tool", area: "Finanzas", role: "Sistema financiero simulado. No se ejecutan pagos reales.", tools: [], x: 840, y: 440 },
  { id: "db_cards", name: "credit_cards.txt", kind: "database", area: "Finanzas/Data", role: "Mock DB de tarjetas. Finance y Data: credit_cards_db (read/write).", tools: ["credit_cards_db"], x: 920, y: 320 },
  { id: "db_health", name: "users_health.txt", kind: "database", area: "Data", role: "Mock DB de salud. Solo Data: users_health_db (read/write).", tools: ["users_health_db"], x: 900, y: 80 },
  { id: "db_keys", name: "user_keys.txt", kind: "database", area: "IT/Eng", role: "Mock DB de claves. IT y Engineering: user_keys_db (read/write).", tools: ["user_keys_db"], x: 1040, y: 200 },
  { id: "jorge", name: "Jorge", kind: "person", area: "IT", role: "Especialista de TI responsable del acceso y la seguridad de los agentes.", tools: ["manage_access"], x: 280, y: 450 },
  { id: "head", name: "Jefe de TI", kind: "person", area: "IT", role: "Revisa derivaciones y aprueba políticas de acceso.", tools: ["approve_access"], x: 520, y: 490 },
];
const demoEdges = [
  ["ticket", "support"],
  ["support", "ops"],
  ["ops", "finance"],
  ["finance", "erp"],
  ["finance", "db_cards"],
  ["data", "db_health"],
  ["data", "db_cards"],
  ["it_agent", "db_keys"],
  ["eng", "db_keys"],
  ["jorge", "support"],
  ["jorge", "head"],
  ["head", "ops"],
];
const navigation = ["Resultados", "Dashboard", "Organización", "Evaluaciones", "Simulaciones", "Creador de agentes", "Creador de empresas"];
const subtitles: Record<string, string> = {
  "Resultados": "Qué hicieron agentes Claude reales ante correos de fraude, con y sin defensa. Conteos medidos, no tasas.",
  "Dashboard": "Monitorea las interacciones entre agentes y sus señales de riesgo.",
  "Organización": "Conoce a los agentes, personas y herramientas detrás de cada interacción.",
  "Evaluaciones": "Lanza agentes reales contra correos de prueba y revisa qué hicieron, paso a paso.",
  "Simulaciones": "Explora cómo se propaga la confianza entre agentes.",
  "Creador de agentes": "Diseña un agente o un cliente simulado y guárdalo para usarlo en las evaluaciones.",
  "Creador de empresas": "Genera una empresa ficticia completa, con agentes en cada área, sin usar IA.",
};
const kindLabels: Record<string, string> = { agent: "Agente", person: "Persona", tool: "Herramienta", database: "Base de datos", external: "Entrada externa" };

export function MeshApp() {
  const [page, setPage] = useState("Resultados");
  const [source, setSource] = useState("saved");
  const [nodes, setNodes] = useState<Entity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>("finance");
  const [profileTab, setProfileTab] = useState("Resumen");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("Todas las áreas");
  const [kind, setKind] = useState("Todos los tipos");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof fetchHealth>> | null>(null);
  const [step, setStep] = useState(0);
  const [mitigated, setMitigated] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [evalsAgentId, setEvalsAgentId] = useState<string | null>(null);
  function openAgentEvals(agentId: string) {
    setEvalsAgentId(agentId);
    setPage("Evaluaciones");
  }
  function refresh() {
    setLoading(true);
    setError("");
    listAgents().then(agents => setNodes(agents.map((agent, index) => ({ id: agent.id, name: agent.name, kind: "agent", area: agent.areaId, role: agent.title, tools: agent.harnessTools, x: 120 + (index % 4) * 210, y: 150 + Math.floor(index / 4) * 150 })))).catch(() => setError("No se pudieron cargar los agentes. Revisa la API e inténtalo de nuevo.")).finally(() => setLoading(false));
    fetchHealth().then(setHealth).catch(() => setHealth(null));
  }
  useEffect(() => { refresh(); }, []);
  const entities = source === "demo" ? demoNodes : nodes;
  const visible = entities.filter(node => (area === "Todas las áreas" || node.area === area) && (kind === "Todos los tipos" || node.kind === kind) && `${node.name} ${node.role}`.toLowerCase().includes(query.toLowerCase()));
  const selected = entities.find(node => node.id === selectedId);
  const simulation = page === "Simulaciones";
  // The lab and the real workspace mount on first visit and then stay mounted, hidden with CSS:
  // switching sidebar sections must not lose a run's trace or the "Antes y después" table.
  const realActive = (page === "Organización" || simulation) && source === "saved";
  // While an agent's vulnerability evals are open, Evaluaciones shows that page and the lab is hidden.
  const evalActive = page === "Evaluaciones" && !evalsAgentId;
  const seen = useRef({ real: false, evaluation: false });
  if (realActive) seen.current.real = true;
  if (evalActive) seen.current.evaluation = true;
  const path = ["ticket", "support", "ops", "finance", "erp"];
  const steps = ["Selecciona Siguiente paso para explorar esta ruta de ataque ilustrativa.", "Un ticket externo contiene una instrucción para cambiar datos bancarios.", "Soporte reenvía la solicitud sin conservar su origen no confiable.", "Operaciones delega el cambio como una solicitud interna.", "Finanzas recibe la solicitud con aparente autoridad interna.", mitigated ? "La aprobación humana obligatoria bloquea el cambio de cuenta bancaria." : "En una empresa real sin controles, el ERP aceptaría el cambio de cuenta. En MESH el cambio siempre se bloquea y queda registrado."];
  const graphHeight = Math.max(620, 260 + Math.ceil(nodes.length / 4) * 150);
  return <div className="mesh-shell">
    <aside className="mesh-sidebar"><a className="mesh-logo" href="#">◈ MESH<span>SEGURIDAD ORGANIZACIONAL</span></a><div className="mesh-workspace">P<span>Platanus Labs<small>Espacio de seguridad</small></span></div><p className="mesh-label">ESPACIO DE TRABAJO</p><nav aria-label="Navegación principal">{navigation.map((item, index) => <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}><span>{["◆", "▥", "◇", "▤", "⌁", "⊕", "▦"][index]}</span>{item}</button>)}</nav><div className="mesh-sidebar-footer"><span className={`mesh-status ${health?.ok ? (health.hasApiKey ? "online" : "warning") : ""}`} />{health?.ok ? "Sistemas conectados" : "API no disponible"}{health?.ok && !health.hasApiKey && <span className="mesh-status-warning" role="status"> · sin API key (no se pueden lanzar agentes)</span>}<small>Encuentra las vulnerabilidades<br />entre los agentes.</small></div></aside>
    <main className="mesh-main"><header className="mesh-topbar"><span>Espacio de trabajo / <strong>{page}</strong></span><span className="mesh-pill">Versión hackathon</span></header><div className="mesh-content"><div className="mesh-heading"><div><p className="mesh-label">INTELIGENCIA MESH</p><h1>{page === "Organización" ? "Tu organización, conectada." : page === "Evaluaciones" && evalsAgentId ? "Evals de vulnerabilidad" : page}</h1><p>{page === "Evaluaciones" && evalsAgentId ? "Diseña ataques, corre iteraciones por atributo y observa la consola en vivo." : subtitles[page]}</p></div><button className="btn ghost" onClick={refresh} disabled={loading}>{loading ? "Actualizando…" : "↻ Actualizar datos"}</button></div>
      {page === "Resultados" ? <ResultsPage /> : page === "Dashboard" ? <Dashboard onInspect={() => setPage("Organización")} /> : (page === "Organización" || simulation) ? <><div className="mesh-source"><button className="btn ghost" onClick={() => setSource(source === "saved" ? "demo" : "saved")}>{source === "saved" ? "Ver demostración ficticia" : "Volver a datos reales"}</button></div>{source === "saved" ? null : <><div className="mesh-source"><label>Origen de datos <select value={source} onChange={event => { setSource(event.target.value); setSelectedId(null); setArea("Todas las áreas"); setKind("Todos los tipos"); setQuery(""); setStep(0); }}><option value="demo">Organización de demostración</option><option value="saved">Agentes guardados ({nodes.length})</option></select></label><span>{source === "demo" ? "DEMO · Entidades ficticias y relaciones configuradas" : "DATOS REALES · Perfiles guardados. Aún no hay relaciones observadas."}</span></div>{error && <p role="alert" className="error">{error}</p>}<div className="mesh-stats">{[["Entidades", entities.length], ["Agentes", entities.filter(node => node.kind === "agent").length], ["Relaciones", source === "demo" ? demoEdges.length : 0], ["Estado de seguridad", "Sin evaluar"]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong><small>{label === "Estado de seguridad" ? "Sin evaluaciones de atributos completadas" : source === "demo" ? "Datos de demostración" : "Desde perfiles guardados"}</small></div>)}</div>
      <div className="mesh-discovery"><div><span className="mesh-discovery-icon">⌁</span><div><span className="mesh-label">EXPLORA LAS CONEXIONES</span><h2>Pequeñas interacciones. Grandes consecuencias.</h2><p>Sigue las delegaciones. Descubre dónde se transfiere la confianza.</p></div></div><button className="btn" onClick={() => { setPage(simulation ? "Organización" : "Simulaciones"); setStep(0); }}>{simulation ? "Volver a la organización" : "Explorar el ataque ↗"}</button></div><div className="mesh-organization"><section className="mesh-graph-card"><div className="mesh-card-header"><div><h2>{simulation ? "Recorrido del ataque" : "Mapa de la organización"}</h2><span>{simulation ? "Recorrido ilustrativo · no es una evaluación real" : `${visible.length} entidades visibles · Selecciona un nodo`}</span></div><span className="mesh-pill">{source === "demo" ? "Configurado" : "Solo perfiles"}</span></div><div className="mesh-filters"><input aria-label="Buscar entidades" placeholder="Buscar personas, agentes, herramientas…" value={query} onChange={event => setQuery(event.target.value)} /><select aria-label="Filtrar por área" value={area} onChange={event => setArea(event.target.value)}><option>Todas las áreas</option>{Array.from(new Set(entities.map(node => node.area))).map(value => <option key={value} value={value}>{areaLabel(value)}</option>)}</select><select aria-label="Filtrar por tipo" value={kind} onChange={event => setKind(event.target.value)}><option>Todos los tipos</option>{["agent", "person", "tool", "database", "external"].map(value => <option key={value} value={value}>{kindLabels[value]}</option>)}</select></div><div className="mesh-graph-scroll">{visible.length ? <svg style={{ width: `${zoom * 100}%` }} className="mesh-graph" viewBox={`0 0 960 ${source === "demo" ? 620 : graphHeight}`} aria-label="Grafo de la organización"><defs><pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#243345" /></pattern><marker id="arrow" markerWidth="8" markerHeight="8" refX="26" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#50667e" /></marker></defs><rect width="960" height="100%" fill="url(#grid)" />{source === "demo" && demoEdges.map(([from, to], index) => { const start = visible.find(node => node.id === from); const end = visible.find(node => node.id === to); return start && end ? <line key={`${from}-${to}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} markerEnd="url(#arrow)" className={simulation && index < Math.min(step, 4) ? "attack-edge" : ""} /> : null; })}{visible.map(node => <g key={node.id} role="button" tabIndex={0} aria-label={`Explorar ${node.name}`} aria-pressed={selectedId === node.id} onClick={() => { setSelectedId(node.id); setProfileTab("Resumen"); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(node.id); } }} className={`mesh-node ${node.kind} ${selectedId === node.id ? "selected" : ""} ${simulation && step > path.indexOf(node.id) && path.includes(node.id) ? "on-path" : ""}`} transform={`translate(${node.x},${node.y})`}><circle className="node-halo" r="49" /><circle className="node-disc" r="38" /><EntityGlyph kind={node.kind} /><circle className="node-type-dot" cx="29" cy="-26" r="6" /><text textAnchor="middle" y="64">{node.name}</text><text textAnchor="middle" y="83" className="node-area">{node.area}</text></g>)}</svg> : <div className="mesh-empty">{loading ? "Cargando agentes…" : "No hay entidades que coincidan con estos filtros."}<button className="btn ghost" onClick={() => { setQuery(""); setArea("Todas las áreas"); setKind("Todos los tipos"); }}>Limpiar filtros</button></div>}</div><div className="mesh-map-controls"><span>Explora tu red</span><div><button aria-label="Alejar" disabled={zoom <= 1} onClick={() => setZoom(Math.max(1, zoom - 0.25))}>−</button><button onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button aria-label="Acercar" disabled={zoom >= 2} onClick={() => setZoom(Math.min(2, zoom + 0.25))}>+</button></div></div><footer className="mesh-legend"><span>● Agente</span><span>◉ Persona</span><span>▣ Mock DB / herramienta</span><span className="mesh-legend-acl">→ Permiso o relación</span></footer></section>
      <aside className="mesh-profile">{selected ? <><div className="mesh-card-header"><span>PERFIL DE ENTIDAD</span><button aria-label="Cerrar perfil" onClick={() => setSelectedId(null)}>×</button></div><div className="mesh-profile-body"><div className={`mesh-avatar ${selected.kind}`}><svg viewBox="-25 -25 50 50" aria-hidden="true"><EntityGlyph kind={selected.kind} /></svg></div><span className="mesh-label">{kindLabels[selected.kind] ?? selected.kind} / {areaLabel(selected.area)}</span><h2>{selected.name}</h2><span className="mesh-pill">Sin evaluar</span><div className="mesh-profile-tabs">{["Resumen", "Evidencia"].map(tab => <button key={tab} className={profileTab === tab ? "active" : ""} onClick={() => setProfileTab(tab)}>{tab}</button>)}</div>{profileTab === "Resumen" ? <><h3>Rol y responsabilidad</h3><p>{selected.role}</p><h3>Capacidades configuradas</h3><div className="mesh-tags">{selected.tools.length ? selected.tools.map(tool => <code key={tool}>{tool}</code>) : <p>Sin capacidades configuradas.</p>}</div><h3>Relaciones</h3>{source === "demo" ? demoEdges.filter(edge => edge.includes(selected.id)).map(edge => { const other = demoNodes.find(node => node.id === edge.find(id => id !== selected.id))!; return <button className="mesh-related" key={edge.join()} onClick={() => setSelectedId(other.id)}>{other.name}<span>Configurada →</span></button>; }) : <p>No hay relaciones observadas disponibles.</p>}</> : <><h3>Evidencia de seguridad</h3><p>Esta entidad aún no tiene evaluaciones de atributos completadas. Los puntajes se muestran después de una prueba medida.</p>{["Resistencia a inyección", "Límites de permisos", "Coherencia con el rol", "Manejo de contenido no confiable"].map(attribute => <div className="mesh-evidence" key={attribute}><span>{attribute}</span><small>Sin evaluar</small></div>)}</>}<button className="btn" onClick={() => setPage("Evaluaciones")}>Abrir laboratorio de evaluación →</button><small className="mesh-provenance">Origen: {source === "demo" ? "perfil ficticio de demostración" : "configuración guardada del agente"}. Las capacidades configuradas no equivalen a permisos efectivos verificados.</small></div></> : <div className="mesh-empty">Selecciona una entidad para explorar su perfil y evidencia.</div>}</aside></div>
      {simulation && <section className="mesh-replay"><div><span className="mesh-label">RECORRIDO DEMO · {step}/5</span><div className="mesh-story-steps" aria-label="Progreso del recorrido del ataque">{path.map((id, index) => <button key={id} className={index < step ? "complete" : ""} aria-label={`Explorar paso ${index + 1}`} onClick={() => { setStep(index + 1); setSelectedId(id); }}><span>{index + 1}</span>{demoNodes.find(node => node.id === id)?.name}</button>)}</div><h2 aria-live="polite">{steps[step]}</h2><p>Este recorrido no calcula tasas de éxito de ataques. Para medirlas, ejecuta pruebas repetidas y etiquetadas.</p></div><label><input type="checkbox" checked={mitigated} onChange={event => { setMitigated(event.target.checked); setStep(0); }} /> Exigir aprobación humana en el ERP</label><button className="btn ghost" onClick={() => setStep(0)}>Reiniciar</button><button className="btn" disabled={source !== "demo" || step === 5} onClick={() => { setStep(step + 1); setSelectedId(path[Math.min(step, 4)]); }}>Siguiente paso →</button></section>}</>}</> : page === "Evaluaciones" ? (
        evalsAgentId ? (
          <AgentEvalsPage
            agentId={evalsAgentId}
            hasApiKey={Boolean(health?.hasApiKey)}
            onBack={() => {
              setEvalsAgentId(null);
              setPage("Organización");
              setSource("saved");
            }}
          />
        ) : (
          <>
            <VulnBatchPanel hasApiKey={Boolean(health?.hasApiKey)} onOpenEvals={openAgentEvals} />
            <div className="mesh-callout">
              Laboratorio multi-agente · Para evals de vulnerabilidad de un solo agente, abre un agente
              desde Organización → Ir a evals, o haz clic en su nombre en la tabla de arriba.
            </div>
            <BatchResultsPanel />
          </>
        )
      ) : page === "Creador de agentes" ? <GeneratorPage hasApiKey={Boolean(health?.hasApiKey)} hasDatabase={Boolean(health?.database?.ok)} onOpenEvals={openAgentEvals} /> : <EnterprisePage hasDatabase={Boolean(health?.database?.ok)} />}
      {seen.current.real && <div style={{ display: realActive ? "contents" : "none" }}><RealWorkspace simulation={simulation} active={realActive} hasApiKey={Boolean(health?.hasApiKey)} onOpenEvals={openAgentEvals} /></div>}
      {seen.current.evaluation && <div style={{ display: evalActive ? "contents" : "none" }}><LabPage active={evalActive} hasApiKey={Boolean(health?.hasApiKey)} /></div>}
    </div></main>
  </div>;
}
