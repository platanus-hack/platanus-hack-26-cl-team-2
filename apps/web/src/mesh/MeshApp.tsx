import { useEffect, useState } from "react";
import { Dashboard } from "./Dashboard";
import { RealWorkspace } from "./RealWorkspace";
import { AgentEvalsPage } from "./AgentEvalsPage";
import { fetchHealth } from "../api";
import { LabPage } from "../LabPage";
import { GeneratorPage } from "../generator/GeneratorPage";
import { EnterprisePage } from "../generator/EnterprisePage";
import { DemoModePage } from "./DemoModePage";

const navigation = [
  "Dashboard",
  "Organización",
  "Evaluaciones",
  "Simulaciones",
  "DEMO mode",
  "DEMO SIM",
  "Creador de agentes",
  "Creador de empresas",
];

export function MeshApp() {
  const [page, setPage] = useState("Dashboard");
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof fetchHealth>> | null>(null);
  const [evalsAgentId, setEvalsAgentId] = useState<string | null>(null);
  const [evalsReturnPage, setEvalsReturnPage] = useState("Organización");

  function openAgentEvals(agentId: string, returnPage = "Organización") {
    setEvalsAgentId(agentId);
    setEvalsReturnPage(returnPage);
    setPage("Evaluaciones");
  }

  function refresh() {
    setLoading(true);
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  const simulation = page === "Simulaciones";

  return (
    <div className="mesh-shell">
      <aside className="mesh-sidebar">
        <a className="mesh-logo" href="#">
          ◈ MESH<span>SEGURIDAD ORGANIZACIONAL</span>
        </a>
        <div className="mesh-workspace">
          P
          <span>
            Platanus Labs<small>Espacio de seguridad</small>
          </span>
        </div>
        <p className="mesh-label">ESPACIO DE TRABAJO</p>
        <nav aria-label="Main navigation">
          {navigation.map((item, index) => (
            <button
              key={item}
              className={page === item ? "active" : ""}
              onClick={() => setPage(item)}
            >
              <span>{["▥", "◇", "▤", "⌁", "◉", "◎", "⊕", "▦"][index]}</span>
              {item}
            </button>
          ))}
        </nav>
        <div className="mesh-sidebar-footer">
          <span className={`mesh-status ${health?.ok ? "online" : ""}`} />
          {health?.ok ? "Sistemas conectados" : "API no disponible"}
          <small>
            Encuentra las vulnerabilidades
            <br />
            entre los agentes.
          </small>
        </div>
      </aside>
      <main className="mesh-main">
        <header className="mesh-topbar">
          <span>
            Espacio de trabajo / <strong>{page}</strong>
          </span>
          <span className="mesh-pill">Versión hackathon</span>
        </header>
        <div className="mesh-content">
          <div className="mesh-heading">
            <div>
              <p className="mesh-label">INTELIGENCIA MESH</p>
              <h1>
                {page === "Organización"
                  ? "Tu organización, conectada."
                  : page === "Evaluaciones" && evalsAgentId
                    ? "Evals de vulnerabilidad"
                    : page === "DEMO mode"
                      ? "Empresa DEMO por prompt."
                      : page === "DEMO SIM"
                        ? "Simulación con tu DEMO."
                        : page}
              </h1>
              <p>
                {page === "DEMO mode"
                  ? "Una sola empresa activa: guardar sobrescribe. Al volver a la pestaña se restaura lo persistido."
                  : page === "DEMO SIM"
                    ? "Mapa ACL DEMO + pipeline Paso 1 (comunicación) y Paso 2 (ataque en cadena)."
                    : page === "Evaluaciones" && evalsAgentId
                      ? "Diseña ataques, corre iteraciones por atributo y observa la consola en vivo."
                      : simulation
                        ? "Explora cómo se propaga la confianza entre agentes."
                        : "Conoce a los agentes, personas y herramientas detrás de cada interacción."}
              </p>
            </div>
            <button className="btn ghost" onClick={refresh} disabled={loading}>
              {loading ? "Actualizando…" : "↻ Actualizar datos"}
            </button>
          </div>
          {page === "Dashboard" ? (
            <Dashboard onInspect={() => setPage("Organización")} />
          ) : page === "Organización" || simulation ? (
            <RealWorkspace
              simulation={simulation}
              hasApiKey={Boolean(health?.hasApiKey)}
              onOpenEvals={openAgentEvals}
            />
          ) : page === "Evaluaciones" ? (
            evalsAgentId ? (
              <AgentEvalsPage
                agentId={evalsAgentId}
                hasApiKey={Boolean(health?.hasApiKey)}
                onBack={() => {
                  setEvalsAgentId(null);
                  setPage(evalsReturnPage);
                }}
              />
            ) : (
              <>
                <div className="mesh-callout">
                  Laboratorio multi-agente · Para evals de vulnerabilidad por atributo, abre un
                  agente desde Organización o DEMO SIM → Ir a evals.
                </div>
                <LabPage hasApiKey={Boolean(health?.hasApiKey)} />
              </>
            )
          ) : page === "DEMO mode" ? (
            <DemoModePage
              hasDatabase={Boolean(health?.database?.ok)}
              onOpenOrg={() => {
                setPage("Organización");
                refresh();
              }}
              onOpenSim={() => setPage("DEMO SIM")}
            />
          ) : page === "DEMO SIM" ? (
            <RealWorkspace
              simulation
              scope="demo"
              hasApiKey={Boolean(health?.hasApiKey)}
              onOpenEvals={(agentId) => openAgentEvals(agentId, "DEMO SIM")}
            />
          ) : page === "Creador de agentes" ? (
            <GeneratorPage
              hasApiKey={Boolean(health?.hasApiKey)}
              hasDatabase={Boolean(health?.database?.ok)}
              onOpenEvals={openAgentEvals}
            />
          ) : (
            <EnterprisePage hasDatabase={Boolean(health?.database?.ok)} />
          )}
        </div>
      </main>
    </div>
  );
}
