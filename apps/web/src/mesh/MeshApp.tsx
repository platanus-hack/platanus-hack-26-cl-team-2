import { useEffect, useRef, useState } from "react";
import { Dashboard } from "./Dashboard";
import { RealWorkspace } from "./RealWorkspace";
import { AgentEvalsPage } from "./AgentEvalsPage";
import { fetchHealth } from "../api";
import { LabPage } from "../LabPage";
import { ResultsPage } from "../ResultsPage";
import { BatchResultsPanel } from "../BatchResults";
import { GeneratorPage } from "../generator/GeneratorPage";
import { EnterprisePage } from "../generator/EnterprisePage";
import { DemoModePage } from "./DemoModePage";

const navigation = [
  "Resultados",
  "Dashboard",
  "Organización",
  "Evaluaciones",
  "Simulaciones",
  "DEMO mode",
  "DEMO SIM",
  "Creador de agentes",
  "Creador de empresas",
];

const subtitles: Record<string, string> = {
  Resultados:
    "Qué hicieron agentes Claude reales ante correos de fraude, con y sin defensa. Conteos medidos, no tasas.",
  Dashboard: "Monitorea las interacciones entre agentes y sus señales de riesgo.",
  Organización: "Conoce a los agentes, personas y herramientas detrás de cada interacción.",
  Evaluaciones:
    "Lanza agentes reales contra correos de prueba y revisa qué hicieron, paso a paso.",
  Simulaciones: "Explora cómo se propaga la confianza entre agentes.",
  "DEMO mode":
    "Una sola empresa activa: guardar sobrescribe. Al volver a la pestaña se restaura lo persistido.",
  "DEMO SIM":
    "Mapa ACL DEMO + pipeline Paso 1 (comunicación) y Paso 2 (ataque en cadena).",
  "Creador de agentes":
    "Diseña un agente o un cliente simulado y guárdalo para usarlo en las evaluaciones.",
  "Creador de empresas":
    "Genera una empresa ficticia completa, con agentes en cada área, sin usar IA.",
};

const navIcons = ["◆", "▥", "◇", "▤", "⌁", "◉", "◎", "⊕", "▦"];

export function MeshApp() {
  const [page, setPage] = useState("Resultados");
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof fetchHealth>> | null>(
    null,
  );
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
  const demoSim = page === "DEMO SIM";
  const realActive = page === "Organización" || simulation;
  const demoSimActive = demoSim;
  const evalActive = page === "Evaluaciones" && !evalsAgentId;

  const seen = useRef({ real: false, evaluation: false, demoSim: false });
  if (realActive) seen.current.real = true;
  if (evalActive) seen.current.evaluation = true;
  if (demoSimActive) seen.current.demoSim = true;

  const heading =
    page === "Organización"
      ? "Tu organización, conectada."
      : page === "Evaluaciones" && evalsAgentId
        ? "Evals de vulnerabilidad"
        : page === "DEMO mode"
          ? "Empresa DEMO por prompt."
          : page === "DEMO SIM"
            ? "Simulación con tu DEMO."
            : page;

  const subtitle =
    page === "Evaluaciones" && evalsAgentId
      ? "Diseña ataques, corre iteraciones por atributo y observa la consola en vivo."
      : (subtitles[page] ?? "");

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
        <nav aria-label="Navegación principal">
          {navigation.map((item, index) => (
            <button
              key={item}
              className={page === item ? "active" : ""}
              onClick={() => setPage(item)}
            >
              <span>{navIcons[index]}</span>
              {item}
            </button>
          ))}
        </nav>
        <div className="mesh-sidebar-footer">
          <span
            className={`mesh-status ${health?.ok ? (health.hasApiKey ? "online" : "warning") : ""}`}
          />
          {health?.ok ? "Sistemas conectados" : "API no disponible"}
          {health?.ok && !health.hasApiKey && (
            <span className="mesh-status-warning" role="status">
              {" "}
              · sin API key (no se pueden lanzar agentes)
            </span>
          )}
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
              <h1>{heading}</h1>
              <p>{subtitle}</p>
            </div>
            <button className="btn ghost" onClick={refresh} disabled={loading}>
              {loading ? "Actualizando…" : "↻ Actualizar datos"}
            </button>
          </div>

          {page === "Resultados" ? <ResultsPage /> : null}
          {page === "Dashboard" ? (
            <Dashboard onInspect={() => setPage("Organización")} />
          ) : null}

          {page === "Evaluaciones" && evalsAgentId ? (
            <AgentEvalsPage
              agentId={evalsAgentId}
              hasApiKey={Boolean(health?.hasApiKey)}
              onBack={() => {
                setEvalsAgentId(null);
                setPage(evalsReturnPage);
              }}
            />
          ) : null}

          {page === "Evaluaciones" && !evalsAgentId ? (
            <div className="mesh-callout">
              Laboratorio multi-agente · Para evals de vulnerabilidad por atributo, abre un
              agente desde Organización o DEMO SIM → Ir a evals.
            </div>
          ) : null}
          {page === "Evaluaciones" && !evalsAgentId ? <BatchResultsPanel /> : null}

          {page === "DEMO mode" ? (
            <DemoModePage
              hasDatabase={Boolean(health?.database?.ok)}
              onOpenOrg={() => {
                setPage("Organización");
                refresh();
              }}
              onOpenSim={() => setPage("DEMO SIM")}
            />
          ) : null}

          {page === "Creador de agentes" ? (
            <GeneratorPage
              hasApiKey={Boolean(health?.hasApiKey)}
              hasDatabase={Boolean(health?.database?.ok)}
              onOpenEvals={openAgentEvals}
            />
          ) : null}
          {page === "Creador de empresas" ? (
            <EnterprisePage hasDatabase={Boolean(health?.database?.ok)} />
          ) : null}

          {seen.current.real && (
            <div style={{ display: realActive ? "contents" : "none" }}>
              <RealWorkspace
                simulation={simulation}
                active={realActive}
                hasApiKey={Boolean(health?.hasApiKey)}
                onOpenEvals={openAgentEvals}
              />
            </div>
          )}
          {seen.current.demoSim && (
            <div style={{ display: demoSimActive ? "contents" : "none" }}>
              <RealWorkspace
                simulation
                scope="demo"
                active={demoSimActive}
                hasApiKey={Boolean(health?.hasApiKey)}
                onOpenEvals={(agentId) => openAgentEvals(agentId, "DEMO SIM")}
              />
            </div>
          )}
          {seen.current.evaluation && (
            <div style={{ display: evalActive ? "contents" : "none" }}>
              <LabPage active={evalActive} hasApiKey={Boolean(health?.hasApiKey)} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
