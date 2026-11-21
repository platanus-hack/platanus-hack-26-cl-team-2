import type { TraceEvent } from "@sandbox/shared";
import { emailKindLabel, SENDER_VERDICT_LABEL } from "./RunOutcome";

type Props = {
  events: TraceEvent[];
  agentIndex: Map<string, number>;
};

/** Display labels for the event types (the type ids themselves are unchanged). */
const TYPE_LABEL: Record<TraceEvent["type"], string> = {
  "run.started": "inicio de la ejecución",
  "run.completed": "ejecución completada",
  "run.failed": "ejecución fallida",
  "agent.turn.started": "turno",
  "agent.thought": "razonamiento",
  "agent.tool_call": "llamada a herramienta",
  "agent.tool_result": "resultado de herramienta",
  "agent.message_sent": "mensaje enviado",
  "agent.message_received": "mensaje recibido",
  "agent.done": "agente terminó",
  "agent.woken": "agente reactivado por correo nuevo",
  "agent.error": "error del agente",
  "sandbox.tool_attempt": "intento de herramienta de finanzas",
};

function kindOf(event: TraceEvent): string {
  if (event.type === "sandbox.tool_attempt") {
    return event.payload.blocked ? "error" : "tool";
  }
  return kindOfType(event.type);
}

function kindOfType(type: TraceEvent["type"]): string {
  if (type.includes("thought")) return "thought";
  if (type.includes("message")) return "message";
  if (type.includes("tool")) return "tool";
  if (type.includes("done") || type.startsWith("run."))
    return type.includes("failed")
      ? "error"
      : type.includes("done") || type.includes("completed")
        ? "done"
        : "run";
  if (type.includes("error") || type.includes("failed")) return "error";
  return "run";
}

export function summarize(event: TraceEvent): string {
  const p = event.payload;
  switch (event.type) {
    case "run.started": {
      const base = `modelo=${String(p.model)} · inicial=${String(p.seedAgentId ?? "?")} · n=${String(p.participantCount ?? "?")} · máximo de turnos=${String(p.maxTurnsPerAgent)}`;
      const email = p.email as
        | { id?: string; kind?: string; from?: string | null; senderCheck?: { verdict?: string } | null }
        | null
        | undefined;
      if (!email) return base;
      const verdict = email.senderCheck?.verdict;
      const check = email.senderCheck
        ? ` · verificación del remitente: ${SENDER_VERDICT_LABEL[verdict as keyof typeof SENDER_VERDICT_LABEL] ?? verdict}`
        : "";
      return `${base} · correo=${email.id} (${emailKindLabel(email.kind ?? "?")}) de ${email.from ?? "?"}${check}`;
    }
    case "run.completed":
      return "Todos los agentes finalizaron.";
    case "run.failed":
      return String(p.error ?? "error desconocido");
    case "agent.turn.started":
      return `turno ${String(p.turn)}/${String(p.maxTurns)}${p.isSeed ? " · agente inicial" : ""}`;
    case "agent.thought":
      return String(p.text ?? "");
    case "agent.tool_call":
      return `${String(p.name)} ${JSON.stringify(p.input)}`;
    case "agent.tool_result":
      return `${String(p.name)} → ${JSON.stringify(p.result)}`;
    case "agent.message_sent":
    case "agent.message_received": {
      const msg = p.message as {
        fromAgentId?: string;
        toAgentId?: string;
        body?: string;
      };
      return `${msg.fromAgentId} → ${msg.toAgentId}: ${msg.body}`;
    }
    case "agent.done":
      return String(p.summary ?? "");
    case "agent.woken":
      return `se reactiva · ${String(p.unread)} mensaje(s) sin leer tras terminar`;
    case "agent.error":
      return String(p.error ?? "");
    case "sandbox.tool_attempt":
      return `${p.held ? "RETENIDO PARA APROBACIÓN HUMANA" : p.blocked ? "BLOQUEADO" : "simulado"} · ${String(p.tool)} ${JSON.stringify(p.args)}${p.dangerous ? " · intento de herramienta peligrosa" : ""}`;
    default:
      return JSON.stringify(p);
  }
}

export function Timeline({ events, agentIndex }: Props) {
  if (events.length === 0) {
    return (
      <p className="empty">
        Aún no hay eventos. Selecciona agentes, define el agente inicial y el escenario, e inicia la ejecución.
      </p>
    );
  }

  return (
    <div className="timeline">
      {events.map((event) => {
        const idx = event.agentId ? agentIndex.get(event.agentId) : undefined;
        return (
          <article
            key={event.id}
            className="event"
            data-kind={kindOf(event)}
          >
            <div className="meta">
              {new Date(event.ts).toLocaleTimeString()}
            </div>
            <div>
              <div className="type" title={event.type}>
                {idx != null ? (
                  <span className={`agent-chip n${idx % 6}`}>#{idx + 1}</span>
                ) : null}
                {TYPE_LABEL[event.type] ?? event.type}
              </div>
              <div className="body">{summarize(event)}</div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
