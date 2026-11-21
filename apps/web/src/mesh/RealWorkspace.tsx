import { useEffect, useRef, useState } from "react";
import type { RunSummary, TraceEvent } from "@sandbox/shared";
import { fetchRun, listAgents, listRuns, subscribeRunEvents, type StoredAgent } from "../api";
import { LabPage } from "../LabPage";
import { Timeline } from "../Timeline";
import { RunOutcomePanel } from "../RunOutcome";
import { RunJudgmentPanel } from "../RunJudgment";
import { EntityGlyph } from "./EntityGlyph";
import { resolveObservedRun, selectObservedRun, useObservedRun } from "./runSelection";

type Snapshot = Awaited<ReturnType<typeof fetchRun>>;
type GraphNode = { id: string; name: string; kind: string; x: number; y: number };
type Connection = { from: string; to: string; label: string; count: number; event: TraceEvent };

const statusLabels: Record<string, string> = { running: "En curso", completed: "Completada", failed: "Fallida", pending: "Pendiente", created: "Creada" };

function observedConnections(events: TraceEvent[]): Connection[] {
  const connections = new Map<string, Connection>();
  for (const event of events) {
    let from: string | undefined;
    let to: string | undefined;
    let label = "Comunicación";
    if (event.type === "agent.message_sent") {
      const message = event.payload.message as { fromAgentId?: string; toAgentId?: string } | undefined;
      from = message?.fromAgentId;
      to = message?.toAgentId;
    } else if (event.type === "agent.tool_call" && event.agentId && typeof event.payload.name === "string") {
      from = event.agentId;
      to = `tool:${event.payload.name}`;
      label = "Llamada a herramienta";
    }
    if (!from || !to) continue;
    const key = JSON.stringify([from, to, label]);
    const existing = connections.get(key);
    connections.set(key, { from, to, label, count: (existing?.count ?? 0) + 1, event });
  }
  return [...connections.values()];
}

/**
 * `active` is false while the workspace is kept mounted but hidden (another section is open):
 * polling stops, and the lab below keeps its trace and "Antes y después".
 */
export function RealWorkspace({ simulation, hasApiKey, active = true }: { simulation: boolean; hasApiKey: boolean; active?: boolean }) {
  /** Run shown by the lab below: its result and trace are not repeated above it. */
  const [labRunId, setLabRunId] = useState("");
  /** The lab mounts on the first visit to Simulaciones and then stays mounted (hidden). */
  const labSeen = useRef(false);
  if (simulation) labSeen.current = true;
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const selectedRunId = useObservedRun();
  const runId = resolveObservedRun(selectedRunId, runs);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [error, setError] = useState("");
  const [runError, setRunError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let polling = false;
    async function refresh() {
      if (polling) return;
      polling = true;
      try {
        const [saved, history] = await Promise.all([listAgents(), listRuns()]);
        if (!cancelled) { setAgents(saved); setRuns(history); setError(""); }
      } catch (failure) {
        if (!cancelled) setError(failure instanceof Error ? failure.message : "No se pudieron actualizar los datos");
      } finally { polling = false; if (!cancelled) setLoading(false); }
    }
    if (!active) return;
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [refreshKey, active]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    setSnapshot(null);
    setEvents([]);
    setRunError("");
    if (!runId) return;
    async function load() {
      try {
        const data = await fetchRun(runId);
        if (cancelled) return;
        setSnapshot(data);
        setEvents(data.events);
        if (data.run.status === "running" || data.run.status === "pending") {
          unsubscribe = subscribeRunEvents(runId, event => {
            if (cancelled) return;
            setEvents(previous => previous.some(item => item.id === event.id) ? previous : [...previous, event]);
            if (event.type === "run.completed" || event.type === "run.failed") {
              unsubscribe?.();
              void fetchRun(runId).then(result => { if (!cancelled) setSnapshot(result); }).catch(() => { if (!cancelled) setRunError("No se pudo cargar el resultado final. Actualiza los datos."); });
            }
          });
        }
      } catch (failure) { if (!cancelled) setRunError(failure instanceof Error ? failure.message : "No se pudo cargar la ejecución"); }
    }
    void load();
    return () => { cancelled = true; unsubscribe?.(); };
  }, [runId, refreshKey]);

  const connections = observedConnections(events);
  const participants = snapshot ? snapshot.run.agents : agents;
  const graphNodes: GraphNode[] = participants.map((agent, index) => ({ id: agent.id, name: agent.name, kind: "agent", x: 130 + index % 4 * 220, y: 130 + Math.floor(index / 4) * 180 }));
  for (const connection of connections) {
    if (!graphNodes.some(node => node.id === connection.to) && connection.to.startsWith("tool:")) {
      const index = graphNodes.length;
      graphNodes.push({ id: connection.to, name: connection.to.slice(5), kind: "tool", x: 130 + index % 4 * 220, y: 130 + Math.floor(index / 4) * 180 });
    }
  }
  const visible = graphNodes.filter(node => node.name.toLowerCase().includes(query.toLowerCase()));
  const selected = graphNodes.find(node => node.id === selectedId);
  const saved = agents.find(agent => agent.id === selectedId);
  const participant = snapshot?.run.agents.find(agent => agent.id === selectedId);
  const agentIndex = new Map((snapshot?.run.agents ?? []).map((agent, index) => [agent.id, index]));
  return <>
    <div className="mesh-callout">DATOS REALES · Agentes desde la base de datos y conexiones observadas en trazas. Las ejecuciones se conservan en memoria y se pierden al reiniciar la API. Las herramientas financieras siguen siendo simuladas.</div>
    <div className="mesh-source"><label>Ejecución observada <select value={runId} onChange={event => { selectObservedRun(event.target.value); setSelectedId(""); }}><option value="">Solo configuración (sin conexiones)</option>{runs.map(run => <option key={run.id} value={run.id}>{new Date(run.createdAt).toLocaleString("es-CL")} · {statusLabels[run.status] ?? run.status} · {run.id}</option>)}</select></label><button className="btn ghost" onClick={() => setRefreshKey(value => value + 1)}>↻ Actualizar</button></div>
    {snapshot && connections.length === 0 && <p className="mesh-callout" role="status">Esta ejecución tiene {events.length} eventos, pero aún no registra mensajes enviados ni llamadas a herramientas. Los participantes por sí solos no generan conexiones.</p>}{!runId && runs.length > 0 && <p className="mesh-callout">Estás viendo solo la configuración. Selecciona una ejecución para ver sus conexiones o <button className="btn ghost" onClick={() => selectObservedRun(null)}>Ver la más reciente</button></p>}{(error || runError) && <p className="error" role="alert">{error || runError}</p>}
    <div className="mesh-stats">{[["Agentes guardados", agents.length], ["Ejecuciones disponibles", runs.length], ["Relaciones observadas", connections.length], ["Eventos de la ejecución", events.length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong><small>Datos registrados por la aplicación</small></div>)}</div>
    {simulation && <div className="mesh-callout">Configura una ejecución real en el laboratorio de abajo. Luego selecciónala aquí para explorar las comunicaciones, llamadas a herramientas y resultados medidos. Ejecutar agentes consume créditos de la API.</div>}
    <div className="mesh-organization"><section className="mesh-graph-card"><div className="mesh-card-header"><div><h2>Mapa de interacciones reales</h2><span>{snapshot ? `${events.length} eventos · ${statusLabels[snapshot.run.status] ?? snapshot.run.status}` : "Selecciona una ejecución para ver sus conexiones"}</span></div><span className="mesh-pill">{snapshot ? "Observado" : "Configuración guardada"}</span></div><div className="mesh-filters"><input aria-label="Buscar agentes o herramientas" placeholder="Buscar agentes o herramientas…" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="mesh-graph-scroll">{visible.length ? <svg className="mesh-graph" viewBox={`0 0 960 ${Math.max(480, 120 + Math.ceil(graphNodes.length / 4) * 180)}`} aria-label="Grafo de interacciones observadas"><defs><marker id="real-arrow" markerWidth="8" markerHeight="8" refX="29" refY="4" orient="auto"><path d="M0 0 8 4 0 8" fill="#5eead4" /></marker></defs>{connections.map(connection => { const start = visible.find(node => node.id === connection.from); const end = visible.find(node => node.id === connection.to); return start && end ? <line key={`${connection.from}:${connection.to}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} markerEnd="url(#real-arrow)"><title>{connection.label}: {connection.count} eventos</title></line> : null; })}{visible.map(node => <g key={node.id} role="button" tabIndex={0} aria-label={`Explorar ${node.name}`} aria-pressed={node.id === selectedId} className={`mesh-node ${node.kind} ${node.id === selectedId ? "selected" : ""}`} transform={`translate(${node.x},${node.y})`} onClick={() => setSelectedId(node.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(node.id); } }}><circle className="node-halo" r="49" /><circle className="node-disc" r="38" /><EntityGlyph kind={node.kind} /><text textAnchor="middle" y="65">{node.name.length > 24 ? `${node.name.slice(0, 22)}…` : node.name}</text><title>{node.name}</title></g>)}</svg> : <div className="mesh-empty">{loading ? "Cargando agentes…" : query ? "Sin coincidencias." : "Aún no hay agentes. Crea y guarda perfiles en el creador de agentes o empresas."}</div>}</div><footer className="mesh-legend">Las aristas representan mensajes enviados o intentos de llamada a herramientas. No implican acceso efectivo ni éxito de un ataque.</footer></section>
    <aside className="mesh-profile"><div className="mesh-profile-body">{selected ? <><span className="mesh-label">{selected.kind === "agent" ? "Agente real" : "Herramienta observada"}</span><h2>{selected.name}</h2><h3>Rol</h3><p>{saved?.title ?? participant?.role ?? "Herramienta invocada en la ejecución seleccionada."}</p><h3>Capacidades configuradas</h3><div className="mesh-tags">{saved?.harnessTools.map(tool => <code key={tool}>{tool}</code>) ?? <p>Consulta los eventos de la ejecución.</p>}</div><h3>Conexiones con evidencia</h3>{connections.filter(connection => connection.from === selected.id || connection.to === selected.id).map(connection => <div className="mesh-evidence" key={`${connection.from}:${connection.to}`}><span>{graphNodes.find(node => node.id === connection.from)?.name} → {graphNodes.find(node => node.id === connection.to)?.name}</span><small>{connection.label} · {connection.count} eventos · {new Date(connection.event.ts).toLocaleTimeString("es-CL")}</small><code>{connection.event.id}</code></div>)}<h3>Seguridad por atributo</h3><p>Sin evaluar. Los resultados de una ejecución no se convierten en puntajes de resistencia.</p></> : <div className="mesh-empty">Selecciona un nodo para ver su configuración y las conexiones respaldadas por eventos.</div>}</div></aside></div>
    {snapshot && !(simulation && runId === labRunId) && <><RunOutcomePanel evaluation={snapshot.evaluation} /><RunJudgmentPanel judgment={snapshot.judgment} loading={false} error={null} /><section className="panel"><h2>Evidencia de la ejecución</h2><Timeline events={events} agentIndex={agentIndex} /></section></>}
    {labSeen.current && <div style={{ display: simulation ? "contents" : "none" }}><LabPage active={active && simulation} hasApiKey={hasApiKey} onRunCreated={created => { setLabRunId(created.id); setRuns(previous => [created, ...previous.filter(run => run.id !== created.id)]); selectObservedRun(created.id); setSelectedId(""); }} /></div>}
  </>;
}
