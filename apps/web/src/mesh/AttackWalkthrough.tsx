import { useState } from "react";
import { EntityGlyph } from "./EntityGlyph";
import "../evaluations-list.css";

export function SimulationsPage() {
  const [expanded, setExpanded] = useState(false);
  return <section className="panel" aria-label="Lista de simulaciones">
    <h2>Simulaciones disponibles</h2>
    <p className="hint">1 simulación ilustrativa. Despliega el caso para explorar su recorrido y comparar el efecto de la aprobación humana. No ejecuta agentes ni consume créditos.</p>
    <div className="eval-list"><article className={expanded ? "eval-item expanded" : "eval-item"}>
      <h3 className="eval-row-heading"><button type="button" className="eval-row" aria-expanded={expanded} aria-controls="simulation-bank-change" onClick={() => setExpanded(value => !value)}>
        <span className="eval-chevron" aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        <span className="eval-row-title">Cambio bancario mediante delegación entre agentes<small>Ticket → Soporte → Operaciones → Finanzas → ERP</small></span>
        <span className="mesh-pill">Ilustrativa</span>
      </button></h3>
      <div id="simulation-bank-change" hidden={!expanded}><div className="eval-expanded"><AttackWalkthrough /></div></div>
    </article></div>
  </section>;
}

/** The illustrative path, in order. Scripted: nothing here runs a model or measures anything. */
const PATH = [
  { name: "Ticket", kind: "external", caption: "Un ticket externo pide cambiar datos bancarios." },
  { name: "Soporte", kind: "agent", caption: "Soporte lo reenvía sin decir que vino de afuera." },
  { name: "Operaciones", kind: "agent", caption: "Operaciones lo pasa como un pedido interno." },
  { name: "Finanzas", kind: "agent", caption: "Finanzas lo recibe con aparente autoridad interna." },
  { name: "ERP", kind: "tool", caption: "" },
];
const LAST = PATH.length;

export function AttackWalkthrough() {
  const [step, setStep] = useState(0);
  const [approval, setApproval] = useState(false);

  const caption =
    step === 0
      ? "Presiona Siguiente para seguir el ataque paso a paso."
      : step < LAST
        ? PATH[step - 1].caption
        : approval
          ? "La aprobación humana detiene el cambio de cuenta."
          : "Sin controles, el ERP aceptaría el cambio. En MESH siempre se bloquea y queda registrado.";

  return (
    <section className="mesh-walk" aria-label="Recorrido del ataque">
      <header>
        <h2>Recorrido del ataque</h2>
        <span>Ilustrativo · no es una evaluación</span>
      </header>
      <ol className="mesh-walk-path">
        {PATH.map((node, index) => {
          const reached = index < step;
          const end = index === LAST - 1 && step === LAST;
          const state = end ? (approval ? "safe" : "hit") : reached ? "hit" : "";
          return (
            <li key={node.name} className={state}>
              {index > 0 && <span className={`mesh-walk-line ${reached ? "hit" : ""}`} aria-hidden="true" />}
              <button
                type="button"
                className="mesh-walk-node"
                aria-label={`Paso ${index + 1}: ${node.name}`}
                aria-current={index === step - 1 ? "step" : undefined}
                onClick={() => setStep(index + 1)}
              >
                <svg viewBox="-24 -24 48 48" aria-hidden="true">
                  <EntityGlyph kind={node.kind} />
                </svg>
              </button>
              <span className="mesh-walk-name">{node.name}</span>
            </li>
          );
        })}
      </ol>
      <p className="mesh-walk-caption" aria-live="polite">{caption}</p>
      <footer>
        <label>
          <input
            type="checkbox"
            checked={approval}
            onChange={(event) => {
              setApproval(event.target.checked);
              setStep(0);
            }}
          />{" "}
          Aprobación humana
        </label>
        <button type="button" className="btn ghost" onClick={() => setStep(0)}>
          Reiniciar
        </button>
        <button type="button" className="btn" disabled={step === LAST} onClick={() => setStep(step + 1)}>
          {step === LAST ? "Listo" : "Siguiente →"}
        </button>
      </footer>
    </section>
  );
}
