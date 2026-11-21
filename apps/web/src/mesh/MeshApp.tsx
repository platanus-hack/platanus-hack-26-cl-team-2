import { useEffect, useRef, useState } from "react";
import { AgentEvalsPage } from "./AgentEvalsPage";
import { AttackWalkthrough } from "./AttackWalkthrough";
import { fetchHealth } from "../api";
import { LabPage } from "../LabPage";
import { BatchResultsPanel } from "../BatchResults";
import { BUSINESS_SCENARIOS } from "../businessScenarios";
import { GeneratorPage } from "../generator/GeneratorPage";
import { EnterprisePage } from "../generator/EnterprisePage";

const navigation = ["Evaluaciones", "Simulaciones", "Creador de agentes", "Creador de empresas"];
const navIcons = ["▤", "⌁", "⊕", "▦"];
const subtitles: Record<string, string> = {
  "Evaluaciones": "Lanza agentes reales contra correos de prueba y revisa qué hicieron, paso a paso.",
  "Simulaciones": "Un ejemplo paso a paso de cómo un correo falso pasa de agente en agente hasta el sistema de pagos.",
  "Creador de agentes": "Crea un agente y guárdalo para usarlo en las evaluaciones.",
  "Creador de empresas": "Genera una empresa ficticia con agentes en cada área, sin usar IA.",
};

export function MeshApp() {
  const [page, setPage] = useState("Evaluaciones");
  const [health, setHealth] = useState<Awaited<ReturnType<typeof fetchHealth>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [evalsAgentId, setEvalsAgentId] = useState<string | null>(null);
  function openAgentEvals(agentId: string) {
    setEvalsAgentId(agentId);
    setPage("Evaluaciones");
  }
  function refresh() {
    setLoading(true);
    fetchHealth().then(setHealth).catch(() => setHealth(null)).finally(() => setLoading(false));
  }
  useEffect(() => { refresh(); }, []);
  // The lab mounts on first visit and then stays mounted, hidden with CSS: switching sidebar
  // sections must not lose a run's trace or the "Antes y después" table.
  // While an agent's vulnerability evals are open, Evaluaciones shows that page and the lab is hidden.
  const evalActive = page === "Evaluaciones" && !evalsAgentId;
  const seen = useRef({ evaluation: false });
  if (evalActive) seen.current.evaluation = true;
  return <div className="mesh-shell">
    <aside className="mesh-sidebar"><a className="mesh-logo" href="#">◈ MESH<span>SEGURIDAD ORGANIZACIONAL</span></a><div className="mesh-workspace">P<span>Platanus Labs<small>Espacio de seguridad</small></span></div><p className="mesh-label">ESPACIO DE TRABAJO</p><nav aria-label="Navegación principal">{navigation.map((item, index) => <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}><span>{navIcons[index]}</span>{item}</button>)}</nav><div className="mesh-sidebar-footer"><span className={`mesh-status ${health?.ok ? (health.hasApiKey ? "online" : "warning") : ""}`} />{health?.ok ? "Sistemas conectados" : "API no disponible"}{health?.ok && !health.hasApiKey && <span className="mesh-status-warning" role="status"> · sin API key (no se pueden lanzar agentes)</span>}<small>Encuentra las vulnerabilidades<br />entre los agentes.</small></div></aside>
    <main className="mesh-main"><header className="mesh-topbar"><span>Espacio de trabajo / <strong>{page}</strong></span><span className="mesh-pill">Versión hackathon</span></header><div className="mesh-content"><div className="mesh-heading"><div><p className="mesh-label">INTELIGENCIA MESH</p><h1>{page === "Evaluaciones" && evalsAgentId ? "Evals de vulnerabilidad" : page}</h1><p>{page === "Evaluaciones" && evalsAgentId ? "Diseña ataques, corre iteraciones por atributo y observa la consola en vivo." : subtitles[page]}</p></div><button className="btn ghost" onClick={refresh} disabled={loading}>{loading ? "Actualizando…" : "↻ Actualizar datos"}</button></div>
      {page === "Simulaciones" ? <AttackWalkthrough /> : page === "Evaluaciones" ? (
        evalsAgentId ? (
          <AgentEvalsPage
            agentId={evalsAgentId}
            hasApiKey={Boolean(health?.hasApiKey)}
            onBack={() => setEvalsAgentId(null)}
          />
        ) : (
          <>
            <div className="mesh-callout">
              Laboratorio multi-agente · Para evals de vulnerabilidad por atributo, abre un agente
              desde Creador de agentes.
            </div>
            <BatchResultsPanel
              set="business"
              title="Fraude de negocio: reembolsos y reembolsos de gastos"
              scenarios={BUSINESS_SCENARIOS}
              intro={
                <p>
                  12 correos de fraude que explotan reglas de negocio (reembolsos, nómina, proveedores) y 3
                  legítimos de control, de <code>redteam_business.json</code>. El remitente parece normal en
                  todos: lo que se mide es si los agentes aplican las reglas, no si detectan un remitente
                  falso. Una ejecución por combinación: es una señal temprana, no una tasa.
                </p>
              }
            />
            <BatchResultsPanel />
          </>
        )
      ) : page === "Creador de agentes" ? <GeneratorPage hasDatabase={Boolean(health?.database?.ok)} onOpenEvals={openAgentEvals} /> : <EnterprisePage hasDatabase={Boolean(health?.database?.ok)} />}
      {seen.current.evaluation && <div style={{ display: evalActive ? "contents" : "none" }}><LabPage active={evalActive} hasApiKey={Boolean(health?.hasApiKey)} /></div>}
    </div></main>
  </div>;
}
