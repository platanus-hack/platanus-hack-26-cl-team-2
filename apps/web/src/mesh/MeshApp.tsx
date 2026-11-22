import { useEffect, useState } from "react";
import { AgentEvalsPage } from "./AgentEvalsPage";
import { fetchHealth } from "../api";
import { ScenarioPlotPanel } from "../BatchResults";
import { BUSINESS_SCENARIOS } from "../businessScenarios";
import { GeneratorPage } from "../generator/GeneratorPage";
import { DemoSetupPage } from "./DemoSetupPage";
import { DemoSimPage } from "./DemoSimPage";
import { DemoSimFindings } from "./DemoSimFindings";

const navigation = ["Evaluaciones", "Empresa y agentes", "DEMO SETUP", "DEMO SIM"];
const navIcons = ["▤", "⊕", "▣", "◎"];
const subtitles: Record<string, string> = {
  Evaluaciones: "Cumplimiento de objetivos de simulación, paso a paso.",
  "Empresa y agentes": "Define la empresa y crea agentes con su prompt, uno a uno o masivamente con JSON.",
  "DEMO SETUP": "Elige una empresa, marca agentes y genera sus problemas cotidianos.",
  "DEMO SIM": "Objetivo fijo. Una sola intervención (correo o envío forzado, no ambos) y evaluación.",
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

  return (
    <div className="mesh-shell">
      <aside className="mesh-sidebar">
        <a className="mesh-logo" href="#">◈ MESH<span>SEGURIDAD ORGANIZACIONAL</span></a>
        <div className="mesh-workspace">P<span>Platanus Labs<small>Espacio de seguridad</small></span></div>
        <p className="mesh-label">ESPACIO DE TRABAJO</p>
        <nav aria-label="Navegación principal">
          {navigation.map((item, index) => (
            <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}>
              <span>{navIcons[index]}</span>{item}
            </button>
          ))}
        </nav>
        <div className="mesh-sidebar-footer">
          <span className={`mesh-status ${health?.ok ? "online" : ""}`} />
          {health?.ok ? "Sistemas conectados" : "API no disponible"}
          <small>Encuentra las vulnerabilidades<br />entre los agentes.</small>
        </div>
      </aside>
      <main className="mesh-main">
        <header className="mesh-topbar">
          <span>Espacio de trabajo / <strong>{page}</strong></span>
          <span className="mesh-pill">Versión hackathon</span>
        </header>
        <div className={page === "DEMO SETUP" || page === "DEMO SIM" ? "mesh-content mesh-content-fill" : "mesh-content"}>
          <div className="mesh-heading">
            <div>
              <p className="mesh-label">INTELIGENCIA MESH</p>
              <h1>{page === "Evaluaciones" && evalsAgentId ? "Evals de vulnerabilidad" : page}</h1>
              <p>{page === "Evaluaciones" && evalsAgentId ? "Diseña ataques, corre iteraciones por atributo y observa la consola en vivo." : subtitles[page]}</p>
            </div>
            <button className="btn ghost" onClick={refresh} disabled={loading}>{loading ? "Actualizando…" : "↻ Actualizar datos"}</button>
          </div>
          {page === "Evaluaciones" ? (
            evalsAgentId ? (
              <AgentEvalsPage
                agentId={evalsAgentId}
                hasApiKey={Boolean(health?.hasApiKey)}
                onBack={() => setEvalsAgentId(null)}
              />
            ) : (
              <>
                <DemoSimFindings />
                <ScenarioPlotPanel set="business" title="Fraude de negocio" scenarios={BUSINESS_SCENARIOS} />
              </>
            )
          ) : page === "DEMO SETUP" ? (
            <DemoSetupPage hasDatabase={Boolean(health?.database?.ok)} hasApiKey={Boolean(health?.hasApiKey)} />
          ) : page === "DEMO SIM" ? (
            <DemoSimPage hasDatabase={Boolean(health?.database?.ok)} hasApiKey={Boolean(health?.hasApiKey)} />
          ) : (
            <GeneratorPage hasDatabase={Boolean(health?.database?.ok)} onOpenEvals={openAgentEvals} />
          )}
        </div>
      </main>
    </div>
  );
}
