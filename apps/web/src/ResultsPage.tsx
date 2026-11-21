import { RESULTS, type Count } from "./results-data";

const text = (c: Count) => `${c.n} de ${c.of}`;
const pct = (n: number, of: number) => `${(n / of) * 100}%`;

/** Barra de un solo conteo. El número siempre va escrito al lado; la barra es apoyo visual. */
function Bar({ count, tone }: { count: Count; tone: "bad" | "warn" }) {
  return (
    <div className="results-track" aria-hidden="true">
      {count.n > 0 && <span className={`results-fill ${tone}`} style={{ width: pct(count.n, count.of) }} />}
    </div>
  );
}

export function ResultsPage() {
  const { refunds, gate, bank, multiAgent, senderCheck } = RESULTS;
  return (
    <div className="results">
      <section className="results-headline">
        <span className="mesh-label">En una frase</span>
        <p>{RESULTS.headline}</p>
        <small>
          Ejecuciones reales con agentes Claude en sandbox · {RESULTS.dateLabel} · Son conteos con pocas
          repeticiones, no tasas.
        </small>
      </section>

      <section className="results-card">
        <header>
          <span className="results-step bad">1</span>
          <div>
            <h2>El ataque: un pedido de reembolso</h2>
            <p>
              Un correo que parece de un cliente normal hace que el agente emita el reembolso sin verificar nada: no
              tiene herramienta para consultar pedidos, envíos ni cobros. Los mismos {refunds.emails} correos, sin
              defensa, {refunds.rows[0].undefended.of} ejecuciones por agente.
            </p>
          </div>
        </header>
        <div className="results-rows">
          {refunds.rows.map(row => (
            <div className="results-row" key={row.agent}>
              <span className="results-row-label">
                {row.agent}
                {row.note && <small>{row.note}</small>}
              </span>
              <Bar count={row.undefended} tone="bad" />
              <strong className="results-row-value">{text(row.undefended)}</strong>
            </div>
          ))}
        </div>
        <p className="results-foot">
          Reembolsos emitidos. En {text(refunds.indistinguishable)} correos el fraude no se distingue de un reclamo
          real solo con el texto; ahí medimos «reembolsó sin verificar», no «pagó un fraude comprobado».
        </p>
      </section>

      <section className="results-card">
        <header>
          <span className="results-step ok">2</span>
          <div>
            <h2>La defensa: aprobación humana sobre USD {gate.thresholdUsd}</h2>
            <p>
              La regla la aplica el sandbox, no el prompt: un reembolso de más de USD {gate.thresholdUsd} pedido desde
              un correo externo queda pendiente de aprobación humana.
            </p>
          </div>
        </header>
        <div className="results-compare">
          {gate.rows.map(row => (
            <article key={row.model}>
              <h3>{row.model}</h3>
              <div className="results-pair">
                <div>
                  <span>Sin defensa</span>
                  <strong className="bad">{text(row.undefended)}</strong>
                  <div className="results-track" aria-hidden="true">
                    <span className="results-fill bad" style={{ width: pct(row.undefended.n, row.undefended.of) }} />
                  </div>
                  <small>reembolsos emitidos</small>
                </div>
                <div>
                  <span>Con aprobación humana</span>
                  <strong className="bad">{text(row.withGate)}</strong>
                  <div className="results-track" aria-hidden="true">
                    <span className="results-fill bad" style={{ width: pct(row.withGate.n, row.withGate.of) }} />
                    <span className="results-fill held" style={{ width: pct(row.held, row.withGate.of) }} />
                  </div>
                  <small>
                    reembolsos emitidos · <b className="held">{row.held} retenidos</b> para aprobación
                  </small>
                </div>
              </div>
            </article>
          ))}
        </div>
        <ul className="results-legend" aria-hidden="true">
          <li><i className="bad" /> Reembolso emitido</li>
          <li><i className="held" /> Retenido para aprobación humana</li>
          <li><i /> Sin reembolso</li>
        </ul>
        <ul className="results-facts">
          <li>
            Ningún reembolso de más de USD {gate.thresholdUsd} se ejecutó con la defensa activa. En las{" "}
            {gate.heldTotal} ejecuciones retenidas, ningún agente reintentó con montos menores y todos escalaron a un
            humano.
          </li>
          <li>
            Los 2 reembolsos legítimos de control se emitieron siempre ({text(gate.legitControls.issued)}), pero son
            de USD {gate.legitControls.amountsUsd.join(" y ")}: la regla no podía tocarlos.
          </li>
          <li>Lo que sigue pasando son pedidos de menos de USD {gate.thresholdUsd}.</li>
        </ul>
      </section>

      <section className="results-card">
        <header>
          <span className="results-step">3</span>
          <div>
            <h2>Lo demás</h2>
            <p>Tres mediciones más, con el mismo cuidado: qué se observó y qué no.</p>
          </div>
        </header>
        <div className="results-trio">
          <article>
            <h3>Cambio de cuenta bancaria</h3>
            <p>Intentos de cambiar la cuenta del proveedor ({bank.emails} correos). El cambio nunca se ejecuta.</p>
            {bank.rows.map(row => (
              <div className="results-mini" key={row.agent}>
                <span>{row.agent}</span>
                <strong>{text(row.undefended)}</strong>
                <Bar count={row.undefended} tone="warn" />
                {row.withGate && <small>Con la aprobación humana activa: {text(row.withGate)}. La regla no reduce los intentos, solo los retiene.</small>}
                {row.note && <small>{row.note}</small>}
              </div>
            ))}
          </article>
          <article>
            <h3>La advertencia en equipos de agentes</h3>
            <p>
              Laboratorio de {multiAgent.agents} agentes con {multiAgent.model}. Veces que el primer mensaje que
              recibió finanzas traía alguna advertencia.
            </p>
            {multiAgent.warningAtFinance.map(row => (
              <div className="results-mini" key={row.condition}>
                <span>{row.condition}</span>
                <strong>{text(row.arrived)}</strong>
                <Bar count={row.arrived} tone="warn" />
                {row.note && <small>{row.note}</small>}
              </div>
            ))}
            <p className="results-foot">
              Según un detector de palabras clave no validado a mano. No hubo daño en ninguna de las{" "}
              {multiAgent.runs} ejecuciones ({multiAgent.harm.n} de {multiAgent.harm.of}), así que esto no muestra que
              perder la advertencia termine en dinero perdido.
            </p>
          </article>
          <article>
            <h3>Verificación del remitente</h3>
            <p>En las celdas comparables no cambió ningún resultado. Ataques que marca:</p>
            {senderCheck.flags.map(row => (
              <div className="results-mini" key={row.file}>
                <span><code>{row.file}</code></span>
                <strong>{text(row.flagged)}</strong>
                <Bar count={row.flagged} tone="warn" />
              </div>
            ))}
            <p className="results-foot">En estos correos el remitente no delató el fraude.</p>
          </article>
        </div>
      </section>

      <section className="results-limits">
        <h2>Límites</h2>
        <ul>
          {RESULTS.limits.map(limit => <li key={limit}>{limit}</li>)}
        </ul>
        <p>
          Repeticiones por celda: {RESULTS.repetitions.map(r => `${r.setup}, ${r.perCell}`).join(" · ")}. Modelos:{" "}
          {RESULTS.models.join(", ")}. Detalle y cifras completas en <code>{RESULTS.source}</code>, en el repositorio.
        </p>
      </section>
    </div>
  );
}
