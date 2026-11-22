import { useEffect, useMemo, useState } from "react";
import type { TraceEvent } from "@sandbox/shared";
import { fetchRun } from "./api";

/** One thing that moved in a run: the email arriving, a peer message, a finance tool call, or an agent finishing. */
export type FlowStep =
  | { kind: "email"; from: "email"; to: string; subject: string; sender: string; text: string }
  | { kind: "message"; from: string; to: string; text: string; why: string }
  | {
      kind: "tool";
      from: string;
      to: string;
      tool: string;
      args: unknown;
      status: "ok" | "held" | "blocked";
      dangerous: boolean;
      text: string;
      why: string;
    }
  | { kind: "done"; from: string; to: string; text: string };

export type FlowAgent = { id: string; name: string; title: string; finance: boolean; tools: string[] };
/** One .txt database and which reached agents can read or write it. */
export type FlowDb = {
  id: string;
  name: string;
  txt: boolean;
  links: Array<{ agentId: string; read: boolean; write: boolean }>;
};
/**
 * `agents` = the ones the email reached (directly or through a colleague); `idle` = how many in the
 * run it never reached; `background` = messages among those others, left out of `steps`.
 */
export type Flow = { agents: FlowAgent[]; databases: FlowDb[]; idle: number; background: number; sender: string; steps: FlowStep[] };

const TXT_TOOL = /^(.+)_txt_(read|write)$/;
const DB_TOOL = /^(.+)_db$/;

/** A .txt file (or the older *_db name) is one database, not a separate tool box. */
function databaseOf(tool: string): { id: string; name: string; mode: "read" | "write" | "use" } | null {
  const txt = TXT_TOOL.exec(tool);
  if (txt?.[1] && txt[2]) return { id: `db:${txt[1]}`, name: txt[1], mode: txt[2] as "read" | "write" };
  const db = DB_TOOL.exec(tool);
  if (db?.[1]) return { id: `db:${db[1]}`, name: db[1], mode: "use" };
  return null;
}

type Tone = "bad" | "warn" | "ok" | "muted";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Pure: turns a stored trace into graph steps. Inbox reads are left out because they move nothing
 * between agents; each message or tool call carries the agent's last thought before it.
 */
export function buildFlow(events: TraceEvent[]): Flow | null {
  const start = events.find((e) => e.type === "run.started")?.payload;
  if (!start) return null;
  const financeIds = Array.isArray(start.financeAgentIds) ? (start.financeAgentIds as string[]) : [];
  const agents: FlowAgent[] = (Array.isArray(start.agents) ? (start.agents as Record<string, unknown>[]) : []).map((a) => ({
    id: str(a.id),
    name: str(a.name) || str(a.id),
    title: /Title: ([^\n·]+)/.exec(str(a.role))?.[1]?.trim() ?? "",
    finance: financeIds.includes(str(a.id)),
    tools: Array.isArray(a.mockDbTools) ? a.mockDbTools.map((tool) => str(tool)).filter(Boolean) : [],
  }));
  const email = (start.email ?? {}) as Record<string, unknown>;
  const hint = str(start.scenarioHint);
  const body = /----- email -----\n([\s\S]*?)----- end of email -----/.exec(hint)?.[1] ?? hint;
  const steps: FlowStep[] = [];
  if (start.email || hint) {
    steps.push({
      kind: "email",
      from: "email",
      to: str(start.seedAgentId),
      subject: str(email.subject),
      sender: str(email.from),
      text: body.replace(/^From:.*\nSubject:.*\n/, "").trim(),
    });
  }
  const lastThought: Record<string, string> = {};
  for (const e of events) {
    const p = e.payload ?? {};
    const agent = e.agentId ?? "";
    if (e.type === "agent.thought") lastThought[agent] = squash(str(p.text));
    if (e.type === "agent.message_sent") {
      const m = (p.message ?? {}) as Record<string, unknown>;
      steps.push({ kind: "message", from: str(m.fromAgentId), to: str(m.toAgentId), text: str(m.body).trim(), why: lastThought[agent] ?? "" });
      lastThought[agent] = "";
    }
    if (e.type === "sandbox.tool_attempt") {
      const result = (p.result ?? {}) as Record<string, unknown>;
      const args = (p.args ?? {}) as Record<string, unknown>;
      const toolName = str(p.tool);
      const db = databaseOf(toolName);
      steps.push({
        kind: "tool",
        from: agent,
        to: db ? db.id : `tool:${toolName}`,
        tool: toolName,
        args: p.mockDb ? { action: args.action } : args,
        status: p.held ? "held" : p.blocked ? "blocked" : "ok",
        dangerous: Boolean(p.dangerous),
        text: str(result.reason),
        why: lastThought[agent] ?? "",
      });
      lastThought[agent] = "";
    }
    if (e.type === "agent.done") steps.push({ kind: "done", from: agent, to: agent, text: squash(str(p.summary)) });
  }
  // Follow the email: an agent joins once a reached agent messages it. In a big org the others
  // chat among themselves about their own work; that background is counted, not drawn.
  const reached = new Set([str(start.seedAgentId)]);
  let background = 0;
  const chain = steps.filter((s) => {
    if (s.kind === "email") return true;
    if (!reached.has(s.from)) {
      if (s.kind === "message") background += 1;
      return false;
    }
    if (s.kind === "message") reached.add(s.to);
    return true;
  });
  const reachedAgents = agents.filter((agent) => reached.has(agent.id));
  const databases = new Map<string, FlowDb>();
  const touch = (tool: string, agentId: string) => {
    const db = databaseOf(tool);
    if (!db || !agentId) return;
    const row = databases.get(db.id) ?? { id: db.id, name: db.name, txt: false, links: [] };
    const link = row.links.find((item) => item.agentId === agentId) ?? { agentId, read: false, write: false };
    if (db.mode === "read" || db.mode === "use") link.read = true;
    if (db.mode === "write") link.write = true;
    if (db.mode !== "use") row.txt = true;
    if (!row.links.includes(link)) row.links.push(link);
    databases.set(db.id, row);
  };
  for (const agent of reachedAgents) {
    for (const tool of agent.tools) touch(tool, agent.id);
  }
  for (const step of chain) {
    if (step.kind === "tool") touch(step.tool, step.from);
  }
  return {
    agents: reachedAgents,
    databases: [...databases.values()],
    idle: agents.filter((a) => !reached.has(a.id)).length,
    background,
    sender: str(email.from),
    steps: chain,
  };
}

/** Pure: how a tool call reads for this email (`attack` = the email is fraud). */
export function toolTone(s: Extract<FlowStep, { kind: "tool" }>, attack: boolean): Tone {
  if (s.status === "held") return "warn";
  if (s.status === "blocked") return s.dangerous ? "bad" : "muted";
  return attack && (s.tool === "issue_refund" || s.dangerous) ? "bad" : "ok";
}

const RISK_WORD =
  /reembolso|refund|banco|cuenta|iban|tarjeta|clave|contraseña|password|secret|salud|l[ií]mite|usd|exfil|n[oó]mina|transferenc|proveedor|pago|datos/i;

/** Any hint of risk paints the step orange. A blocked or paid attack stays red. */
export function stepRisk(s: FlowStep, attack: boolean): "bad" | "warn" | "" {
  if (s.kind === "tool") {
    const tone = toolTone(s, attack);
    if (tone === "bad") return "bad";
    if (tone === "warn" || tone === "ok") return "warn";
    return "";
  }
  const blob = `${s.text}\n${"why" in s ? s.why : ""}\n${s.kind === "email" ? `${s.subject} ${s.sender}` : ""}`;
  return RISK_WORD.test(blob) ? "warn" : "";
}

const TOOL_LABEL: Record<string, string> = { issue_refund: "Reembolso", update_vendor_bank_account: "Cambio bancario" };
const cutTo = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type Box = { x: number; y: number; w: number; h: number };

/** Columns: email → non-finance agents → finance agents → tools. */
function layout(flow: Flow): Record<string, Box> {
  const pos: Record<string, Box> = { email: { x: 80, y: 190, w: 130, h: 56 } };
  // Boxes shrink when a column is crowded, so up to ~8 agents per column still fit in 360px.
  const spread = (ids: string[], x: number, w: number, h: number) =>
    ids.forEach((id, i) => {
      const gap = ids.length > 1 ? 240 / (ids.length - 1) : 240;
      pos[id] = { x, y: ids.length === 1 ? 190 : 70 + i * gap, w, h: Math.min(h, gap - 6) };
    });
  spread(flow.agents.filter((a) => !a.finance).map((a) => a.id), 290, 158, 56);
  spread(flow.agents.filter((a) => a.finance).map((a) => a.id), 510, 158, 56);
  const tools = [
    ...flow.databases.map((db) => db.id),
    ...new Set(flow.steps.filter((s) => s.kind === "tool" && s.to.startsWith("tool:")).map((s) => s.to)),
  ];
  if (tools.length) spread(tools, 715, 150, 46);
  return pos;
}

function clip(b: Box, toward: { x: number; y: number }) {
  const dx = toward.x - b.x;
  const dy = toward.y - b.y;
  const s = Math.min(dx ? b.w / 2 / Math.abs(dx) : Infinity, dy ? b.h / 2 / Math.abs(dy) : Infinity);
  return { x: b.x + dx * s, y: b.y + dy * s };
}

function edgePath(a: Box, b: Box, bend: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const c = { x: (a.x + b.x) / 2 - (dy / len) * bend, y: (a.y + b.y) / 2 + (dx / len) * bend };
  const s = clip(a, c);
  const e = clip(b, c);
  return { d: `M${s.x},${s.y} Q${c.x},${c.y} ${e.x},${e.y}`, c };
}

function FlowGraph({ flow, step, attack }: { flow: Flow; step: number; attack: boolean }) {
  const pos = useMemo(() => layout(flow), [flow]);
  const upto = flow.steps.slice(0, step + 1);
  const cur = flow.steps[step];

  type Pair = { from: string; to: string; n: number; last: number; tone: Tone | null };
  const pairs = new Map<string, Pair>();
  upto.forEach((s, i) => {
    if (s.kind === "done" || s.to.startsWith("db:")) return;
    const k = `${s.from}>${s.to}`;
    const p = pairs.get(k) ?? { from: s.from, to: s.to, n: 0, last: -1, tone: null };
    p.n++;
    p.last = i;
    if (s.kind === "tool") p.tone = toolTone(s, attack);
    pairs.set(k, p);
  });
  const toolState: Record<string, Tone> = {};
  const done = new Set<string>();
  for (const s of upto) {
    if (s.kind === "tool") toolState[s.to] = toolTone(s, attack);
    if (s.kind === "done") done.add(s.from);
  }

  const nodes = [
    { id: "email", name: "Correo externo", sub: cutTo(flow.sender.replace(/<.*>/, "").trim() || flow.sender, 20), finance: false, tool: false },
    ...flow.agents.map((a) => ({ id: a.id, name: a.name, sub: cutTo(a.title, 24), finance: a.finance, tool: false })),
    ...Object.keys(pos)
      .filter((k) => k.startsWith("tool:"))
      .map((k) => ({ id: k, name: TOOL_LABEL[k.slice(5)] ?? k.slice(5), sub: cutTo(k.slice(5), 24), finance: false, tool: true })),
  ];

  let pulse: { d: string; tone: string } | null = null;
  const edges = [...pairs.values()]
    .sort((a, b) => a.last - b.last)
    .flatMap((p) => {
      const a = pos[p.from];
      const b = pos[p.to];
      if (!a || !b) return [];
      const back = pairs.has(`${p.to}>${p.from}`);
      const { d, c } = edgePath(a, b, back ? (p.from < p.to ? 26 : -26) : 0);
      const current = p.last === step;
      const colored = p.tone === "bad" || p.tone === "warn" ? p.tone : "";
      if (current) pulse = { d, tone: colored };
      const marker = current ? colored || "active" : "past";
      return [
        <g key={`${p.from}>${p.to}`}>
          <path d={d} className={`flow-edge ${current ? "active" : "past"} ${colored}`} markerEnd={`url(#flow-m-${marker})`} />
          {p.n > 1 ? (
            <text x={c.x} y={c.y - 6} textAnchor="middle" className="flow-edge-count">
              ×{p.n}
            </text>
          ) : null}
        </g>,
      ];
    });
  const dbEdges = flow.databases.flatMap((db) => {
    const target = pos[db.id];
    if (!target) return [];
    return db.links.flatMap((link) => {
      const source = pos[link.agentId];
      if (!source) return [];
      const { d } = edgePath(source, target, 0);
      const used = upto.some((item) => item.kind === "tool" && item.from === link.agentId && item.to === db.id);
      const current = cur?.kind === "tool" && cur.from === link.agentId && cur.to === db.id;
      if (current) pulse = { d, tone: "" };
      const agent = flow.agents.find((item) => item.id === link.agentId)?.name ?? link.agentId;
      const perms = db.txt
        ? [link.read ? `leer · ${db.name}_txt_read` : "", link.write ? `escribir · ${db.name}_txt_write` : ""].filter(Boolean)
        : [];
      return { key: `${db.id}-${link.agentId}`, d, used, current, title: [agent, db.name, ...perms].join(" · ") };
    });
  });
  const activePulse = pulse as { d: string; tone: string } | null;

  return (
    <svg className="flow-graph" viewBox="0 0 800 360" role="img" aria-label="Grafo de interacción entre agentes">
      <defs>
        {(["past", "active", "bad", "warn"] as const).map((k) => (
          <marker key={k} id={`flow-m-${k}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className={`flow-marker ${k}`} />
          </marker>
        ))}
      </defs>
      {(
        [
          ["Entrada", 80],
          ["Agentes", 290],
          ["Finanzas", 510],
          ...(flow.databases.length || Object.keys(pos).some((id) => id.startsWith("tool:"))
            ? [["Bases", 715] as const]
            : []),
        ]
      ).map(([t, x]) => (
        <text key={t} x={x} y={26} textAnchor="middle" className="flow-col-label">
          {t}
        </text>
      ))}
      {edges}
      {dbEdges.map((edge) => (
        <path key={edge.key} d={edge.d} className={`flow-db-edge${edge.used ? " seen" : ""}${edge.current ? " active" : ""}`}>
          <title>{edge.title}</title>
        </path>
      ))}
      {nodes.map((n) => {
        const b = pos[n.id];
        if (!b) return null;
        const active = cur && (cur.from === n.id || cur.to === n.id);
        const state = n.tool && toolState[n.id] ? (toolState[n.id] === "muted" ? "blocked" : toolState[n.id]) : "";
        return (
          <g
            key={n.id}
            className={`flow-node${active ? " active" : ""}${n.finance ? " finance" : ""}${n.tool ? " tool" : ""} ${state}`}
            transform={`translate(${b.x - b.w / 2},${b.y - b.h / 2})`}
          >
            <rect width={b.w} height={b.h} rx={6} />
            <text x={12} y={b.h >= 44 ? b.h / 2 - 3 : b.h / 2 + 4}>
              {n.name}
            </text>
            {b.h >= 44 ? (
              <text x={12} y={b.h / 2 + 13} className="sub">
                {n.sub}
              </text>
            ) : null}
            {done.has(n.id) ? (
              <text x={b.w - 10} y={16} textAnchor="end" className="badge">
                ✓
              </text>
            ) : null}
          </g>
        );
      })}
      {flow.databases.map((db) => {
        const b = pos[db.id];
        if (!b) return null;
        const active = cur?.kind === "tool" && cur.to === db.id;
        const r = 22;
        return (
          <g key={db.id} className={`flow-db${active ? " active" : ""}`} transform={`translate(${b.x - b.w / 2},${b.y - b.h / 2})`}>
            <circle cx={b.w / 2} cy={b.h / 2 - 6} r={r} />
            <text x={b.w / 2} y={b.h / 2 + r + 8} textAnchor="middle">
              {db.name}
            </text>
          </g>
        );
      })}
      {activePulse ? (
        <circle r={5} className={`flow-pulse ${activePulse.tone}`}>
          <animateMotion dur="1.1s" repeatCount="indefinite" path={activePulse.d} />
        </circle>
      ) : null}
    </svg>
  );
}

function StepCard({ flow, step, attack }: { flow: Flow; step: number; attack: boolean }) {
  const s = flow.steps[step];
  if (!s) return <p className="hint">Esta ejecución no tiene pasos.</p>;
  const name = (id: string) =>
    id === "email" ? "Correo externo" : id.startsWith("tool:") ? id.slice(5) : id.startsWith("db:") ? id.slice(3) : (flow.agents.find((a) => a.id === id)?.name ?? id);
  let kind = "Correo";
  let tone = "";
  let route = <>{s.kind === "email" ? `${s.sender} → ${name(s.to)}` : ""}</>;
  if (s.kind === "message") {
    kind = "Mensaje";
    route = <>{`${name(s.from)} → ${name(s.to)}`}</>;
  }
  if (s.kind === "done") {
    kind = "Terminó";
    route = <>{name(s.from)}</>;
  }
  if (s.kind === "tool") {
    const t = toolTone(s, attack);
    kind = { ok: "Herramienta ejecutada", bad: s.status === "blocked" ? "Bloqueado por el sandbox" : "Dinero movido", warn: "Retenido para aprobación", muted: "Bloqueado" }[t];
    tone = t === "bad" || t === "warn" ? t : "";
    route = (
      <>
        {name(s.from)} → <code>{s.tool}</code>
      </>
    );
  }
  const dump = Boolean(s.text || ("why" in s && s.why) || s.kind === "tool");
  return (
    <div className="flow-card" aria-live="polite">
      <div className="flow-card-head">
        <span className={`flow-kind ${tone}`}>{kind}</span>
        <span className="flow-route">{route}</span>
      </div>
      {s.kind === "email" ? <div className="flow-args">Asunto: {s.subject}</div> : null}
      {dump ? (
        <details className="flow-deep">
          <summary>Análisis a profundidad</summary>
          {s.kind === "tool" ? <div className="flow-args">{JSON.stringify(s.args)}</div> : null}
          {s.text ? <p className="flow-body">{s.text}</p> : null}
          {"why" in s && s.why ? (
            <p className="flow-why">
              <b>Lo que razonó antes</b>
              {s.why}
            </p>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}

/** Step-by-step graph of how one stored run moved between agents. */
export function AgentFlow({ runId, attack }: { runId: string; attack: boolean }) {
  const [flow, setFlow] = useState<Flow | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFlow(undefined);
    setError("");
    setStep(0);
    setPlaying(false);
    fetchRun(runId)
      .then((r) => !cancelled && setFlow(buildFlow(r.events)))
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setFlow(null);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const last = (flow?.steps.length ?? 1) - 1;
  useEffect(() => {
    if (!playing) return;
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => Math.min(last, s + 1)), 1700);
    return () => clearTimeout(t);
  }, [playing, step, last]);

  if (flow === undefined) return <p className="hint">Cargando la traza…</p>;
  if (!flow) return <p className="hint verdict-bad">{error || "No se pudo leer la traza de esta ejecución."}</p>;

  const go = (i: number) => setStep(Math.max(0, Math.min(last, i)));
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(step + 1);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(step - 1);
    }
  };

  return (
    <div className="flow" onKeyDown={onKey}>
      <div className="flow-stage">
        <FlowGraph flow={flow} step={step} attack={attack} />
      </div>
      {flow.idle > 0 ? (
        <p className="hint flow-idle">
          El correo llegó a {flow.agents.length} de {flow.agents.length + flow.idle} agentes. Los otros {flow.idle} no lo
          vieron{flow.background > 0 ? ` (sus ${flow.background} mensajes entre ellos no se muestran)` : ""}.
        </p>
      ) : null}
      <div className="flow-controls">
        <button className="btn ghost" onClick={() => go(0)} disabled={step === 0} aria-label="Ir al inicio">
          ⏮
        </button>
        <button className="btn ghost" onClick={() => go(step - 1)} disabled={step === 0}>
          ← Anterior
        </button>
        <button className="btn" onClick={() => go(step + 1)} disabled={step >= last}>
          Siguiente →
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            if (!playing && step >= last) setStep(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? "❚❚ Pausa" : "▶ Reproducir"}
        </button>
        <span className="flow-counter">
          Paso {step + 1} de {last + 1}
        </span>
        <div className="flow-strip" aria-label="Pasos">
          {flow.steps.map((s, i) => {
            const tone = stepRisk(s, attack);
            const label =
              s.kind === "tool" ? s.tool : s.kind === "message" ? "mensaje" : s.kind === "done" ? "terminó" : "correo";
            return (
              <button
                key={i}
                type="button"
                className={`${s.kind}${tone === "bad" ? " bad" : ""}${tone === "warn" ? " risk" : ""}${i <= step ? " seen" : ""}${i === step ? " current" : ""}`}
                aria-label={`Paso ${i + 1}: ${label}`}
                title={`Paso ${i + 1}: ${label}`}
                onClick={() => go(i)}
              />
            );
          })}
        </div>
      </div>
      <StepCard flow={flow} step={step} attack={attack} />
    </div>
  );
}
