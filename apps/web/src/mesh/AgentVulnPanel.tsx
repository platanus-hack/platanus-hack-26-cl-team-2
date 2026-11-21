import { useEffect, useState } from "react";
import {
  VULN_CATEGORIES,
  type AgentVulnAssessment,
  type VulnCategory,
} from "@sandbox/shared";
import { getVulnAssessment } from "../api";

const CATEGORY_LABELS: Record<VulnCategory, string> = {
  instruction_override: "Override de instrucciones",
  indirect_injection: "Inyección indirecta",
  tool_misuse: "Mal uso de tools",
  data_exfiltration: "Exfiltración de datos",
  social_engineering: "Ingeniería social",
  secret_handling: "Manejo de secretos",
};

function scoreTone(score: number): string {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

export function AgentVulnPanel({
  agentId,
  onOpenEvals,
}: {
  agentId: string;
  onOpenEvals: (agentId: string) => void;
}) {
  const [assessment, setAssessment] = useState<AgentVulnAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setAssessment(null);
    void getVulnAssessment(agentId)
      .then((data) => {
        if (!cancelled) setAssessment(data);
      })
      .catch((failure) => {
        if (!cancelled) {
          setError(
            failure instanceof Error
              ? failure.message
              : "No se pudo cargar el assessment",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  return (
    <section className="mesh-vuln">
      <h3>Vulnerabilidad (evals)</h3>
      {loading ? (
        <p className="mesh-vuln-muted">Cargando assessment…</p>
      ) : assessment ? (
        <>
          <p className="mesh-vuln-summary">{assessment.summary}</p>
          <ul className="mesh-vuln-scores">
            {VULN_CATEGORIES.map((category) => {
              const score = assessment.scores[category];
              const note = assessment.categoryNotes[category];
              return (
                <li key={category} className={`tone-${scoreTone(score)}`}>
                  <div>
                    <span>{CATEGORY_LABELS[category]}</span>
                    {note ? <small>{note}</small> : null}
                  </div>
                  <strong aria-label={`Score ${score} de 100`}>{score}</strong>
                </li>
              );
            })}
          </ul>
          <p className="mesh-vuln-meta">
            Actualizado{" "}
            {new Date(assessment.updatedAt).toLocaleString("es-CL")}
            {assessment.runIds.length
              ? ` · ${assessment.runIds.length} runs`
              : ""}
          </p>
        </>
      ) : (
        <p className="mesh-vuln-muted">
          Aún no se generan scores de vulnerabilidad para este agente.
        </p>
      )}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="btn"
        onClick={() => onOpenEvals(agentId)}
      >
        Ir a evals →
      </button>
    </section>
  );
}
