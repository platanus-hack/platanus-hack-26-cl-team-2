import type { ObservedPath, RiskPath, RiskPathAnalysis } from "@sandbox/shared";

const LEVEL_LABEL: Record<RiskPath["level"], string> = {
  local: "local",
  interaction: "interaction",
  systemic: "systemic",
};

function nodeLabel(id: string, names: Record<string, string>): string {
  return id === "email" ? "external email" : (names[id] ?? id);
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
  title = "Risk paths (MESH)",
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
        Computed from who reads the email, who can message whom and who holds finance tools
        — no AI. A dashed arrow (⇢) is a hop where the receiver can no longer tell the request
        came from an external email.
      </p>
      {loading && !analysis ? <p className="empty">Analyzing…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {analysis ? (
        <>
          <div className="mesh-compare">
            <div>
              <h3>Component by component</h3>
              <p className={analysis.componentsAllOk ? "outcome-verdict tone-ok" : "outcome-verdict tone-warn"}>
                {analysis.componentsAllOk
                  ? "Every component passes"
                  : `${analysis.components.filter((c) => !c.ok).length} component(s) fail`}
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
              <h3>Paths to a finance tool</h3>
              <p
                className={
                  analysis.summary.high > 0
                    ? "outcome-verdict tone-bad"
                    : analysis.summary.total > 0
                      ? "outcome-verdict tone-warn"
                      : "outcome-verdict tone-ok"
                }
              >
                {analysis.summary.total === 0
                  ? "No path from untrusted input to a finance tool"
                  : `${analysis.summary.total} path(s), ${analysis.summary.high} high`}
              </p>
              <p className="hint">
                {analysis.summary.local} local · {analysis.summary.interaction} interaction ·{" "}
                {analysis.summary.systemic} systemic
                {analysis.summary.verdictLost
                  ? ` · sender-check verdict lost on ${analysis.summary.verdictLost}`
                  : ""}
                {analysis.fixes.length ? ` · fixes: ${analysis.fixes.join(", ")}` : ""}
              </p>
            </div>
          </div>

          {analysis.paths.length ? (
            <ul className="risk-list">
              {analysis.paths.map((p) => (
                <li key={p.id} data-severity={p.severity}>
                  <span>
                    <strong>{p.id}</strong> · {p.severity} · {LEVEL_LABEL[p.level]}
                  </span>
                  <Chain
                    nodes={p.nodes}
                    names={analysis.names}
                    hopOk={(i) => p.hops[i]?.provenanceVisible ?? true}
                    hopTitle={(i) => {
                      const h = p.hops[i];
                      if (!h) return "";
                      return `${h.channel}: origin ${h.provenanceVisible ? "visible" : "lost"}, sender verdict ${h.verdictVisible ? "visible" : "not visible"}`;
                    }}
                    tail="finance tools"
                  />
                  <span className="muted">{p.finding}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {observed ? (
            <>
              <h3>Observed in this run</h3>
              {observed.length === 0 ? (
                <p className="empty">
                  The email never reached an agent with finance tools in this run.
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
                            confirms <strong>{o.matchesPredicted}</strong>
                          </>
                        ) : (
                          "not among the predicted paths"
                        )}{" "}
                        · {LEVEL_LABEL[o.level]}
                      </span>
                      <Chain
                        nodes={o.nodes}
                        names={analysis.names}
                        hopOk={(h) => o.hops[h]?.warningCarried ?? true}
                        hopTitle={(h) =>
                          o.hops[h]?.warningCarried
                            ? "message carried a warning or the email's origin"
                            : "no warning or origin in this message"
                        }
                        tail={
                          o.sink
                            ? `${o.sink}${o.blocked ? " (blocked)" : ""}`
                            : "reached, no finance call"
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
              <p className="hint">
                Observed hops: a dashed arrow means the message had no warning words or harness
                provenance tag (keyword heuristic, not a classifier).
              </p>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
