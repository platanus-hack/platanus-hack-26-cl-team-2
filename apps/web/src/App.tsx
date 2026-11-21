import { useEffect, useMemo, useState } from "react";
import type { AgentSpecInput, RunSummary, TraceEvent } from "@sandbox/shared";
import { createRun, fetchHealth, subscribeRunEvents } from "./api";
import { DEFAULT_AGENTS } from "./presets";
import { Timeline } from "./Timeline";

type AgentFormState = AgentSpecInput;

export function App() {
  const [agents, setAgents] = useState<[AgentFormState, AgentFormState]>(
    DEFAULT_AGENTS,
  );
  const [maxTurns, setMaxTurns] = useState(8);
  const [health, setHealth] = useState<{
    ok: boolean;
    hasApiKey: boolean;
    model: string;
  } | null>(null);
  const [run, setRun] = useState<RunSummary | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch(() => {
        if (!cancelled) setHealth({ ok: false, hasApiKey: false, model: "?" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!run) return;
    const unsubscribe = subscribeRunEvents(run.id, (event) => {
      setEvents((prev) => {
        if (prev.some((e) => e.id === event.id)) return prev;
        return [...prev, event];
      });
      if (event.type === "run.completed" || event.type === "run.failed") {
        setBusy(false);
        setRun((current) =>
          current
            ? {
                ...current,
                status: event.type === "run.completed" ? "completed" : "failed",
                error:
                  event.type === "run.failed"
                    ? String(event.payload.error ?? "failed")
                    : current.error,
              }
            : current,
        );
      }
    });
    return unsubscribe;
  }, [run?.id]);

  const agentIndex = useMemo(() => {
    const map = new Map<string, "a" | "b">();
    run?.agents.forEach((a, i) => map.set(a.id, i === 0 ? "a" : "b"));
    return map;
  }, [run]);

  function updateAgent(index: 0 | 1, patch: Partial<AgentFormState>) {
    setAgents((prev) => {
      const next = [...prev] as [AgentFormState, AgentFormState];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  async function onLaunch() {
    setError(null);
    setBusy(true);
    setEvents([]);
    setRun(null);
    try {
      const { run: created } = await createRun({
        agents,
        maxTurnsPerAgent: maxTurns,
      });
      setRun(created);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function onReset() {
    setAgents(DEFAULT_AGENTS);
    setEvents([]);
    setRun(null);
    setError(null);
    setBusy(false);
  }

  return (
    <div className="app">
      <header className="hero">
        <p className="brand">
          Agent <span>Sandbox</span>
        </p>
        <p className="lede">
          Two real Claude agents, each with its own harness. Give them roles and
          goals, watch thoughts, tool calls, and peer messages as they coordinate.
        </p>
        <div className="status-row">
          <span>
            <span className={`dot ${health?.ok ? "ok" : "bad"}`} />
            API {health?.ok ? "online" : "offline"}
          </span>
          <span>
            <span className={`dot ${health?.hasApiKey ? "ok" : "bad"}`} />
            ANTHROPIC_API_KEY {health?.hasApiKey ? "ready" : "missing"}
          </span>
          <span>model: {health?.model ?? "…"}</span>
          {run ? <span>run: {run.id} · {run.status}</span> : null}
        </div>
      </header>

      <section className="panel">
        <h2>Configure agents</h2>
        <p className="hint">
          Minimal tools only: send_message, read_inbox, done. Round-robin
          scheduler keeps the interaction readable and cheap.
        </p>

        <div className="agents-grid">
          {([0, 1] as const).map((i) => (
            <div
              key={i}
              className="agent-form"
              data-agent={i === 0 ? "a" : "b"}
            >
              <h3>Agent {i === 0 ? "A" : "B"}</h3>
              <label>
                Name
                <input
                  value={agents[i].name}
                  onChange={(e) => updateAgent(i, { name: e.target.value })}
                  disabled={busy}
                />
              </label>
              <label>
                Role
                <textarea
                  value={agents[i].role}
                  onChange={(e) => updateAgent(i, { role: e.target.value })}
                  disabled={busy}
                />
              </label>
              <label>
                Goal / order
                <textarea
                  value={agents[i].goal}
                  onChange={(e) => updateAgent(i, { goal: e.target.value })}
                  disabled={busy}
                />
              </label>
            </div>
          ))}
        </div>

        <div className="controls">
          <label>
            Max turns / agent
            <input
              type="number"
              min={1}
              max={30}
              value={maxTurns}
              onChange={(e) => setMaxTurns(Number(e.target.value) || 1)}
              disabled={busy}
            />
          </label>
          <button
            className="btn"
            type="button"
            onClick={onLaunch}
            disabled={busy || !health?.hasApiKey}
          >
            {busy ? "Running…" : "Launch agents"}
          </button>
          <button className="btn ghost" type="button" onClick={onReset}>
            Reset
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {!health?.hasApiKey && health?.ok ? (
          <p className="error">
            Put your key in `.env` (see `.env.example`) and restart the API.
          </p>
        ) : null}
      </section>

      <section className="panel">
        <h2>Live trace</h2>
        <p className="hint">
          Thoughts, tool calls, and peer messages stream over SSE from the
          harness.
        </p>
        <Timeline events={events} agentIndex={agentIndex} />
      </section>
    </div>
  );
}
