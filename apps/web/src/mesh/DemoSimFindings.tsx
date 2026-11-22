import { useEffect, useState } from "react";
import {
  designDemoSimPatch,
  fetchDemoSimFindings,
  retestDemoSimFinding,
  type DemoSimEval,
  type DemoSimFinding,
  type DemoSimPatchPlan,
  type DemoSimRetestCompare,
} from "../api";
import { AgentFlow } from "../AgentFlow";
import "../evaluations-list.css";

/** One finished descriptive line, then the objective score underneath. */
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

type PatchState = {
  plan: DemoSimPatchPlan | null;
  compare: DemoSimRetestCompare | null;
  afterEval: DemoSimEval | null;
  retestRunId: string;
  busy: "" | "patch" | "retest";
  error: string;
};

const emptyPatch: PatchState = {
  plan: null,
  compare: null,
  afterEval: null,
  retestRunId: "",
  busy: "",
  error: "",
};

function FindingPatchPanel({ finding }: { finding: DemoSimFinding }) {
  const [state, setState] = useState<PatchState>(emptyPatch);

  useEffect(() => {
    setState(emptyPatch);
  }, [finding.id]);

  async function designPatch() {
    setState((prev) => ({ ...prev, busy: "patch", error: "", compare: null, afterEval: null, retestRunId: "" }));
    try {
      const { plan } = await designDemoSimPatch(finding.id);
      setState((prev) => ({ ...prev, plan, busy: "" }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        busy: "",
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  async function runRetest() {
    if (!state.plan?.patches.length) return;
    setState((prev) => ({ ...prev, busy: "retest", error: "" }));
    try {
      const result = await retestDemoSimFinding(finding.id, state.plan.patches);
      setState((prev) => ({
        ...prev,
        busy: "",
        compare: result.compare,
        afterEval: result.evaluation,
        retestRunId: result.runId,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        busy: "",
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  return (
    <div className="eval-patch">
      <h4>Parche mínimo</h4>
      <p className="hint">
        Identifica cómo se armó el vector, añade una instrucción clara de “no hacer eso” a los agentes que flaquearon, y re-ejecuta el mismo approach.
      </p>
      <div className="eval-patch-actions">
        <button type="button" className="btn ghost" disabled={Boolean(state.busy)} onClick={() => void designPatch()}>
          {state.busy === "patch" ? "Diseñando…" : "Diseñar parche mínimo"}
        </button>
        {state.plan?.patches.length ? (
          <button type="button" className="btn" disabled={Boolean(state.busy)} onClick={() => void runRetest()}>
            {state.busy === "retest" ? "Re-ejecutando…" : "Re-ejecutar con parche"}
          </button>
        ) : null}
      </div>
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.plan ? (
        <>
          <h4>Cómo se creó</h4>
          <p>{state.plan.howCreated}</p>
          <h4>Instrucciones extra</h4>
          <ul className="eval-vector eval-patch-list">
            {state.plan.patches.map((patch) => (
              <li key={patch.agentId}>
                <strong>{patch.agentName}</strong>
                <span className="eval-step-line">{patch.reason}</span>
                <span className="eval-patch-rule">{patch.instruction}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {state.compare ? (
        <div className="eval-compare">
          <h4>Comparación de valor</h4>
          <p className={state.compare.held ? "eval-compare-verdict is-held" : "eval-compare-verdict"}>
            {state.compare.held
              ? "El parche sostuvo: el objetivo ya no se cumple."
              : "El parche no bastó: el objetivo sigue cumpliéndose."}
          </p>
          <dl className="eval-compare-grid">
            <div>
              <dt>Antes</dt>
              <dd>
                {state.compare.before.score}/10 · {state.compare.before.empty ? "no cumplido" : "cumplido"}
              </dd>
            </div>
            <div>
              <dt>Después</dt>
              <dd>
                {state.compare.after.score}/10 · {state.compare.after.empty ? "no cumplido" : "cumplido"}
              </dd>
            </div>
            <div>
              <dt>Delta</dt>
              <dd>{state.compare.delta > 0 ? `+${state.compare.delta}` : state.compare.delta}</dd>
            </div>
          </dl>
          {state.compare.after.scoreSummary ? <p>{state.compare.after.scoreSummary}</p> : null}
          {state.afterEval && state.afterEval.failuresAmplifications.length > 0 ? (
            <>
              <h4>Puntaje por paso (retest)</h4>
              <AnalysisList items={state.afterEval.failuresAmplifications} />
            </>
          ) : null}
          {state.retestRunId ? (
            <>
              <h4>Pasos del retest</h4>
              <AgentFlow runId={state.retestRunId} attack={!state.compare.after.empty} />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** DEMO SIM cycles scored against their fixed objective. */
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
      <h2>Cumplimiento de objetivos</h2>
      <p className="hint">
        {findings.length} evaluación{findings.length === 1 ? "" : "es"} de DEMO SIM. Cada fila mide si el objetivo se cumplió y cuánto aportó cada paso.
      </p>
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
                  <span className={finding.analysis.empty ? "verdict-warn" : "verdict-ok"}>
                    {finding.analysis.empty ? "Objetivo no cumplido" : "Objetivo cumplido"}
                  </span>
                </button>
              </h3>
              <div hidden={!open}>
                {open ? (
                  <div className="eval-expanded">
                    <h4>Objetivo</h4>
                    <p>{finding.prompt}</p>
                    {finding.analysis.scoreSummary ? (
                      <>
                        <h4>Resumen</h4>
                        <p>{finding.analysis.scoreSummary}</p>
                      </>
                    ) : null}
                    <h4>Puntaje por paso</h4>
                    {finding.analysis.failuresAmplifications.length > 0 ? (
                      <AnalysisList items={finding.analysis.failuresAmplifications} />
                    ) : (
                      <>
                        {finding.analysis.surface ? <p>{finding.analysis.surface}</p> : null}
                      </>
                    )}
                    {finding.analysis.actionableRemediations.length > 0 ? (
                      <>
                        <h4>Factores de resistencia</h4>
                        <ul className="eval-vector">
                          {finding.analysis.actionableRemediations.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </>
                    ) : null}
                    <details className="eval-deep">
                      <summary>Approach e interacción</summary>
                      {finding.analysis.approach ? (
                        <>
                          <h4>Intervención del controlador</h4>
                          <p>{finding.analysis.approach}</p>
                        </>
                      ) : null}
                      <h4>Cadena observada</h4>
                      <ol className="eval-vector">
                        {finding.vector.map((step, index) => (
                          <li key={`${finding.id}-${index}`}>
                            <strong>{step.title}</strong>
                            {step.detail}
                          </li>
                        ))}
                      </ol>
                    </details>
                    <h4>Pasos de la simulación</h4>
                    <AgentFlow runId={finding.runId} attack={!finding.analysis.empty} />
                    {!finding.analysis.empty ? <FindingPatchPanel finding={finding} /> : null}
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
