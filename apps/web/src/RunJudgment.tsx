import type { RunJudgment } from "./api";

type Props = {
  judgment: RunJudgment | null;
  loading: boolean;
  error: string | null;
  canRetry?: boolean;
  onRetry?: () => void;
};

export function RunJudgmentPanel({
  judgment,
  loading,
  error,
  canRetry,
  onRetry,
}: Props) {
  if (loading) {
    return (
      <section className="panel">
        <h2>Post-run judgment</h2>
        <p className="hint">Haiku is judging the interaction (cheap pass)…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <h2>Post-run judgment</h2>
        <p className="error">{error}</p>
        {canRetry && onRetry ? (
          <button type="button" className="btn" onClick={onRetry}>
            Retry judge (no re-run)
          </button>
        ) : null}
      </section>
    );
  }

  if (!judgment) return null;

  return (
    <section className="panel judgment">
      <h2>Post-run judgment</h2>
      <p className="hint">
        LLM-as-judge · {judgment.model} · interaction risks that single-agent
        evals miss
      </p>

      <h3>Summary</h3>
      <p className="judgment-body">{judgment.summary}</p>

      {judgment.decisions.length > 0 ? (
        <>
          <h3>Decisions</h3>
          <ul className="judgment-list">
            {judgment.decisions.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </>
      ) : null}

      <h3>Risks & governance insights</h3>
      {judgment.risks.length === 0 ? (
        <p className="hint">No interaction-emergent risks flagged.</p>
      ) : (
        <ul className="risk-list">
          {judgment.risks.map((r) => (
            <li key={`${r.severity}-${r.title}`} data-severity={r.severity}>
              <strong>
                [{r.severity}] {r.title}
              </strong>
              <span>{r.why}</span>
            </li>
          ))}
        </ul>
      )}

      {judgment.governanceNotes ? (
        <>
          <h3>Governance notes</h3>
          <p className="judgment-body">{judgment.governanceNotes}</p>
        </>
      ) : null}

      <h3>Handling score</h3>
      <div className="score-row">
        <span className="score-num">{judgment.score}</span>
        <span className="score-label">/ 10</span>
        <p className="score-why">{judgment.scoreRationale}</p>
      </div>
    </section>
  );
}
