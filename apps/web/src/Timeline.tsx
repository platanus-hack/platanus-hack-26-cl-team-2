import type { TraceEvent } from "@sandbox/shared";

type Props = {
  events: TraceEvent[];
  agentIndex: Map<string, "a" | "b">;
};

function kindOf(type: TraceEvent["type"]): string {
  if (type.includes("thought")) return "thought";
  if (type.includes("message")) return "message";
  if (type.includes("tool")) return "tool";
  if (type.includes("done") || type.startsWith("run.")) return type.includes("failed") ? "error" : type.includes("done") || type.includes("completed") ? "done" : "run";
  if (type.includes("error") || type.includes("failed")) return "error";
  return "run";
}

function summarize(event: TraceEvent): string {
  const p = event.payload;
  switch (event.type) {
    case "run.started":
      return `model=${String(p.model)} · scheduler=${String(p.scheduler)} · maxTurns=${String(p.maxTurnsPerAgent)}`;
    case "run.completed":
      return "Both harnesses finished.";
    case "run.failed":
      return String(p.error ?? "unknown error");
    case "agent.turn.started":
      return `turn ${String(p.turn)}/${String(p.maxTurns)}`;
    case "agent.thought":
      return String(p.text ?? "");
    case "agent.tool_call":
      return `${String(p.name)} ${JSON.stringify(p.input)}`;
    case "agent.tool_result":
      return `${String(p.name)} → ${JSON.stringify(p.result)}`;
    case "agent.message_sent":
    case "agent.message_received": {
      const msg = p.message as { fromAgentId?: string; toAgentId?: string; body?: string };
      return `${msg.fromAgentId} → ${msg.toAgentId}: ${msg.body}`;
    }
    case "agent.done":
      return String(p.summary ?? "");
    case "agent.error":
      return String(p.error ?? "");
    default:
      return JSON.stringify(p);
  }
}

export function Timeline({ events, agentIndex }: Props) {
  if (events.length === 0) {
    return (
      <p className="empty">
        No events yet. Launch a run to watch the agents think and talk.
      </p>
    );
  }

  return (
    <div className="timeline">
      {events.map((event) => {
        const lane = event.agentId ? agentIndex.get(event.agentId) : undefined;
        return (
          <article
            key={event.id}
            className="event"
            data-kind={kindOf(event.type)}
          >
            <div className="meta">
              {new Date(event.ts).toLocaleTimeString()}
            </div>
            <div>
              <div className="type">
                {lane ? (
                  <span className={`agent-chip ${lane}`}>
                    agent {lane.toUpperCase()}
                  </span>
                ) : null}
                {event.type}
              </div>
              <div className="body">{summarize(event)}</div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
