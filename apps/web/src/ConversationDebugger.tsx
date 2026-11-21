import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import type { AgentSpec, TraceEvent } from "@sandbox/shared";
import { summarize } from "./Timeline";
import "./debugger.css";

/**
 * Step-by-step graph debugger for one run: agents (plus the incoming email and the
 * sandboxed tools) as nodes, and each trace event lit up on the edge it travels.
 *
 * By default ("Mensajes") it jumps only between sent messages. Everything else (the email,
 * thoughts, turns, tool calls, sandbox attempts, agents finishing) is debugging detail:
 * one click away under "Inspeccionar más", or stepped through one by one in "Depuración".
 */

type NodeKind = "external" | "agent" | "tool";
type GraphNode = { id: string; kind: NodeKind; name: string; sub: string; ini: string; x: number; y: number };
type Risk = "warn" | "crit" | null;
export type Step = {
  event: TraceEvent;
  /** Position in the full (unfiltered) step list. */
  order: number;
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
/** In "Mensajes" mode only sent messages are steps; everything else is debugging detail. */
const isMessage = (s: Step) => s.event.type === "agent.message_sent";
/** Events that count towards a node's badge (what a reviewer cares about). */
const BADGE_TYPES = new Set<TraceEvent["type"]>(["run.started", "agent.message_sent", "sandbox.tool_attempt"]);
const RISK_RANK = { crit: 2, warn: 1 } as const;
const worst = (risks: Risk[]): Risk =>
  risks.reduce<Risk>((a, r) => (r && (!a || RISK_RANK[r] > RISK_RANK[a]) ? r : a), null);
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
  "agent.woken": "#fde68a",
  "agent.error": "#fb7185",
};
const TYPE_NAME: Record<string, string> = {
  "run.started": "Inicio · correo",
  "run.completed": "Fin de la ejecución",
  "run.failed": "Ejecución fallida",
  "agent.done": "Termina",
  "agent.woken": "Se reactiva",
  "agent.error": "Error",
  "agent.turn.started": "Turno",
  "agent.thought": "Pensamiento",
  "agent.message_received": "Recepción",
  "agent.tool_call": "Llamada a herramienta",
  "agent.tool_result": "Resultado de herramienta",
  "sandbox.tool_attempt": "Intento en sandbox",
};
const KIND_COLOR: Record<NodeKind, string> = { external: "#fbbf24", agent: "#5eead4", tool: "#c4b5fd" };

const colorOf = (e: TraceEvent) => TYPE_COLOR[e.type] ?? "#94a3b8";
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const toolNodeId = (tool: string) => (FINANCE_TOOLS.has(tool) ? SANDBOX : `db:${tool}`);
const edgeKey = (a: string, b: string) => [a, b].sort().join("|");
const json = (v: unknown) => JSON.stringify(v, null, 2);

type EmailMeta = {
  id?: string; kind?: string; technique?: string; from?: string | null; subject?: string | null;
  senderCheck?: { verdict?: string; reasons?: string[] } | null;
} | null;
type Message = { fromAgentId?: string; toAgentId?: string; body?: string };

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
        const m = p.message as Message | undefined;
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
      case "agent.woken":
        title = `${who} se reactiva: tiene mensajes nuevos`;
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
    steps.push({ event, order: steps.length, edge, nodes, label, title, risk });
  }
  return steps;
}

/**
 * Debugging events behind a message: everything that happened since the previous
 * message (the email, thoughts, turns, tool calls, sandbox attempts…). For the last
 * message it also includes what happened after it, up to the end of the run.
 */
export function detailsFor(all: Step[], visible: Step[], k: number): Step[] {
  const cur = visible[k];
  if (!cur) return [];
  const from = k > 0 ? visible[k - 1]!.order + 1 : 0;
  const before = all.slice(from, cur.order);
  const after = k === visible.length - 1 ? all.slice(cur.order + 1) : [];
  return [...before, ...after].filter((s) => s.event.type !== "agent.message_received");
}

function layout(agents: AgentSpec[], steps: Step[], events: TraceEvent[]): GraphNode[] {
  const email = emailOf(events);
  const seed = String(events.find((e) => e.type === "run.started")?.payload.seedAgentId ?? agents[0]?.id ?? "");
  const ordered = [...agents].sort((a, b) => (a.id === seed ? -1 : b.id === seed ? 1 : 0));
  const nodes: GraphNode[] = [];
  if (steps.some((s) => s.nodes.includes(SOURCE))) {
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

/** The readable part of a step: the message itself, the email, the sandbox decision… */
function MainContent({ step, name }: { step: Step; name: (id?: string) => string }) {
  const e = step.event, p = e.payload;
  if (e.type === "agent.message_sent" || e.type === "agent.message_received") {
    const m = p.message as Message | undefined;
    return (
      <div className="dbg-msg">
        <div className="dbg-msg-h"><span>De <b>{name(m?.fromAgentId)}</b></span><span>Para <b>{name(m?.toAgentId)}</b></span></div>
        <div className="dbg-msg-body">{m?.body ?? ""}</div>
      </div>
    );
  }
  if (e.type === "run.started") {
    const email = p.email as EmailMeta;
    if (!email) return <p className="dbg-quote">{String(p.scenarioHint ?? summarize(e))}</p>;
    const verdict = email.senderCheck?.verdict;
    return (
      <div className="dbg-msg email">
        <dl className="dbg-kv">
          <dt>De</dt><dd>{email.from ?? "?"}</dd>
          {email.subject ? <><dt>Asunto</dt><dd>{email.subject}</dd></> : null}
          <dt>Escenario</dt><dd>{email.id}{email.technique ? ` · ${email.technique}` : ""}</dd>
          <dt>Verificación del remitente</dt>
          <dd className={verdict && verdict !== "OK" ? "bad" : ""}>{verdict ?? "desactivada"}</dd>
        </dl>
        {email.senderCheck?.reasons?.length ? <ul className="dbg-reasons">{email.senderCheck.reasons.map((r) => <li key={r}>{r}</li>)}</ul> : null}
      </div>
    );
  }
  if (e.type === "sandbox.tool_attempt") {
    return (
      <div className={`dbg-msg ${p.blocked ? "blocked" : ""}`}>
        <div className="dbg-msg-h"><span><b>{name(e.agentId)}</b> intentó usar <code>{String(p.tool)}</code></span><span className="dbg-verdict">{p.blocked ? "BLOQUEADO" : "SIMULADO"}</span></div>
        <pre className="dbg-json">{json(p.args)}</pre>
      </div>
    );
  }
  if (e.type === "agent.done") return <p className="dbg-quote">{String(p.summary ?? "")}</p>;
  if (e.type === "agent.thought") return <p className="dbg-quote thought">{String(p.text ?? "")}</p>;
  return <p className="dbg-quote">{summarize(e)}</p>;
}

/** Short, human-readable line for the conversation list. */
function threadText(e: TraceEvent): string {
  const p = e.payload;
  switch (e.type) {
    case "agent.message_sent":
    case "agent.message_received":
      return (p.message as Message | undefined)?.body ?? "";
    case "run.started": {
      const email = p.email as EmailMeta;
      if (!email) return String(p.scenarioHint ?? "Escenario inicial");
      const parts = [email.from ?? "remitente desconocido", email.subject, email.technique ?? email.id];
      if (email.senderCheck?.verdict) parts.push(`verificación: ${email.senderCheck.verdict}`);
      return parts.filter(Boolean).join(" · ");
    }
    case "sandbox.tool_attempt":
      return `${String(p.tool)} · ${p.blocked ? "bloqueado" : "simulado"}`;
    case "agent.done":
      return String(p.summary ?? "");
    case "agent.thought":
      return String(p.text ?? "");
    default:
      return summarize(e);
  }
}

/** One debug event inside "Inspeccionar más". */
function TechItem({ step, name }: { step: Step; name: (id?: string) => string }) {
  const e = step.event, p = e.payload;
  let body: ReactElement;
  if (e.type === "agent.thought") body = <p className="dbg-tech-text">{String(p.text ?? "")}</p>;
  else if (e.type === "agent.tool_call") body = <><code>{String(p.name)}</code><pre className="dbg-json">{json(p.input)}</pre></>;
  else if (e.type === "agent.tool_result") body = <><code>{String(p.name)}</code><pre className="dbg-json">{json(p.result)}</pre></>;
  else if (e.type === "sandbox.tool_attempt") body = <><code>{String(p.tool)} · {p.blocked ? "BLOQUEADO" : "simulado"}</code><pre className="dbg-json">{json(p.args)}</pre></>;
  else if (e.type === "agent.done" || e.type === "run.started") body = <p className="dbg-tech-text">{threadText(e)}</p>;
  else body = <p className="dbg-tech-text">{summarize(e)}</p>;
  return (
    <li className={`dbg-tech ${step.risk ?? ""}`}>
      <span className="dbg-type">
        <i style={{ background: colorOf(e) }} />{TYPE_NAME[e.type] ?? e.type}
        <span className="dbg-tech-who">{e.agentId ? name(e.agentId) : "Ejecución"}</span>
        <small>{new Date(e.ts).toLocaleTimeString()}</small>
      </span>
      {body}
    </li>
  );
}

type Props = { events: TraceEvent[]; agents: AgentSpec[]; running: boolean };

export function ConversationDebugger({ events, agents, running }: Props) {
  const all = useMemo(() => buildSteps(events, agents), [events, agents]);
  const [debug, setDebug] = useState(false);
  const steps = useMemo(() => (debug ? all : all.filter(isMessage)), [all, debug]);
  /** Risk per visible step; in "Mensajes" mode a message also carries the risk of the debugging events behind it. */
  const stepRisk = useMemo(
    () => steps.map((s, k) => (debug ? s.risk : worst([s.risk, ...detailsFor(all, steps, k).map((d) => d.risk)]))),
    [all, steps, debug],
  );
  const nodes = useMemo(() => layout(agents, all, events), [agents, all, events]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const name = (id?: string) => agents.find((a) => a.id === id)?.name ?? id ?? "Ejecución";
  /** Event id of the step being looked at; null = follow the latest event (live). */
  const [pinned, setPinned] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const threadRef = useRef<HTMLOListElement>(null);
  const reduced = useRef(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const N = steps.length;

  // Index of the pinned event in the visible list; if it is hidden (debug view off), the last visible step before it.
  let step = N - 1;
  if (pinned !== null) {
    const order = all.find((s) => s.event.id === pinned)?.order ?? Infinity;
    step = 0;
    steps.forEach((s, k) => { if (s.order <= order) step = k; });
  }

  // Reset to live follow when a new run starts.
  const firstId = events[0]?.id;
  useEffect(() => { setPinned(null); setPlaying(false); }, [firstId]);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (step >= N - 1) return setPlaying(false);
      setPinned(steps[step + 1]!.event.id);
    }, 1100 / speed);
    return () => clearTimeout(t);
  }, [playing, speed, step, N, steps]);

  // Keep the current message visible in the thread without scrolling the page.
  useEffect(() => {
    const list = threadRef.current, item = list?.querySelector<HTMLElement>(".cur");
    if (list && item) list.scrollTop = item.offsetTop - list.offsetTop - list.clientHeight / 2 + item.clientHeight / 2;
  }, [step, debug]);

  const switchMode = (toDebug: boolean) => {
    if (toDebug === debug) return;
    setPlaying(false);
    if (pinned !== null && N > 0) setPinned(steps[step]!.event.id);
    setDebug(toDebug);
  };
  const modeSwitch = (
    <div className="dbg-mode" role="group" aria-label="Qué recorrer">
      <button type="button" aria-pressed={!debug} onClick={() => switchMode(false)} title="Saltar solo entre mensajes enviados">Mensajes</button>
      <button type="button" aria-pressed={debug} onClick={() => switchMode(true)} title="Recorrer todos los eventos: correo, pensamientos, herramientas, sandbox">Depuración</button>
    </div>
  );

  if (all.length === 0) {
    return <p className="empty">Inicia o carga una ejecución para recorrer la conversación paso a paso.</p>;
  }
  if (N === 0) {
    return (
      <div className="dbg-empty">
        <p>Aún no hay mensajes entre agentes en esta ejecución ({all.length} eventos de depuración).</p>
        {modeSwitch}
      </div>
    );
  }

  const go = (k: number) => { setPlaying(false); setPinned(steps[Math.max(0, Math.min(N - 1, k))]!.event.id); };
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    setPinned(steps[step >= N - 1 ? 0 : step]!.event.id);
    setPlaying(true);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).matches("input, select, textarea")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(step + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(step - 1); }
    else if (e.key === " " && !(e.target as HTMLElement).matches("button, summary")) { e.preventDefault(); togglePlay(); }
  };

  const cur = steps[step]!;
  /** Everything that has happened up to the current step, debug events included. */
  const past = all.slice(0, cur.order + 1);
  const details = debug ? [] : detailsFor(all, steps, step);
  const detailRisks = details.filter((d) => d.risk).length;
  const curKey = cur.edge ? edgeKey(...cur.edge) : null;
  const visited = new Set(all.slice(0, cur.order).filter((s) => s.edge).map((s) => edgeKey(...s.edge!)));
  const allEdges = new Map<string, [string, string]>();
  for (const s of all) if (s.edge && byId.has(s.edge[0]) && byId.has(s.edge[1])) allEdges.set(edgeKey(...s.edge), s.edge);
  const live = pinned === null;
  const c = colorOf(cur.event);
  const stats = {
    msgs: past.filter((s) => s.event.type === "agent.message_sent").length,
    thoughts: past.filter((s) => s.event.type === "agent.thought").length,
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
  const thread = steps.map((s, k) => ({ s, k })).filter(({ s }) => s.event.type !== "agent.message_received" || !debug);

  let active: ReactElement | null = null;
  if (cur.edge) {
    const a = byId.get(cur.edge[0]), b = byId.get(cur.edge[1]);
    if (a && b) {
      const { x1, y1, x2, y2 } = shorten(a, b, 40, 46);
      const ang = Math.atan2(y2 - y1, x2 - x1), ah = 11;
      const head = `M${x2 + Math.cos(ang) * 4},${y2 + Math.sin(ang) * 4} L${x2 - Math.cos(ang - 0.45) * ah},${y2 - Math.sin(ang - 0.45) * ah} L${x2 - Math.cos(ang + 0.45) * ah},${y2 - Math.sin(ang + 0.45) * ah}Z`;
      const lbl = cut(cur.label, 26), lw = lbl.length * 6.6 + 20;
      const pathId = `dbg-active-${cur.event.id}`;
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
          <b>{debug ? "Evento" : "Mensaje"} {step + 1} de {N}</b> · {cur.title}
          {running && (live
            ? <span className="dbg-live">● En vivo</span>
            : <button type="button" className="dbg-follow" onClick={() => { setPlaying(false); setPinned(null); }}>Seguir en vivo</button>)}
        </div>
        <div className="dbg-opts">
          {modeSwitch}
          <label className="dbg-speed">Velocidad
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
            </select>
          </label>
        </div>
        <div className="dbg-scrub" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}>
          {steps.map((s, k) => (
            <button type="button" key={s.event.id} className={`dbg-tick ${k === step ? "cur" : k < step ? "past" : ""}`}
              style={{ color: colorOf(s.event) }} onClick={() => go(k)} title={`${k + 1}. ${s.title}`} aria-label={`Paso ${k + 1}: ${s.title}`}>
              {stepRisk[k] && <span className={`r ${stepRisk[k]}`} />}
              <b style={{ background: colorOf(s.event) }} />
            </button>
          ))}
        </div>
        <div className="dbg-kbd">
          {debug
            ? "Depuración: todos los eventos (correo, pensamientos, herramientas, sandbox, cierres)."
            : "Solo mensajes enviados. Lo demás está en «Inspeccionar más» o en Depuración."}{" "}
          <kbd>←</kbd> <kbd>→</kbd> avanzar · <kbd>espacio</kbd> reproducir · clic en un nodo salta a su siguiente evento
        </div>
      </div>

      <div className="dbg-body">
        <div className="dbg-left">
          <div className="dbg-graph">
            <div className="dbg-canvas">
              <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafo de la conversación con el evento actual resaltado">
                {[...allEdges].map(([k, [a, b]]) => {
                  const { x1, y1, x2, y2 } = shorten(byId.get(a)!, byId.get(b)!, 40, 40);
                  return <line key={k} className={`dbg-e ${k === curKey ? "act" : visited.has(k) ? "vis" : "fut"}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
                })}
                {active}
                {nodes.map((n) => {
                  const col = KIND_COLOR[n.kind];
                  const count = past.filter((s) => s.nodes.includes(n.id) && BADGE_TYPES.has(s.event.type)).length;
                  const seen = past.some((s) => s.nodes.includes(n.id));
                  const st = cur.nodes.includes(n.id) ? "on" : seen ? "seen" : "idle";
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

          <div className="dbg-thread-card">
            <div className="dbg-insp-h"><h3>{debug ? "Eventos" : "Mensajes"}</h3><small>Clic para ir a ese paso</small></div>
            <ol className="dbg-thread" ref={threadRef}>
              {thread.map(({ s, k }) => {
                const text = threadText(s.event);
                return (
                  <li key={s.event.id} className={`${k === step ? "cur" : k > step ? "fut" : ""} t-${s.event.type.replace(/\./g, "-")}`}>
                    <button type="button" onClick={() => go(k)}>
                      <span className="dbg-thread-n">{k + 1}</span>
                      <span className="dbg-thread-b">
                        <b>{s.title}</b>
                        <span>{cut(text, 180)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <aside className="dbg-inspector">
          <div className="dbg-insp-h"><h3>Inspector</h3><small>{debug ? "Evento" : "Mensaje"} {step + 1} de {N} · {new Date(cur.event.ts).toLocaleTimeString()}</small></div>
          <div className="dbg-insp-b">
            <span className="dbg-type"><i style={{ background: c }} />{cur.event.type}</span>
            <strong className="dbg-title">{cur.title}</strong>
            <MainContent step={cur} name={name} />
            {cur.risk && (
              <div className={`dbg-flag ${cur.risk}`}>
                <strong>{cur.risk === "crit" ? "Riesgo crítico" : "Señal de riesgo"}</strong>
                {cur.risk === "crit" ? "Intento de cambiar datos bancarios de un proveedor." : "Revisa este paso: hubo un bloqueo, un error o un remitente sospechoso."}
              </div>
            )}
            {!debug && detailRisks > 0 && !expanded && (
              <button type="button" className={`dbg-flag ${worst(details.map((d) => d.risk))} dbg-flag-btn`} onClick={() => setExpanded(true)}>
                <strong>{detailRisks === 1 ? "1 señal de riesgo" : `${detailRisks} señales de riesgo`} en la depuración</strong>
                Ver en «Inspeccionar más» →
              </button>
            )}

            <details className="dbg-more" open={expanded} onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}>
              <summary>
                Inspeccionar más
                <small>{debug ? "payload del evento" : `${details.length} ${details.length === 1 ? "evento" : "eventos"} de depuración · payload`}</small>
              </summary>
              {!debug && (
                details.length
                  ? <>
                      <h4>{step === 0 ? "Antes de este mensaje" : "Entre el mensaje anterior y este"}{step === N - 1 && details.some((d) => d.order > cur.order) ? ", y después hasta el final" : ""}</h4>
                      <ol className="dbg-tech-list">{details.map((d) => <TechItem key={d.event.id} step={d} name={name} />)}</ol>
                    </>
                  : <p className="dbg-note">No hubo otros eventos entre el mensaje anterior y este.</p>
              )}
              <h4>Payload del evento</h4>
              <pre className="dbg-json">{json(cur.event.payload)}</pre>
            </details>

            <h4>Acumulado hasta aquí</h4>
            <dl className="dbg-stats">
              <dt>Mensajes entre agentes</dt><dd>{stats.msgs}</dd>
              <dt>Pensamientos</dt><dd>{stats.thoughts}</dd>
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
