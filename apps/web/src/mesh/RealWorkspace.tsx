import { useEffect, useMemo, useState } from "react";
import type { RunSummary, TraceEvent } from "@sandbox/shared";
import {
  fetchRun,
  listAgents,
  listMockDatabases,
  listRuns,
  subscribeRunEvents,
  type StoredAgent,
} from "../api";
import { LabPage } from "../LabPage";
import { Timeline } from "../Timeline";
import { RunOutcomePanel } from "../RunOutcome";
import { RunJudgmentPanel } from "../RunJudgment";
import { EntityGlyph } from "./EntityGlyph";
import {
  FALLBACK_MOCK_DBS,
  aclEdgesFromAgents,
  layoutMockDbNodes,
  offsetEdgePoints,
  type MockDbInfo,
} from "./mockDbGraph";
import { resolveObservedRun, selectObservedRun, useObservedRun } from "./runSelection";

type Snapshot = Awaited<ReturnType<typeof fetchRun>>;
type GraphNode = {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  role?: string;
  tools?: string[];
  sensitivity?: string;
};
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

export function RealWorkspace({ simulation, hasApiKey }: { simulation: boolean; hasApiKey: boolean }) {
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [mockDbs, setMockDbs] = useState<MockDbInfo[]>(FALLBACK_MOCK_DBS);
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
        const [saved, history, dbs] = await Promise.all([
          listAgents(),
          listRuns(),
          listMockDatabases().catch(() => ({ databases: FALLBACK_MOCK_DBS })),
        ]);
        if (!cancelled) {
          setAgents(saved);
          setRuns(history);
          setMockDbs(
            dbs.databases.map((db) => ({
              tool: db.tool,
              file: db.file,
              label: db.label,
              sensitivity: db.sensitivity,
            })),
          );
          setError("");
        }
      } catch (failure) {
        if (!cancelled) setError(failure instanceof Error ? failure.message : "No se pudieron actualizar los datos");
      } finally { polling = false; if (!cancelled) setLoading(false); }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [refreshKey]);

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
  const aclSourceAgents = useMemo(() => {
    if (!snapshot) return agents;
    return agents.filter((agent) =>
      snapshot.run.agents.some((participant) => participant.id === agent.id),
    );
  }, [agents, snapshot]);

  const dbNodes = useMemo(
    () => layoutMockDbNodes(mockDbs, { originX: 860, originY: 140, gapY: 170 }),
    [mockDbs],
  );
  const aclEdges = useMemo(
    () => aclEdgesFromAgents(aclSourceAgents, mockDbs),
    [aclSourceAgents, mockDbs],
  );

  const participants = snapshot ? snapshot.run.agents : agents;
  const graphNodes: GraphNode[] = participants.map((agent, index) => {
    const savedAgent = agents.find((row) => row.id === agent.id);
    return {
      id: agent.id,
      name: agent.name,
      kind: "agent",
      role: savedAgent?.title ?? ("role" in agent ? String(agent.role) : undefined),
      tools: savedAgent?.harnessTools,
      x: 130 + (index % 3) * 200,
      y: 130 + Math.floor(index / 3) * 170,
    };
  });
  for (const db of dbNodes) {
    graphNodes.push({
      id: db.id,
      name: db.name,
      kind: "database",
      role: `${db.label} · sensibilidad ${db.sensitivity} · acceso R/W vía ${db.tool}`,
      tools: [db.tool],
      sensitivity: db.sensitivity,
      x: db.x,
      y: db.y,
    });
  }
  for (const connection of connections) {
    if (!graphNodes.some((node) => node.id === connection.to) && connection.to.startsWith("tool:")) {
      const index = graphNodes.length;
      graphNodes.push({
        id: connection.to,
        name: connection.to.slice(5),
        kind: "tool",
        x: 130 + (index % 3) * 200,
        y: 130 + Math.floor(index / 3) * 170,
      });
    }
  }

  const q = query.toLowerCase();
  const visible = graphNodes.filter(
    (node) =>
      node.name.toLowerCase().includes(q) ||
      (node.role ?? "").toLowerCase().includes(q) ||
      (node.tools ?? []).some((tool) => tool.toLowerCase().includes(q)),
  );
  const selected = graphNodes.find((node) => node.id === selectedId);
  const saved = agents.find((agent) => agent.id === selectedId);
  const participant = snapshot?.run.agents.find((agent) => agent.id === selectedId);
  const agentIndex = new Map((snapshot?.run.agents ?? []).map((agent, index) => [agent.id, index]));
  const selectedAcl = aclEdges.filter(
    (edge) => edge.from === selectedId || edge.to === selectedId,
  );
  const graphHeight = Math.max(
    520,
    160 + Math.ceil(Math.max(participants.length, 1) / 3) * 170,
    140 + mockDbs.length * 170,
  );

  return <>
    <div className="mesh-callout">DATOS REALES · Flecha DB→agente = READ; agente→DB = WRITE (ambas = R/W). Teal = traza observada. Las ejecuciones viven en memoria y se pierden al reiniciar la API.</div>
    <div className="mesh-source"><label>Ejecución observada <select value={runId} onChange={event => { selectObservedRun(event.target.value); setSelectedId(""); }}><option value="">Agentes + permisos mock-DB (sin traza)</option>{runs.map(run => <option key={run.id} value={run.id}>{new Date(run.createdAt).toLocaleString("es-CL")} · {statusLabels[run.status] ?? run.status} · {run.id}</option>)}</select></label><button className="btn ghost" onClick={() => setRefreshKey(value => value + 1)}>↻ Actualizar</button></div>
    {snapshot && connections.length === 0 && <p className="mesh-callout" role="status">Esta ejecución tiene {events.length} eventos, pero aún no registra mensajes enviados ni llamadas a herramientas. Los participantes por sí solos no generan conexiones.</p>}
    {!runId && runs.length > 0 && <p className="mesh-callout">Estás viendo solo la configuración (ACL mock-DB). Selecciona una ejecución para ver trazas o <button className="btn ghost" onClick={() => selectObservedRun(null)}>Ver la más reciente</button></p>}
    {(error || runError) && <p className="error" role="alert">{error || runError}</p>}
    <div className="mesh-stats">{[["Agentes", agents.length], ["Mock DBs", mockDbs.length], ["Permisos ACL", aclEdges.length], ["Relaciones observadas", connections.length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong><small>Mapa de organización</small></div>)}</div>
    {simulation && <div className="mesh-callout">Configura una ejecución real en el laboratorio de abajo. Luego selecciónala aquí para explorar las comunicaciones, llamadas a herramientas y resultados medidos. Ejecutar agentes consume créditos de la API.</div>}
    <div className="mesh-organization"><section className="mesh-graph-card"><div className="mesh-card-header"><div><h2>Mapa de organización y accesos</h2><span>{snapshot ? `${events.length} eventos · ${statusLabels[snapshot.run.status] ?? snapshot.run.status}` : `${aclEdges.length} flechas ACL · ${agents.length} agentes`}</span></div><span className="mesh-pill">{snapshot ? "Observado + ACL" : "ACL configurado"}</span></div><div className="mesh-filters"><input aria-label="Buscar agentes o bases de datos" placeholder="Buscar agentes, DBs o tools…" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="mesh-graph-scroll">{visible.length ? <svg className="mesh-graph" viewBox={`0 0 1040 ${graphHeight}`} aria-label="Grafo de organización, permisos y trazas"><defs><marker id="real-arrow" markerWidth="8" markerHeight="8" refX="29" refY="4" orient="auto"><path d="M0 0 8 4 0 8" fill="#5eead4" /></marker><marker id="acl-read-arrow" markerWidth="8" markerHeight="8" refX="29" refY="4" orient="auto"><path d="M0 0 8 4 0 8" fill="#38bdf8" /></marker><marker id="acl-write-arrow" markerWidth="8" markerHeight="8" refX="29" refY="4" orient="auto"><path d="M0 0 8 4 0 8" fill="#c084fc" /></marker></defs>{aclEdges.map(edge => { const start = visible.find(node => node.id === edge.from); const end = visible.find(node => node.id === edge.to); if (!start || !end) return null; const pts = offsetEdgePoints(start.x, start.y, end.x, end.y, edge.access); return <line key={`acl:${edge.access}:${edge.from}:${edge.to}`} className={`acl-edge acl-edge-${edge.access}`} x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2} markerEnd={`url(#acl-${edge.access}-arrow)`}><title>{edge.label}</title></line>; })}{connections.map(connection => { const start = visible.find(node => node.id === connection.from); const end = visible.find(node => node.id === connection.to); return start && end ? <line key={`${connection.from}:${connection.to}:${connection.label}`} className="trace-edge" x1={start.x} y1={start.y} x2={end.x} y2={end.y} markerEnd="url(#real-arrow)"><title>{connection.label}: {connection.count} eventos</title></line> : null; })}{visible.map(node => <g key={node.id} role="button" tabIndex={0} aria-label={`Explorar ${node.name}`} aria-pressed={node.id === selectedId} className={`mesh-node ${node.kind} ${node.id === selectedId ? "selected" : ""}`} transform={`translate(${node.x},${node.y})`} onClick={() => setSelectedId(node.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(node.id); } }}><circle className="node-halo" r="49" /><circle className="node-disc" r="38" /><EntityGlyph kind={node.kind} /><text textAnchor="middle" y="65">{node.name.length > 22 ? `${node.name.slice(0, 20)}…` : node.name}</text><title>{node.role ?? node.name}</title></g>)}</svg> : <div className="mesh-empty">{loading ? "Cargando agentes…" : query ? "Sin coincidencias." : "Aún no hay agentes. Crea y guarda perfiles en el creador de agentes o empresas."}</div>}</div><footer className="mesh-legend"><span>● Agente</span><span>▣ Mock DB</span><span className="mesh-legend-read">→ READ (DB→agente)</span><span className="mesh-legend-write">→ WRITE (agente→DB)</span><span className="mesh-legend-trace">→ Traza</span></footer></section>
    <aside className="mesh-profile"><div className="mesh-profile-body">{selected ? <><span className="mesh-label">{selected.kind === "agent" ? "Agente real" : selected.kind === "database" ? "Mock database" : "Herramienta observada"}</span><h2>{selected.name}</h2><h3>{selected.kind === "database" ? "Descripción" : "Rol"}</h3><p>{selected.role ?? saved?.title ?? participant?.role ?? "Nodo del grafo."}</p>{selected.kind === "database" ? <><h3>Tool de acceso</h3><div className="mesh-tags">{(selected.tools ?? []).map(tool => <code key={tool}>{tool}</code>)}</div><h3>Permisos por agente</h3>{selectedAcl.length ? (() => { const byAgent = new Map<string, Set<string>>(); for (const edge of selectedAcl) { const agentId = edge.access === "read" ? edge.to : edge.from; const set = byAgent.get(agentId) ?? new Set(); set.add(edge.access); byAgent.set(agentId, set); } return [...byAgent.entries()].map(([agentId, access]) => { const agent = graphNodes.find(node => node.id === agentId); const tag = access.has("read") && access.has("write") ? "R/W" : access.has("read") ? "READ" : "WRITE"; return <button className="mesh-related" key={agentId} type="button" onClick={() => setSelectedId(agentId)}>{agent?.name ?? agentId}<span>{tag}</span></button>; }); })() : <p>Ningún agente tiene esta tool en harnessTools.</p>}</> : <><h3>Capacidades configuradas</h3><div className="mesh-tags">{saved?.harnessTools?.length ? saved.harnessTools.map(tool => <code key={tool}>{tool}</code>) : <p>Sin tools en perfil.</p>}</div><h3>Permisos mock-DB</h3>{selectedAcl.length ? (() => { const byDb = new Map<string, Set<string>>(); for (const edge of selectedAcl) { const dbId = edge.access === "read" ? edge.from : edge.to; const set = byDb.get(dbId) ?? new Set(); set.add(edge.access); byDb.set(dbId, set); } return [...byDb.entries()].map(([dbId, access]) => { const db = graphNodes.find(node => node.id === dbId); const tag = access.has("read") && access.has("write") ? "R/W" : access.has("read") ? "READ" : "WRITE"; return <button className="mesh-related" key={dbId} type="button" onClick={() => setSelectedId(dbId)}>{db?.name ?? dbId}<span>{tag}</span></button>; }); })() : <p>Sin acceso a mock DBs.</p>}<h3>Conexiones con evidencia</h3>{connections.filter(connection => connection.from === selected.id || connection.to === selected.id).map(connection => <div className="mesh-evidence" key={`${connection.from}:${connection.to}`}><span>{graphNodes.find(node => node.id === connection.from)?.name} → {graphNodes.find(node => node.id === connection.to)?.name}</span><small>{connection.label} · {connection.count} eventos · {new Date(connection.event.ts).toLocaleTimeString("es-CL")}</small><code>{connection.event.id}</code></div>)}</>}<h3>Seguridad por atributo</h3><p>Sin evaluar. Los ACL del mapa son configuración; no equivalen a una prueba de resistencia.</p></> : <div className="mesh-empty">Selecciona un agente o una mock DB para ver permisos.</div>}</div></aside></div>
    {snapshot && <><RunOutcomePanel evaluation={snapshot.evaluation} /><RunJudgmentPanel judgment={snapshot.judgment} loading={false} error={null} /><section className="panel"><h2>Evidencia de la ejecución</h2><Timeline events={events} agentIndex={agentIndex} /></section></>}
    {simulation && <LabPage hasApiKey={hasApiKey} onRunCreated={created => { setRuns(previous => [created, ...previous.filter(run => run.id !== created.id)]); selectObservedRun(created.id); setSelectedId(""); }} />}
  </>;
}
