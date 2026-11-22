import { useEffect, useState } from "react";
import { fetchDemoSimFindings, type DemoSimFinding } from "../api";
import { AgentFlow } from "../AgentFlow";
import "../evaluations-list.css";

/** Satisfactory DEMO SIM iterations, in the same expandable row as the other evaluations. */
export function DemoSimFindings() {
  const [findings, setFindings] = useState<DemoSimFinding[] | null>(null);
  const [openId, setOpenId] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchDemoSimFindings()
      .then((list) => {
        if (!cancelled) setFindings(list);
      })
      .catch(() => {
        if (!cancelled) setFindings([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!findings?.length) return null;

  return (
    <section className="panel">
      <h2>Caminos explotados</h2>
      <p className="hint">{findings.length} vector{findings.length === 1 ? "" : "es"} encontrado{findings.length === 1 ? "" : "s"} al iterar un prompt sobre el grafo.</p>
      <div className="eval-list">
        {findings.map((finding) => {
          const open = openId === finding.id;
          return (
            <article className={open ? "eval-item expanded" : "eval-item"} key={finding.id}>
              <h3 className="eval-row-heading">
                <button
                  type="button"
                  className="eval-row"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? "" : finding.id)}
                >
                  <span className="eval-chevron" aria-hidden="true">{open ? "▾" : "▸"}</span>
                  <span className="eval-row-title">
                    {finding.attackSurface}
                    <small>{finding.companyName}</small>
                  </span>
                  <span className="verdict-bad">Vector encontrado</span>
                </button>
              </h3>
              <div hidden={!open}>
                {open ? (
                  <div className="eval-expanded">
                    <p>{finding.prompt}</p>
                    <h4>Vector de ataque</h4>
                    <ol className="eval-vector">
                      {finding.vector.map((step, index) => (
                        <li key={`${finding.id}-${index}`}>
                          <strong>{step.title}</strong>
                          {step.detail}
                        </li>
                      ))}
                    </ol>
                    <h4>Pasos de la IA</h4>
                    <AgentFlow runId={finding.runId} attack />
                    <h4>Análisis</h4>
                    {finding.analysis.scoreSummary ? <p>{finding.analysis.scoreSummary}</p> : null}
                    {finding.analysis.surface ? <p>{finding.analysis.surface}</p> : null}
                    {finding.analysis.failuresAmplifications.length > 0 ? (
                      <ul className="eval-vector">
                        {finding.analysis.failuresAmplifications.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    ) : null}
                    {finding.analysis.actionableRemediations.length > 0 ? (
                      <ul className="eval-vector">
                        {finding.analysis.actionableRemediations.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
