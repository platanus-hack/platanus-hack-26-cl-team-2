import type { EmailScenarioKind, RunAudit, RunEvaluation, SenderCheck } from "@sandbox/shared";
import type { RunJudgment } from "./api";

/** Display labels only: ids and enum values sent to the API stay as they are. */
export const FIX_LABEL_ES: Record<string, string> = {
  sender_check: "verificación del remitente",
  provenance_tag: "etiqueta de procedencia",
  approval_gate: "aprobación humana por procedencia",
  none: "ninguna",
};

export function fixLabel(fix: string): string {
  return FIX_LABEL_ES[fix] ?? fix;
}

export const EMAIL_KIND_LABEL: Record<EmailScenarioKind, string> = {
  attack: "ataque",
  benign: "legítimo",
  real_email: "correo real",
};

export function emailKindLabel(kind: string): string {
  return EMAIL_KIND_LABEL[kind as EmailScenarioKind] ?? kind;
}

export const SENDER_VERDICT_LABEL: Record<SenderCheck["verdict"], string> = {
  OK: "OK",
  SUSPICIOUS: "SOSPECHOSO",
  UNKNOWN: "DESCONOCIDO",
};

export const SEVERITY_LABEL: Record<"high" | "medium" | "low", string> = {
  high: "alta",
  medium: "media",
  low: "baja",
};

const VERDICT_LABEL: Record<RunEvaluation["verdict"], string> = {
  attack_succeeded: "Ataque exitoso: un agente intentó cambiar la cuenta bancaria del proveedor",
  refund_on_attack:
    "Fraude de reembolso ejecutado: se emitió un reembolso simulado por un correo de ataque",
  attack_stopped: "Ataque detenido: no hubo acciones financieras",
  finance_action: "Acción financiera ejecutada",
  no_finance_action: "Sin acciones financieras",
};

type Tone = "bad" | "warn" | "ok" | "neutral";

function verdictTone(v: RunEvaluation["verdict"]): Tone {
  if (v === "attack_succeeded" || v === "refund_on_attack") return "bad";
  if (v === "attack_stopped") return "ok";
  return "neutral";
}

/**
 * Label and tone for a run. The verdict id is unchanged; only the wording follows what the
 * approval gate did (a held bank change is not "blocked by the sandbox", a held refund is not
 * "no finance actions").
 */
export function verdictDisplay(e: RunEvaluation): { label: string; tone: Tone } {
  if (e.verdict === "attack_succeeded" && e.dangerousHeld) {
    return { label: "Intento de cambio bancario retenido para aprobación humana", tone: "warn" };
  }
  if (e.verdict === "attack_stopped" && e.heldForApproval > 0) {
    return {
      label: "Ataque contenido: la acción quedó retenida para aprobación humana",
      tone: "ok",
    };
  }
  return { label: VERDICT_LABEL[e.verdict], tone: verdictTone(e.verdict) };
}

/** Deterministic result from the trace (step 3). Shown even if the judge fails. */
export function RunOutcomePanel({ evaluation }: { evaluation: RunEvaluation | null }) {
  if (!evaluation) return null;
  const { label, tone } = verdictDisplay(evaluation);
  return (
    <section className="panel outcome">
      <h2>Resultado (desde la traza, sin IA)</h2>
      <p className={`outcome-verdict tone-${tone}`}>{label}</p>
      <ul className="outcome-facts">
        <li>
          Correo:{" "}
          {evaluation.email
            ? `${evaluation.email.id} (${emailKindLabel(evaluation.email.kind)}, ${evaluation.email.technique})`
            : "ninguno (escenario de texto libre)"}
        </li>
        <li>Mitigaciones activas: {evaluation.fixes.length ? evaluation.fixes.map(fixLabel).join(", ") : "ninguna"}</li>
        <li>
          Intento de cambio bancario: {evaluation.dangerousAttempted ? "SÍ" : "no"}
          {evaluation.dangerousHeld
            ? " (retenido para aprobación humana, no ejecutado)"
            : evaluation.blockedBySandbox
              ? " (bloqueado por el entorno de pruebas)"
              : ""}
        </li>
        <li>Reembolsos simulados: {evaluation.refundsExecuted}</li>
        {evaluation.heldForApproval ? (
          <li>Retenido para aprobación humana: {evaluation.heldForApproval} (no ejecutado)</li>
        ) : null}
        <li>Llegó a un agente con herramientas financieras: {evaluation.reachedFinance ? "sí" : "no"}</li>
      </ul>
    </section>
  );
}

/** Auditor verdict inside the judgment (step 4). */
export function AuditBlock({ audit }: { audit?: RunAudit }) {
  if (!audit) return null;
  return (
    <>
      <h3>Auditoría: ¿resultado y razonamiento correctos?</h3>
      <ul className="outcome-facts">
        <li>
          Resultado:{" "}
          <strong className={audit.outcomeOk ? "verdict-ok" : "verdict-bad"}>
            {audit.outcomeOk ? "OK" : "INCORRECTO"}
          </strong>
        </li>
        <li>
          Razonamiento:{" "}
          <strong className={audit.reasoningOk ? "verdict-ok" : "verdict-bad"}>
            {audit.reasoningOk ? "razones correctas" : "razones incorrectas o ausentes"}
          </strong>
        </li>
        {audit.missedRisk ? <li>Riesgo omitido: {audit.missedRisk}</li> : null}
        <li>
          Mitigación recomendada: <strong>{fixLabel(audit.recommendedFix)}</strong>
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
    ["Veredicto", (s) => {
      if (!s.evaluation) return ["…"];
      const { label, tone: t } = verdictDisplay(s.evaluation);
      return [label, t === "bad" || t === "warn" ? "bad" : t === "ok" ? "ok" : undefined];
    }],
    ["Intento de cambio bancario", (s) =>
      s.evaluation ? [s.evaluation.dangerousAttempted ? "SÍ" : "no", s.evaluation.dangerousAttempted ? "bad" : "ok"] : ["…"]],
    ["Reembolsos simulados", (s) => [s.evaluation ? String(s.evaluation.refundsExecuted) : "…"]],
    ["Retenido para aprobación", (s) => [s.evaluation ? String(s.evaluation.heldForApproval ?? 0) : "…"]],
    ["Llegó a finanzas", (s) => [s.evaluation ? (s.evaluation.reachedFinance ? "sí" : "no") : "…"]],
    ["Puntaje del evaluador", (s) => [s.judgment ? `${s.judgment.score}/10` : "…"]],
    ["Auditoría: resultado", (s) =>
      s.judgment?.audit ? [s.judgment.audit.outcomeOk ? "OK" : "INCORRECTO", s.judgment.audit.outcomeOk ? "ok" : "bad"] : ["…"]],
    ["Auditoría: razonamiento", (s) =>
      s.judgment?.audit ? [s.judgment.audit.reasoningOk ? "correcto" : "incorrecto", s.judgment.audit.reasoningOk ? "ok" : "bad"] : ["…"]],
  ];
  return (
    <section className="panel">
      <h2>Antes y después</h2>
      <p className="hint">
        Mismos agentes, agente inicial y correo; solo cambia la mitigación. Una ejecución aislada no es concluyente: repite las pruebas antes de decidir si conservarla.
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
