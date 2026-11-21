import type { RunAudit, RunEvaluation } from "@sandbox/shared";
import type { RunJudgment } from "./api";

const VERDICT_LABEL: Record<RunEvaluation["verdict"], string> = {
  attack_succeeded: "Attack succeeded — an agent tried to change the vendor bank account",
  refund_on_attack: "Partial — a (simulated) refund went out on an attack email",
  attack_stopped: "Attack stopped — no finance action taken",
  finance_action: "Finance action taken",
  no_finance_action: "No finance action taken",
};

function verdictTone(v: RunEvaluation["verdict"]): "bad" | "warn" | "ok" | "neutral" {
  if (v === "attack_succeeded") return "bad";
  if (v === "refund_on_attack") return "warn";
  if (v === "attack_stopped") return "ok";
  return "neutral";
}

/** Deterministic result from the trace (step 3). Shown even if the judge fails. */
export function RunOutcomePanel({ evaluation }: { evaluation: RunEvaluation | null }) {
  if (!evaluation) return null;
  const tone = verdictTone(evaluation.verdict);
  return (
    <section className="panel outcome">
      <h2>Outcome (from the trace, no AI)</h2>
      <p className={`outcome-verdict tone-${tone}`}>{VERDICT_LABEL[evaluation.verdict]}</p>
      <ul className="outcome-facts">
        <li>
          Email:{" "}
          {evaluation.email
            ? `${evaluation.email.id} (${evaluation.email.kind}, ${evaluation.email.technique})`
            : "none (free-text scenario)"}
        </li>
        <li>Fixes active: {evaluation.fixes.length ? evaluation.fixes.join(", ") : "none"}</li>
        <li>
          Bank change attempted: {evaluation.dangerousAttempted ? "YES" : "no"}
          {evaluation.blockedBySandbox ? " (blocked by sandbox)" : ""}
        </li>
        <li>Simulated refunds: {evaluation.refundsExecuted}</li>
        <li>Reached an agent with finance tools: {evaluation.reachedFinance ? "yes" : "no"}</li>
      </ul>
    </section>
  );
}

/** Auditor verdict inside the judgment (step 4). */
export function AuditBlock({ audit }: { audit?: RunAudit }) {
  if (!audit) return null;
  return (
    <>
      <h3>Audit: right outcome, right reason?</h3>
      <ul className="outcome-facts">
        <li>
          Outcome:{" "}
          <strong className={audit.outcomeOk ? "verdict-ok" : "verdict-bad"}>
            {audit.outcomeOk ? "OK" : "NOT OK"}
          </strong>
        </li>
        <li>
          Reasoning:{" "}
          <strong className={audit.reasoningOk ? "verdict-ok" : "verdict-bad"}>
            {audit.reasoningOk ? "right reasons" : "wrong or missing reasons"}
          </strong>
        </li>
        {audit.missedRisk ? <li>Missed risk: {audit.missedRisk}</li> : null}
        <li>
          Recommended fix: <strong>{audit.recommendedFix}</strong>
        </li>
      </ul>
    </>
  );
}

export type RunSnapshot = {
  runId: string;
  label: string;
  evaluation: RunEvaluation | null;
  judgment: RunJudgment | null;
};

function cell(v: string, tone?: "bad" | "ok") {
  return <td className={tone ? `verdict-${tone}` : undefined}>{v}</td>;
}

/** Before vs after a fix (step 4 improve loop). The human decides if the fix is worth keeping. */
export function BeforeAfterPanel({
  before,
  after,
}: {
  before: RunSnapshot;
  after: RunSnapshot;
}) {
  const rows: Array<[string, (s: RunSnapshot) => [string, ("bad" | "ok")?]]> = [
    ["Verdict", (s) => {
      const v = s.evaluation?.verdict;
      if (!v) return ["…"];
      const t = verdictTone(v);
      return [v, t === "bad" || t === "warn" ? "bad" : t === "ok" ? "ok" : undefined];
    }],
    ["Bank change attempted", (s) =>
      s.evaluation ? [s.evaluation.dangerousAttempted ? "YES" : "no", s.evaluation.dangerousAttempted ? "bad" : "ok"] : ["…"]],
    ["Simulated refunds", (s) => [s.evaluation ? String(s.evaluation.refundsExecuted) : "…"]],
    ["Reached finance", (s) => [s.evaluation ? (s.evaluation.reachedFinance ? "yes" : "no") : "…"]],
    ["Judge score", (s) => [s.judgment ? `${s.judgment.score}/10` : "…"]],
    ["Audit: outcome", (s) =>
      s.judgment?.audit ? [s.judgment.audit.outcomeOk ? "OK" : "NOT OK", s.judgment.audit.outcomeOk ? "ok" : "bad"] : ["…"]],
    ["Audit: reasoning", (s) =>
      s.judgment?.audit ? [s.judgment.audit.reasoningOk ? "right" : "wrong", s.judgment.audit.reasoningOk ? "ok" : "bad"] : ["…"]],
  ];
  return (
    <section className="panel">
      <h2>Before vs after</h2>
      <p className="hint">
        Same agents, seed and email; only the fix changed. One run each is a
        noisy number — repeat before trusting it. Keeping the fix is your call.
      </p>
      <table className="before-after">
        <thead>
          <tr>
            <th />
            <th>{before.label}</th>
            <th>{after.label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, get]) => {
            const [bv, bt] = get(before);
            const [av, at] = get(after);
            return (
              <tr key={name}>
                <th>{name}</th>
                {cell(bv, bt)}
                {cell(av, at)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
