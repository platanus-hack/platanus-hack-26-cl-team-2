import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import type { AgentSpec, TraceEvent } from "@sandbox/shared";
import { summarize } from "./Timeline";
import "./debugger.css";

/**
 * Step-by-step graph debugger for one run: agents (plus the incoming email and the
 * sandboxed tools) as nodes, and each trace event lit up on the edge it travels.
 */

type NodeKind = "external" | "agent" | "tool";
type GraphNode = { id: string; kind: NodeKind; name: string; sub: string; ini: string; x: number; y: number };
type Risk = "warn" | "crit" | null;
type Step = {
  event: TraceEvent;
  /** Directed edge the event travels on, if any. */
  edge: [string, string] | null;
  /** Nodes involved in this event (for highlighting / counting). */
  nodes: string[];
  label: string;
  title: string;
  risk: Risk;
};

const INTERNAL_TOOLS = new Set(["send_message", "read_inbox", "done"]);
const FINANCE_TOOLS = new Set(["issue_refund", "update_vendor_bank_account"]);
const DANGEROUS_TOOL = "update_vendor_bank_account";
const SOURCE = "__source";
const SANDBOX = "__sandbox";
const W = 940;
const H = 560;

const TYPE_COLOR: Record<string, string> = {
  "run.started": "#94a3b8",
  "run.completed": "#94a3b8",
  "run.failed": "#fb7185",
  "agent.turn.started": "#64748b",
  "agent.thought": "#7dd3fc",
  "agent.message_sent": "#2dd4bf",
  "agent.message_received": "#5eaaa0",
  "agent.tool_call": "#c4b5fd",
  "agent.tool_result": "#a78bfa",
  "sandbox.tool_attempt": "#fb7185",
  "agent.done": "#86efac",
  "agent.error": "#fb7185",
};
const KIND_COLOR: Record<NodeKind, string> = { external: "#fbbf24", agent: "#5eead4", tool: "#c4b5fd" };

const colorOf = (e: TraceEvent) => TYPE_COLOR[e.type] ?? "#94a3b8";
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const toolNodeId = (tool: string) => (FINANCE_TOOLS.has(tool) ? SANDBOX : `db:${tool}`);
const edgeKey = (a: string, b: string) => [a, b].sort().join("|");

type EmailMeta = { id?: string; from?: string | null; senderCheck?: { verdict?: string } | null } | null;

function emailOf(events: TraceEvent[]): EmailMeta {
  const start = events.find((e) => e.type === "run.started");
  return (start?.payload.email as EmailMeta) ?? null;
}

/** Turns trace events into debugger steps. Internal tool plumbing (send_message, read_inbox, done) is dropped: the message/done events already show it. */
export function buildSteps(events: TraceEvent[], agents: AgentSpec[]): Step[] {
  const name = (id?: string) => agents.find((a) => a.id === id)?.name ?? id ?? "Ejecución";
  const steps: Step[] = [];
  for (const event of events) {
    const p = event.payload;
    const tool = String(p.name ?? p.tool ?? "");
    if ((event.type === "agent.tool_call" || event.type === "agent.tool_result") && INTERNAL_TOOLS.has(tool)) continue;
    const who = name(event.agentId);
    let edge: [string, string] | null = null;
    let label = "";
    let title = "";
    let risk: Risk = null;
    switch (event.type) {
      case "run.started": {
        const seed = String(p.seedAgentId ?? agents[0]?.id ?? "");
        const email = p.email as EmailMeta;
        edge = seed ? [SOURCE, seed] : null;
        label = email ? "Correo" : "Escenario";
        title = `${email ? "Llega el correo" : "Empieza el escenario"} a ${name(seed)}`;
        const verdict = email?.senderCheck?.verdict;
        if (verdict && verdict !== "OK") risk = "warn";
        break;
      }
      case "agent.message_sent":
      case "agent.message_received": {
        const m = p.message as { fromAgentId?: string; toAgentId?: string } | undefined;
        if (m?.fromAgentId && m.toAgentId) edge = [m.fromAgentId, m.toAgentId];
        label = event.type === "agent.message_sent" ? "Mensaje" : "Recibe";
        title = event.type === "agent.message_sent"
          ? `${name(m?.fromAgentId)} → ${name(m?.toAgentId)}`
          : `${name(m?.toAgentId)} recibe el mensaje`;
        break;
      }
      case "agent.tool_call":
        edge = event.agentId ? [event.agentId, toolNodeId(tool)] : null;
        label = tool;
        title = `${who} llama a ${tool}`;
        if (tool === DANGEROUS_TOOL) risk = "crit";
        break;
      case "agent.tool_result":
        edge = event.agentId ? [toolNodeId(tool), event.agentId] : null;
        label = "Resultado";
        title = `${who} recibe el resultado de ${tool}`;
        break;
      case "sandbox.tool_attempt":
        edge = event.agentId ? [event.agentId, toolNodeId(tool)] : null;
        label = p.blocked ? "Bloqueado" : "Simulado";
        title = `${p.blocked ? "El sandbox bloquea" : "El sandbox simula"} ${tool}`;
        risk = p.dangerous ? "crit" : p.blocked ? "warn" : null;
        break;
      case "agent.thought":
        title = `${who} razona`;
        break;
      case "agent.turn.started":
        title = `${who} empieza el turno ${String(p.turn ?? "")}`.trim();
        break;
      case "agent.done":
        title = `${who} termina`;
        break;
      case "agent.error":
        title = `Error en ${who}`;
        risk = "warn";
        break;
      case "run.completed":
        title = "Fin de la ejecución";
        break;
      case "run.failed":
        title = "La ejecución falló";
        risk = "warn";
        break;
    }
    const nodes = edge ? [...edge] : event.agentId ? [event.agentId] : [];
    steps.push({ event, edge, nodes, label, title, risk });
  }
  return steps;
}

function layout(agents: AgentSpec[], steps: Step[], events: TraceEvent[]): GraphNode[] {
  const email = emailOf(events);
  const seed = String(events.find((e) => e.type === "run.started")?.payload.seedAgentId ?? agents[0]?.id ?? "");
  const ordered = [...agents].sort((a, b) => (a.id === seed ? -1 : b.id === seed ? 1 : 0));
  const nodes: GraphNode[] = [];
  const hasSource = steps.some((s) => s.nodes.includes(SOURCE));
  if (hasSource) {
    nodes.push({
      id: SOURCE, kind: "external", ini: "@",
      name: email ? "Correo entrante" : "Escenario",
      sub: email?.from ? email.from.replace(/^.*</, "").replace(/>.*$/, "") : email?.id ?? "inicio",
      x: 85, y: H / 2,
    });
  }
  const cx = 455, cy = H / 2 - 10;
  const n = ordered.length;
  const rx = n <= 2 ? 130 : 185, ry = n <= 2 ? 0 : 175;
  ordered.forEach((a, k) => {
    const ang = Math.PI + (2 * Math.PI * k) / Math.max(n, 1);
    nodes.push({
      id: a.id, kind: "agent", name: a.name, ini: initials(a.name),
      sub: `${/Title:\s*([^·\n]+)/.exec(a.role)?.[1]?.trim() ?? "Agente"}${a.financeTools ? " · +finanzas" : ""}`,
      x: n === 1 ? cx : cx + rx * Math.cos(ang), y: n === 1 ? cy : cy + ry * Math.sin(ang),
    });
  });
  const tools = [...new Set(steps.flatMap((s) => s.nodes).filter((id) => id === SANDBOX || id.startsWith("db:")))];
  tools.forEach((id, k) => {
    nodes.push({
      id, kind: "tool", ini: id === SANDBOX ? "$" : "DB",
      name: id === SANDBOX ? "Sandbox finanzas" : id.slice(3),
      sub: id === SANDBOX ? "herramientas de pago" : "mock DB",
      x: 850, y: tools.length === 1 ? H / 2 : 110 + (k * (H - 220)) / (tools.length - 1),
    });
  });
  return nodes;
}

function shorten(a: GraphNode, b: GraphNode, r1: number, r2: number) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return { x1: a.x + (dx / len) * r1, y1: a.y + (dy / len) * r1, x2: b.x - (dx / len) * r2, y2: b.y - (dy / len) * r2 };
}

function JsonView({ value }: { value: Record<string, unknown> }) {
  return <pre className="dbg-json">{JSON.stringify(value, null, 2)}</pre>;
}

type Props = { events: TraceEvent[]; agents: AgentSpec[]; running: boolean };

export function ConversationDebugger({ events, agents, running }: Props) {
  const steps = useMemo(() => buildSteps(events, agents), [events, agents]);
  const nodes = useMemo(() => layout(agents, steps, events), [agents, steps, events]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  /** null = follow the latest event (live). */
  const [pinned, setPinned] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const reduced = useRef(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const N = steps.length;
  const step = N === 0 ? -1 : Math.min(pinned ?? N - 1, N - 1);

  // Reset to live follow when a new run starts.
  const firstId = events[0]?.id;
  useEffect(() => { setPinned(null); setPlaying(false); }, [firstId]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setPinned((cur) => {
        const next = (cur ?? N - 1) + 1;
        if (next >= N - 1) setPlaying(false);
        return Math.min(next, N - 1);
      });
    }, 1100 / speed);
    return () => clearInterval(t);
  }, [playing, speed, N]);

  if (N === 0) {
    return <p className="empty">Inicia o carga una ejecución para recorrer la conversación paso a paso.</p>;
  }

  const go = (k: number) => { setPlaying(false); setPinned(Math.max(0, Math.min(N - 1, k))); };
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (step >= N - 1) setPinned(0); else setPinned(step);
    setPlaying(true);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).matches("input, select, textarea")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(step + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(step - 1); }
    else if (e.key === " " && !(e.target as HTMLElement).matches("button")) { e.preventDefault(); togglePlay(); }
  };

  const cur = steps[step]!;
  const past = steps.slice(0, step + 1);
  const curKey = cur.edge ? edgeKey(...cur.edge) : null;
  const visited = new Set(steps.slice(0, step).filter((s) => s.edge).map((s) => edgeKey(...s.edge!)));
  const allEdges = new Map<string, [string, string]>();
  for (const s of steps) if (s.edge && byId.has(s.edge[0]) && byId.has(s.edge[1])) allEdges.set(edgeKey(...s.edge), s.edge);
  const live = pinned === null;
  const c = colorOf(cur.event);
  const stats = {
    msgs: past.filter((s) => s.event.type === "agent.message_sent").length,
    tools: past.filter((s) => s.event.type === "agent.tool_call").length,
    bank: past.filter((s) => s.event.type === "sandbox.tool_attempt" && s.event.payload.dangerous).length,
    blocked: past.filter((s) => s.event.type === "sandbox.tool_attempt" && s.event.payload.blocked).length,
    risks: past.filter((s) => s.risk).length,
  };
  const blockedOn = new Set(past.filter((s) => s.event.type === "sandbox.tool_attempt" && s.event.payload.blocked).map((s) => s.edge?.[1]));
  const nextFor = (id: string) => {
    for (let k = step + 1; k < N; k++) if (steps[k]!.nodes.includes(id)) return k;
    for (let k = 0; k <= step; k++) if (steps[k]!.nodes.includes(id)) return k;
    return step;
  };

  let active: ReactElement | null = null;
  if (cur.edge) {
    const a = byId.get(cur.edge[0]), b = byId.get(cur.edge[1]);
    if (a && b) {
      const { x1, y1, x2, y2 } = shorten(a, b, 40, 46);
      const ang = Math.atan2(y2 - y1, x2 - x1), ah = 11;
      const head = `M${x2 + Math.cos(ang) * 4},${y2 + Math.sin(ang) * 4} L${x2 - Math.cos(ang - 0.45) * ah},${y2 - Math.sin(ang - 0.45) * ah} L${x2 - Math.cos(ang + 0.45) * ah},${y2 - Math.sin(ang + 0.45) * ah}Z`;
      const lbl = cut(cur.label, 26), lw = lbl.length * 6.6 + 20;
      const pathId = `dbg-active-${step}`;
      active = (
        <g>
          <path id={pathId} className="dbg-e-act" style={{ stroke: c }} d={`M${x1},${y1} L${x2},${y2}`} />
          <path style={{ fill: c }} d={head} />
          {!reduced.current && (
            <circle r={6} style={{ fill: c }}>
              <animateMotion dur="1.1s" repeatCount="indefinite"><mpath href={`#${pathId}`} /></animateMotion>
            </circle>
          )}
          <g transform={`translate(${(x1 + x2) / 2},${(y1 + y2) / 2 - 16})`}>
            <rect x={-lw / 2} y={-12} width={lw} height={22} rx={11} style={{ fill: "#0b111b", stroke: c }} />
            <text y={3} className="dbg-elabel" style={{ fill: c }}>{lbl}</text>
          </g>
        </g>
      );
    }
  }

  return (
    <div className="dbg" tabIndex={-1} onKeyDown={onKey}>
      <div className="dbg-transport">
        <div className="dbg-ctrls">
          <button type="button" onClick={() => go(0)} disabled={step === 0} aria-label="Primer paso" title="Primer paso">⏮</button>
          <button type="button" onClick={() => go(step - 1)} disabled={step === 0} aria-label="Paso anterior" title="Paso anterior (←)">◀</button>
          <button type="button" className="play" onClick={togglePlay} aria-label={playing ? "Pausar" : "Reproducir"}>{playing ? "❚❚ Pausar" : "▶ Reproducir"}</button>
          <button type="button" onClick={() => go(step + 1)} disabled={step === N - 1} aria-label="Paso siguiente" title="Paso siguiente (→)">▶|</button>
          <button type="button" onClick={() => go(N - 1)} disabled={step === N - 1} aria-label="Último paso" title="Último paso">⏭</button>
        </div>
        <div className="dbg-status" aria-live="polite">
          <b>Paso {step + 1} de {N}</b> · <code>{cur.event.type}</code> · {new Date(cur.event.ts).toLocaleTimeString()}
          {running && (live
            ? <span className="dbg-live">● En vivo</span>
            : <button type="button" className="dbg-follow" onClick={() => { setPlaying(false); setPinned(null); }}>Seguir en vivo</button>)}
        </div>
        <label className="dbg-speed">Velocidad
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
          </select>
        </label>
        <div className="dbg-scrub" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}>
          {steps.map((s, k) => (
            <button type="button" key={s.event.id} className={`dbg-tick ${k === step ? "cur" : k < step ? "past" : ""}`}
              style={{ color: colorOf(s.event) }} onClick={() => go(k)} title={`${k + 1}. ${s.title}`} aria-label={`Paso ${k + 1}: ${s.title}`}>
              {s.risk && <span className={`r ${s.risk}`} />}
              <b style={{ background: colorOf(s.event) }} />
            </button>
          ))}
        </div>
        <div className="dbg-kbd"><kbd>←</kbd> <kbd>→</kbd> avanzar o retroceder · <kbd>espacio</kbd> reproducir o pausar · clic en un nodo salta a su siguiente evento</div>
      </div>

      <div className="dbg-body">
        <div className="dbg-graph">
          <div className="dbg-canvas">
            <div className="dbg-now">
              <span className="dbg-type"><i style={{ background: c }} />{cur.event.type}</span>
              <strong>{cur.title}</strong>
              <span className="dbg-muted">{cut(summarize(cur.event), 160)}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafo de la conversación con el evento actual resaltado">
              {[...allEdges].map(([k, [a, b]]) => {
                const { x1, y1, x2, y2 } = shorten(byId.get(a)!, byId.get(b)!, 40, 40);
                return <line key={k} className={`dbg-e ${k === curKey ? "act" : visited.has(k) ? "vis" : "fut"}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
              })}
              {active}
              {nodes.map((n) => {
                const col = KIND_COLOR[n.kind];
                const count = past.filter((s) => s.nodes.includes(n.id)).length;
                const st = cur.nodes.includes(n.id) ? "on" : count ? "seen" : "idle";
                const crit = past.some((s) => s.risk === "crit" && s.nodes.includes(n.id));
                const warn = !crit && past.some((s) => s.risk && s.nodes.includes(n.id));
                return (
                  <g key={n.id} className={`dbg-n ${st}`} transform={`translate(${n.x},${n.y})`} role="button" tabIndex={0}
                    aria-label={`${n.name}: ir a su siguiente evento`} onClick={() => go(nextFor(n.id))}
                    onKeyDown={(e) => { if (e.key === "Enter") go(nextFor(n.id)); }}>
                    <circle r={44} className="halo" style={{ stroke: col }} />
                    <circle r={31} className="disc" style={{ stroke: col }} />
                    <text className="ini" y={5} style={{ fill: col }}>{n.ini}</text>
                    <text className="nm" y={58}>{cut(n.name, 20)}</text>
                    <text className="sb" y={74}>{cut(n.sub, 26)}</text>
                    {count > 0 && <g transform="translate(25,-25)"><circle r={11} className="badge" /><text y={4} className="bt">{count}</text></g>}
                    {(crit || warn) && <g transform="translate(-26,-24)"><circle r={8} style={{ fill: crit ? "#fb7185" : "#fbbf24" }} /><text y={4} className="risk">!</text></g>}
                    {n.kind === "tool" && blockedOn.has(n.id) && <g className="blocktag" transform="translate(0,94)"><rect x={-48} y={-11} width={96} height={21} rx={4} /><text y={4}>BLOQUEADO</text></g>}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="dbg-legend">
            <span><i style={{ background: "#2dd4bf" }} />Mensaje</span>
            <span><i style={{ background: "#c4b5fd" }} />Herramienta</span>
            <span><i style={{ background: "#fb7185" }} />Sandbox</span>
            <span><i style={{ background: "#3d5570" }} />Ya recorrido</span>
            <span><i className="dashed" />Aún no ocurre</span>
          </div>
        </div>

        <aside className="dbg-inspector">
          <div className="dbg-insp-h"><h3>Inspector</h3><small>Paso {step + 1} de {N}</small></div>
          <div className="dbg-insp-b">
            <span className="dbg-type"><i style={{ background: c }} />{cur.event.type}</span>
            <div><strong className="dbg-title">{cur.title}</strong></div>
            <p className="dbg-quote" style={{ borderLeftColor: c }}>{summarize(cur.event)}</p>
            {cur.risk && (
              <div className={`dbg-flag ${cur.risk}`}>
                <strong>{cur.risk === "crit" ? "Riesgo crítico" : "Señal de riesgo"}</strong>
                {cur.risk === "crit" ? "Intento de cambiar datos bancarios de un proveedor." : "Revisa este paso: hubo un bloqueo, un error o un remitente sospechoso."}
              </div>
            )}
            <h4>Payload</h4>
            <JsonView value={cur.event.payload} />
            <h4>Acumulado hasta aquí</h4>
            <dl className="dbg-stats">
              <dt>Mensajes entre agentes</dt><dd>{stats.msgs}</dd>
              <dt>Llamadas a herramientas</dt><dd>{stats.tools}</dd>
              <dt>Intentos bloqueados</dt><dd className={stats.blocked ? "bad" : ""}>{stats.blocked}</dd>
              <dt>Intentos de cambio bancario</dt><dd className={stats.bank ? "bad" : ""}>{stats.bank}</dd>
              <dt>Señales de riesgo</dt><dd className={stats.risks ? "bad" : ""}>{stats.risks}</dd>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
