import type { ObservedPath, RiskPath, RiskPathAnalysis } from "@sandbox/shared";
import { fixLabel, SEVERITY_LABEL } from "./RunOutcome";

const LEVEL_LABEL: Record<RiskPath["level"], string> = {
  local: "local",
  interaction: "interacción",
  systemic: "sistémica",
};

/** 0.004 -> "<1%", 0.237 -> "24%". */
function pct(n: number): string {
  return n > 0 && n < 0.01 ? "<1%" : `${Math.round(n * 100)}%`;
}

function nodeLabel(id: string, names: Record<string, string>): string {
  return id === "email" ? "correo externo" : (names[id] ?? id);
}

/** email → Gina → Omar → Fede, with a mark on hops where the origin stops being visible. */
function Chain({
  nodes,
  names,
  hopOk,
  hopTitle,
  tail,
}: {
  nodes: string[];
  names: Record<string, string>;
  hopOk: (i: number) => boolean;
  hopTitle: (i: number) => string;
  tail?: string;
}) {
  return (
    <span className="chain">
      {nodes.map((id, i) => (
        <span key={`${id}-${i}`} className="chain-step">
          {i > 0 ? (
            <span
              className={hopOk(i - 1) ? "chain-arrow" : "chain-arrow lost"}
              title={hopTitle(i - 1)}
            >
              {hopOk(i - 1) ? "→" : "⇢"}
            </span>
          ) : null}
          <span className={id === "email" ? "chain-node source" : "chain-node"}>
            {nodeLabel(id, names)}
          </span>
        </span>
      ))}
      {tail ? (
        <span className="chain-step">
          <span className="chain-arrow">→</span>
          <span className="chain-node sink">{tail}</span>
        </span>
      ) : null}
    </span>
  );
}

/**
 * MESH view: the component checks (what a per-agent review sees) next to the routes from the
 * external email to a finance tool. Predicted from the setup; after a run, the routes the
 * trace shows were actually taken.
 */
export function RiskPathsPanel({
  analysis,
  observed,
  loading,
  error,
  title = "Rutas de riesgo (MESH)",
}: {
  analysis: RiskPathAnalysis | null;
  observed?: ObservedPath[] | null;
  loading?: boolean;
  error?: string | null;
  title?: string;
}) {
  if (!analysis && !loading && !error) return null;
  return (
    <section className="panel risk-paths">
      <h2>{title}</h2>
      <p className="hint">
        Calculado a partir de quién lee el correo, quién puede escribirle a quién y quién tiene
        herramientas de finanzas, sin IA. Una flecha punteada (⇢) es un salto donde quien recibe
        ya no puede saber que el pedido vino de un correo externo.
      </p>
      {loading && !analysis ? <p className="empty">Analizando…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {analysis ? (
        <>
          <div className="mesh-compare">
            <div>
              <h3>Componente por componente</h3>
              <p className={analysis.componentsAllOk ? "outcome-verdict tone-ok" : "outcome-verdict tone-warn"}>
                {analysis.componentsAllOk
                  ? "Todos los componentes pasan"
                  : `${analysis.components.filter((c) => !c.ok).length} componente(s) fallan`}
              </p>
              <ul className="component-list">
                {analysis.components.map((c) => (
                  <li key={c.id} title={c.detail}>
                    <span className={c.ok ? "verdict-ok" : "verdict-bad"}>{c.ok ? "✓" : "✗"}</span>{" "}
                    {c.label}
                    <span className="muted"> — {c.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Rutas hacia una herramienta de finanzas</h3>
              <p
                className={
                  analysis.summary.high > 0
                    ? "outcome-verdict tone-bad"
                    : analysis.paths.some((p) => p.severity === "medium")
                      ? "outcome-verdict tone-neutral"
                      : "outcome-verdict tone-ok"
                }
              >
                {analysis.summary.total === 0
                  ? "Ninguna ruta desde una entrada no confiable hacia finanzas"
                  : `${analysis.summary.total} ruta(s), ${analysis.summary.high} de severidad alta`}
              </p>
              <p className="hint">
                {analysis.summary.local} local · {analysis.summary.interaction} de interacción ·{" "}
                {analysis.summary.systemic} sistémica(s)
                {analysis.summary.verdictLost
                  ? ` · veredicto del remitente perdido en ${analysis.summary.verdictLost}`
                  : ""}
                {analysis.fixes.length ? ` · mitigaciones: ${analysis.fixes.map(fixLabel).join(", ")}` : ""}
              </p>
              {analysis.paths.length ? (
                <p className="hint">
                  {analysis.weighted
                    ? `Ordenadas por probabilidad × severidad, según ${analysis.weighted.messages} mensaje(s) entre estos agentes en ejecuciones anteriores. La probabilidad de una ruta es la de cada salto multiplicada.`
                    : "Estos agentes aún no se han enviado mensajes en ejecuciones anteriores: las rutas se ordenan solo por severidad."}
                </p>
              ) : null}
            </div>
          </div>

          {analysis.paths.length ? (
            <ul className="risk-list">
              {analysis.paths.map((p) => (
                <li key={p.id} data-severity={p.severity}>
                  <span>
                    <strong>{p.id}</strong> · severidad {SEVERITY_LABEL[p.severity]} · {LEVEL_LABEL[p.level]}
                    {p.likelihood !== undefined ? (
                      <>
                        {" "}· probabilidad <strong>{pct(p.likelihood)}</strong>
                        <span className="likelihood-bar" aria-hidden="true">
                          <span style={{ width: `${Math.max(2, Math.round(p.likelihood * 100))}%` }} />
                        </span>
                      </>
                    ) : null}
                  </span>
                  <Chain
                    nodes={p.nodes}
                    names={analysis.names}
                    hopOk={(i) => p.hops[i]?.provenanceVisible ?? true}
                    hopTitle={(i) => {
                      const h = p.hops[i];
                      if (!h) return "";
                      const base = `${h.channel === "email" ? "correo" : "mensaje entre agentes"}: origen ${h.provenanceVisible ? "visible" : "perdido"}, veredicto del remitente ${h.verdictVisible ? "visible" : "no visible"}`;
                      if (h.channel !== "peer_message" || h.likelihood === undefined) return base;
                      return `${base} · ${pct(h.likelihood)} de lo que ${nodeLabel(h.from, analysis.names)} envía a este grupo va a ${nodeLabel(h.to, analysis.names)} (${h.messages ?? 0} mensaje(s) antes)`;
                    }}
                    tail="herramientas de finanzas"
                  />
                  <span className="muted">{p.finding}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {observed ? (
            <>
              <h3>Observado en esta ejecución</h3>
              {observed.length === 0 ? (
                <p className="empty">
                  En esta ejecución el correo nunca llegó a un agente con herramientas de finanzas.
                </p>
              ) : (
                <ul className="risk-list">
                  {observed.map((o, i) => (
                    <li
                      key={`${o.financeAgentId}-${o.sink ?? "reached"}-${i}`}
                      data-severity={o.sink === "update_vendor_bank_account" ? "high" : o.sink ? "medium" : "low"}
                    >
                      <span>
                        {o.matchesPredicted ? (
                          <>
                            confirma <strong>{o.matchesPredicted}</strong>
                          </>
                        ) : (
                          "no estaba entre las rutas previstas"
                        )}{" "}
                        · {LEVEL_LABEL[o.level]}
                      </span>
                      <Chain
                        nodes={o.nodes}
                        names={analysis.names}
                        hopOk={(h) => o.hops[h]?.warningCarried ?? true}
                        hopTitle={(h) =>
                          o.hops[h]?.warningCarried
                            ? "el mensaje llevaba una advertencia o el origen del correo"
                            : "este mensaje no llevaba advertencia ni origen"
                        }
                        tail={
                          o.sink
                            ? `${o.sink}${o.held ? " (retenido para aprobación)" : o.blocked ? " (bloqueado)" : ""}`
                            : "llegó, sin acción de finanzas"
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
              <p className="hint">
                Saltos observados: una flecha punteada significa que el mensaje no tenía palabras de
                advertencia ni la etiqueta de procedencia (heurística por palabras clave, no un clasificador).
              </p>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
