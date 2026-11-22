import { useEffect, useState } from "react";
import { fetchDemoSimFindings, type DemoSimFinding } from "../api";
import { AgentFlow } from "../AgentFlow";
import "../evaluations-list.css";

/** One finished descriptive line, then the risk sentence underneath. */
export function splitAnalysis(item: string): { line: string; risk: string; label: string } {
  const match = item.match(/^([\s\S]*?)\s+(Riesgo|Objetivo)\s*:\s*([\s\S]*)$/i);
  if (!match?.[1]?.trim()) return { line: item.trim(), risk: "", label: "" };
  const label = /^objetivo$/i.test(match[2] ?? "") ? "OBJETIVO" : "RIESGO";
  return { line: match[1].trim(), risk: match[3].trim(), label };
}

export function AnalysisList({ items }: { items: string[] }) {
  return (
    <ol className="eval-vector">
      {items.map((item) => {
        const { line, risk, label } = splitAnalysis(item);
        const clear = /^no\b/i.test(risk);
        return (
          <li key={item}>
            <span className="eval-step-line">{line}</span>
            {risk ? <span className={clear ? "eval-step-risk is-clear" : "eval-step-risk"}>{label}: {risk}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

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
      <p className="hint">{findings.length} evaluación{findings.length === 1 ? "" : "es"} de DEMO SIM. Cada fila trae el vector de la corrida, los pasos de la IA y el análisis.</p>
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
                  <span className={finding.analysis.empty ? "verdict-warn" : "verdict-bad"}>
                    {finding.analysis.empty ? "Sin vector" : "Vector encontrado"}
                  </span>
                </button>
              </h3>
              <div hidden={!open}>
                {open ? (
                  <div className="eval-expanded">
                    <h4>Análisis</h4>
                    {finding.analysis.failuresAmplifications.length > 0 ? (
                      <AnalysisList items={finding.analysis.failuresAmplifications} />
                    ) : (
                      <>
                        {finding.analysis.scoreSummary ? <p>{finding.analysis.scoreSummary}</p> : null}
                        {finding.analysis.surface ? <p>{finding.analysis.surface}</p> : null}
                        {finding.analysis.actionableRemediations.length > 0 ? (
                          <ul className="eval-vector">
                            {finding.analysis.actionableRemediations.map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        ) : null}
                      </>
                    )}
                    <details className="eval-deep">
                      <summary>Análisis a profundidad</summary>
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
                    </details>
                    <h4>Pasos de la IA</h4>
                    <AgentFlow runId={finding.runId} attack />
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
