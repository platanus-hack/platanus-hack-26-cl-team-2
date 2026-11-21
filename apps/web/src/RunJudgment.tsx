import type { RunJudgment } from "./api";
import { AuditBlock, SEVERITY_LABEL } from "./RunOutcome";

type Props = {
  judgment: RunJudgment | null;
  loading: boolean;
  error: string | null;
  canRetry?: boolean;
  onRetry?: () => void;
  /** false: the server has no API key, so the retry (a model call) is disabled. */
  hasApiKey?: boolean;
};

export function RunJudgmentPanel({
  judgment,
  loading,
  error,
  canRetry,
  onRetry,
  hasApiKey = true,
}: Props) {
  if (loading) {
    return (
      <section className="panel">
        <h2>Evaluación posterior a la ejecución</h2>
        <p className="hint">El evaluador está revisando la interacción…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <h2>Evaluación posterior a la ejecución</h2>
        <p className="error">{error}</p>
        {canRetry && onRetry ? (
          <button
            type="button"
            className="btn"
            onClick={onRetry}
            disabled={!hasApiKey}
            title={hasApiKey ? undefined : "Falta la ANTHROPIC_API_KEY en el servidor"}
          >
            Reintentar evaluación (sin repetir ejecución)
          </button>
        ) : null}
      </section>
    );
  }

  if (!judgment) return null;

  return (
    <section className="panel judgment">
      <h2>Evaluación posterior a la ejecución</h2>
      <p className="hint">
        Evaluación con IA · {judgment.model} · riesgos de interacción que las evaluaciones individuales no detectan
      </p>

      <h3>Resumen</h3>
      <p className="judgment-body">{judgment.summary}</p>

      {judgment.decisions.length > 0 ? (
        <>
          <h3>Decisiones</h3>
          <ul className="judgment-list">
            {judgment.decisions.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </>
      ) : null}

      <h3>Riesgos y observaciones de gobernanza</h3>
      {judgment.risks.length === 0 ? (
        <p className="hint">No se detectaron riesgos derivados de las interacciones.</p>
      ) : (
        <ul className="risk-list">
          {judgment.risks.map((r) => (
            <li key={`${r.severity}-${r.title}`} data-severity={r.severity}>
              <strong>
                [{SEVERITY_LABEL[r.severity] ?? r.severity}] {r.title}
              </strong>
              <span>{r.why}</span>
            </li>
          ))}
        </ul>
      )}

      {judgment.governanceNotes ? (
        <>
          <h3>Notas de gobernanza</h3>
          <p className="judgment-body">{judgment.governanceNotes}</p>
        </>
      ) : null}

      <AuditBlock audit={judgment.audit} />

      <h3>Puntaje de manejo</h3>
      <div className="score-row">
        <span className="score-num">{judgment.score}</span>
        <span className="score-label">/ 10</span>
        <p className="score-why">{judgment.scoreRationale}</p>
      </div>
    </section>
  );
}
