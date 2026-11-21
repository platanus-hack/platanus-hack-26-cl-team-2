import { useEffect, useMemo, useState } from "react";
import type {
  CreateStoredRunRequest,
  EmailScenarioSummary,
  RiskPathAnalysis,
  RunEvaluation,
  RunRiskPaths,
  RunSummary,
  TraceEvent,
} from "@sandbox/shared";
import {
  analyzeRiskPaths,
  createRunFromStored,
  fetchRun,
  judgeRun,
  judgeTranscript,
  listAgents,
  listEmailScenarios,
  subscribeRunEvents,
  type RunJudgment,
  type StoredAgent,
} from "./api";
import { RunJudgmentPanel } from "./RunJudgment";
import {
  BeforeAfterPanel,
  RunOutcomePanel,
  type RunSnapshot,
} from "./RunOutcome";
import { RiskPathsPanel } from "./RiskPaths";
import { Timeline } from "./Timeline";

type Props = {
  hasApiKey: boolean;
};

const MAX_PARTICIPANTS = 8;

type FixName = "sender_check" | "provenance_tag";

const FIX_BUTTON: Record<FixName, { label: string; title: string }> = {
  sender_check: {
    label: "Re-run with sender_check fix",
    title: "Same agents, seed, finance tools and email; only adds the sender check (seed only)",
  },
  provenance_tag: {
    label: "Re-run with provenance_tag fix",
    title:
      "Same setup; the harness appends the email's origin (and sender verdict, if on) to every agent-to-agent message",
  },
};

function fixesOf(req: CreateStoredRunRequest | null): FixName[] {
  const e = req?.emailScenario;
  if (!e) return [];
  return [
    ...(e.senderCheck ? (["sender_check"] as const) : []),
    ...(e.provenanceTag ? (["provenance_tag"] as const) : []),
  ];
}

export function LabPage({ hasApiKey }: Props) {
  const [catalog, setCatalog] = useState<StoredAgent[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [seedAgentId, setSeedAgentId] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [scenarioHint, setScenarioHint] = useState(
    "A strategic customer is escalating a reliability issue that may block renewal. Decide who to involve and drive a concrete next step.",
  );
  const [scenarioSource, setScenarioSource] = useState<"text" | "email">("text");
  const [emails, setEmails] = useState<EmailScenarioSummary[]>([]);
  const [emailLoadError, setEmailLoadError] = useState<string | null>(null);
  const [emailKey, setEmailKey] = useState("");
  const [senderCheckOn, setSenderCheckOn] = useState(false);
  const [provenanceTagOn, setProvenanceTagOn] = useState(false);
  const [preview, setPreview] = useState<RiskPathAnalysis | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [runRiskPaths, setRunRiskPaths] = useState<RunRiskPaths | null>(null);
  const [finance, setFinance] = useState<Record<string, boolean>>({});
  const [maxTurns, setMaxTurns] = useState(6);
  const [run, setRun] = useState<RunSummary | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [judgment, setJudgment] = useState<RunJudgment | null>(null);
  const [evaluation, setEvaluation] = useState<RunEvaluation | null>(null);
  /** Exact request of the last launch, so "re-run with fix" changes only the fix. */
  const [lastLaunch, setLastLaunch] = useState<CreateStoredRunRequest | null>(null);
  /** The run before the fix, kept for the before/after comparison. */
  const [baseline, setBaseline] = useState<RunSnapshot | null>(null);
  const [judging, setJudging] = useState(false);
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const [manualRunId, setManualRunId] = useState("");
  const [pastedTranscript, setPastedTranscript] = useState("");

  useEffect(() => {
    listAgents()
      .then((agents) => {
        setCatalog(agents);
        const next: Record<string, boolean> = {};
        for (const a of agents) next[a.id] = false;
        // Enable first two by default for a quick start
        if (agents[0]) next[agents[0].id] = true;
        if (agents[1]) next[agents[1].id] = true;
        setEnabled(next);
        if (agents[0]) setSeedAgentId(agents[0].id);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      );
  }, []);

  useEffect(() => {
    listEmailScenarios()
      .then(({ scenarios, errors }) => {
        setEmails(scenarios);
        if (scenarios[0]) setEmailKey(emailKeyOf(scenarios[0]));
        if (errors.length) setEmailLoadError(errors.join(" · "));
      })
      .catch((err) =>
        setEmailLoadError(err instanceof Error ? err.message : String(err)),
      );
  }, []);

  const selectedEmail = useMemo(
    () => emails.find((e) => emailKeyOf(e) === emailKey) ?? null,
    [emails, emailKey],
  );

  const emailFiles = useMemo(
    () => [...new Set(emails.map((e) => e.file))],
    [emails],
  );

  useEffect(() => {
    if (!run) return;
    let finished = false;
    const unsubscribe = subscribeRunEvents(run.id, (event) => {
      if (finished) return;
      setEvents((prev) => {
        if (prev.some((e) => e.id === event.id)) return prev;
        return [...prev, event];
      });
      if (event.type === "run.completed" || event.type === "run.failed") {
        // Close the stream: otherwise EventSource reconnects when the server ends it,
        // replays the history and re-triggers the judge every few seconds.
        finished = true;
        unsubscribe();
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
        if (run) {
          void fetchRun(run.id)
            .then((d) => {
              setEvaluation(d.evaluation);
              setRunRiskPaths(d.riskPaths ?? null);
            })
            .catch(() => undefined);
        }
        if (event.type === "run.completed" && run) {
          void requestJudge(run.id);
        }
      }
    });
    return unsubscribe;
  }, [run?.id]);

  async function requestJudge(runId: string) {
    const id = runId.trim();
    if (!id) return;
    setJudging(true);
    setJudgeError(null);
    try {
      const { judgment: j, evaluation: ev } = await judgeRun(id);
      setJudgment(j);
      setEvaluation(ev);
    } catch (err) {
      setJudgeError(err instanceof Error ? err.message : String(err));
    } finally {
      setJudging(false);
    }
  }

  async function loadRunById() {
    const id = manualRunId.trim();
    if (!id) return;
    setError(null);
    setJudgeError(null);
    setJudgment(null);
    setBusy(false);
    try {
      const data = await fetchRun(id);
      setRun(data.run);
      setEvents(data.events ?? []);
      setJudgment(data.judgment ?? null);
      setEvaluation(data.evaluation ?? null);
      setRunRiskPaths(data.riskPaths ?? null);
      setManualRunId(id);
      if (
        !data.judgment &&
        (data.run.status === "completed" || data.run.status === "failed")
      ) {
        await requestJudge(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function judgePasted() {
    const transcript = pastedTranscript.trim();
    if (transcript.length < 40) {
      setJudgeError("Paste the live-trace / conversation text first.");
      return;
    }
    setJudging(true);
    setJudgeError(null);
    try {
      const agentsNote = selectedIds
        .map((id) => {
          const a = catalog.find((x) => x.id === id);
          if (!a) return null;
          const seed = a.id === seedAgentId ? " [SEED]" : "";
          return `${a.name}${seed} | ${a.title} | ${a.knobs.seniority} | focus=${a.knobs.motivation}`;
        })
        .filter(Boolean)
        .join("\n");
      const { judgment: j } = await judgeTranscript({
        transcript,
        scenario:
          scenarioSource === "email"
            ? selectedEmail?.email
            : scenarioHint.trim() || undefined,
        agentsNote: agentsNote || undefined,
      });
      setJudgment(j);
    } catch (err) {
      setJudgeError(err instanceof Error ? err.message : String(err));
    } finally {
      setJudging(false);
    }
  }

  const areas = useMemo(() => {
    const set = new Set(catalog.map((a) => a.areaId));
    return ["all", ...[...set].sort()];
  }, [catalog]);

  const visible = useMemo(() => {
    if (areaFilter === "all") return catalog;
    return catalog.filter((a) => a.areaId === areaFilter);
  }, [catalog, areaFilter]);

  const selectedIds = useMemo(
    () => catalog.filter((a) => enabled[a.id]).map((a) => a.id),
    [catalog, enabled],
  );

  const agentIndex = useMemo(() => {
    const map = new Map<string, number>();
    run?.agents.forEach((a, i) => map.set(a.id, i));
    return map;
  }, [run]);

  // Keep seed valid when toggling
  useEffect(() => {
    if (selectedIds.length === 0) return;
    if (!selectedIds.includes(seedAgentId)) {
      setSeedAgentId(selectedIds[0]);
    }
  }, [selectedIds, seedAgentId]);

  // MESH preview: re-analyze the setup whenever it changes (no model call, debounced).
  const previewKey = JSON.stringify({
    selectedIds,
    seedAgentId,
    finance: selectedIds.filter((id) => finance[id]),
    email: scenarioSource === "email" && selectedEmail ? emailKeyOf(selectedEmail) : null,
    senderCheckOn,
    provenanceTagOn,
  });
  useEffect(() => {
    if (selectedIds.length === 0 || !selectedIds.includes(seedAgentId)) {
      setPreview(null);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      analyzeRiskPaths(
        {
          agentIds: selectedIds,
          seedAgentId,
          financeAgentIds: selectedIds.filter((id) => finance[id]),
          ...(scenarioSource === "email" && selectedEmail
            ? {
                emailScenario: {
                  file: selectedEmail.file,
                  id: selectedEmail.id,
                  senderCheck: senderCheckOn,
                  provenanceTag: provenanceTagOn,
                },
              }
            : {}),
        },
        ctrl.signal,
      )
        .then((a) => {
          setPreview(a);
          setPreviewError(null);
        })
        .catch((err) => {
          if (ctrl.signal.aborted) return;
          setPreviewError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setPreviewLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [previewKey]);

  const canLaunch =
    hasApiKey &&
    !busy &&
    selectedIds.length >= 2 &&
    selectedIds.length <= MAX_PARTICIPANTS &&
    selectedIds.includes(seedAgentId) &&
    (scenarioSource === "text" || selectedEmail !== null);

  function toggle(id: string) {
    setEnabled((prev) => {
      const turningOn = !prev[id];
      if (turningOn) {
        const currentlyOn = Object.values(prev).filter(Boolean).length;
        if (currentlyOn >= MAX_PARTICIPANTS) {
          setError(`Max ${MAX_PARTICIPANTS} agents per run (token safety).`);
          return prev;
        }
      }
      setError(null);
      return { ...prev, [id]: turningOn };
    });
  }

  function setAreaEnabled(areaId: string, on: boolean) {
    setEnabled((prev) => {
      const next = { ...prev };
      let onCount = Object.values(next).filter(Boolean).length;
      for (const a of catalog) {
        if (a.areaId !== areaId) continue;
        if (on && !next[a.id]) {
          if (onCount >= MAX_PARTICIPANTS) break;
          next[a.id] = true;
          onCount += 1;
        } else if (!on) {
          next[a.id] = false;
        }
      }
      return next;
    });
  }

  async function launch(body: CreateStoredRunRequest) {
    setError(null);
    setBusy(true);
    setEvents([]);
    setRun(null);
    setJudgment(null);
    setEvaluation(null);
    setRunRiskPaths(null);
    setJudgeError(null);
    try {
      const { run: created } = await createRunFromStored(body);
      setLastLaunch(body);
      setRun(created);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  /** Improve loop: same request plus one fix; the current run becomes "before". */
  async function rerunWithFix(fix: FixName) {
    if (!run || !lastLaunch?.emailScenario) return;
    const current = fixesOf(lastLaunch);
    setBaseline({
      runId: run.id,
      label: `before (${current.length ? current.join(" + ") : "no fix"})`,
      evaluation,
      judgment,
    });
    if (fix === "sender_check") setSenderCheckOn(true);
    else setProvenanceTagOn(true);
    await launch({
      ...lastLaunch,
      emailScenario: {
        ...lastLaunch.emailScenario,
        ...(fix === "sender_check" ? { senderCheck: true } : { provenanceTag: true }),
      },
    });
  }

  const runFinished =
    !busy &&
    run !== null &&
    (run.status === "completed" || run.status === "failed") &&
    lastLaunch?.emailScenario !== undefined;
  const rerunFixes: FixName[] = runFinished
    ? (["sender_check", "provenance_tag"] as const).filter(
        (f) => !fixesOf(lastLaunch).includes(f),
      )
    : [];
  const afterLabel = `after (${fixesOf(lastLaunch).join(" + ") || "no fix"})`;

  async function onLaunch() {
    setBaseline(null);
    await launch({
        agentIds: selectedIds,
        seedAgentId,
        maxTurnsPerAgent: maxTurns,
        financeAgentIds: selectedIds.filter((id) => finance[id]),
        ...(scenarioSource === "email" && selectedEmail
          ? {
              emailScenario: {
                file: selectedEmail.file,
                id: selectedEmail.id,
                senderCheck: senderCheckOn,
                provenanceTag: provenanceTagOn,
              },
            }
          : { scenarioHint: scenarioHint.trim() || undefined }),
    });
  }

  return (
    <>
      <section className="panel">
        <h2>Multi-agent lab</h2>
        <p className="hint">
          Toggle agents from your fleet. Only the <strong>seed</strong> gets the
          scenario — they decide whom to message. Others start idle until
          contacted. Cap: {MAX_PARTICIPANTS} participants / run.
        </p>

        {catalog.length < 2 ? (
          <p className="error">
            Need at least 2 saved agents. Use Enterprise or Profile generator
            first.
          </p>
        ) : null}

        <div className="controls">
          <label>
            Filter area
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              disabled={busy}
            >
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn ghost"
            disabled={busy || areaFilter === "all"}
            onClick={() => setAreaEnabled(areaFilter, true)}
          >
            Enable visible area
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy || areaFilter === "all"}
            onClick={() => setAreaEnabled(areaFilter, false)}
          >
            Disable visible area
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() =>
              setEnabled(
                Object.fromEntries(catalog.map((a) => [a.id, false])),
              )
            }
          >
            Clear all
          </button>
        </div>

        <p className="hint">
          Selected: {selectedIds.length} / {MAX_PARTICIPANTS} · finance tools:{" "}
          {selectedIds.filter((id) => finance[id]).length || "nobody"} —
          refunds are simulated, bank account changes are always blocked and
          recorded.
        </p>

        <div className="fleet-list">
          {visible.map((a) => (
            <label key={a.id} className="fleet-row">
              <input
                type="checkbox"
                checked={Boolean(enabled[a.id])}
                onChange={() => toggle(a.id)}
                disabled={busy}
              />
              <span className="fleet-main">
                <strong>{a.name}</strong>
                <span className="muted">
                  {a.areaId} · {a.knobs.seniority} · {a.knobs.motivation}
                </span>
              </span>
              <button
                type="button"
                className={
                  seedAgentId === a.id ? "btn seed-btn" : "btn ghost seed-btn"
                }
                disabled={busy || !enabled[a.id]}
                onClick={() => setSeedAgentId(a.id)}
                title="Receive initial scenario"
              >
                {seedAgentId === a.id ? "seed" : "make seed"}
              </button>
              <button
                type="button"
                className={
                  finance[a.id] ? "btn seed-btn finance-on" : "btn ghost seed-btn"
                }
                disabled={busy || !enabled[a.id]}
                onClick={(e) => {
                  e.preventDefault();
                  setFinance((prev) => ({ ...prev, [a.id]: !prev[a.id] }));
                }}
                title="Give this agent the sandboxed finance tools: issue_refund (simulated) and update_vendor_bank_account (always blocked)"
              >
                {finance[a.id] ? "finance tools" : "+ finance"}
              </button>
            </label>
          ))}
        </div>

        <div className="controls">
          <label>
            Scenario source
            <select
              value={scenarioSource}
              onChange={(e) =>
                setScenarioSource(e.target.value as "text" | "email")
              }
              disabled={busy}
            >
              <option value="text">Free text</option>
              <option value="email">Incoming email (email-harness)</option>
            </select>
          </label>
        </div>

        {scenarioSource === "text" ? (
          <label className="block-label scenario">
            Scenario (only delivered to seed)
            <textarea
              value={scenarioHint}
              onChange={(e) => setScenarioHint(e.target.value)}
              disabled={busy}
              placeholder="Instruction for the seed agent only…"
            />
          </label>
        ) : (
          <div className="email-scenario">
            {emails.length === 0 ? (
              <p className="error">
                No emails found in email-harness/scenarios.
                {emailLoadError ? ` ${emailLoadError}` : ""}
              </p>
            ) : (
              <>
                <div className="controls">
                  <label>
                    Email
                    <select
                      value={emailKey}
                      onChange={(e) => setEmailKey(e.target.value)}
                      disabled={busy}
                    >
                      {emailFiles.map((file) => (
                        <optgroup key={file} label={file}>
                          {emails
                            .filter((e) => e.file === file)
                            .map((e) => (
                              <option key={emailKeyOf(e)} value={emailKeyOf(e)}>
                                [{e.kind}] {e.id}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={senderCheckOn}
                      onChange={(e) => setSenderCheckOn(e.target.checked)}
                      disabled={busy}
                    />
                    Show seed the automated sender check (fix)
                  </label>
                  <label
                    className="check"
                    title="The harness appends the email's origin (and the sender verdict, if that fix is on) to every message agents send each other"
                  >
                    <input
                      type="checkbox"
                      checked={provenanceTagOn}
                      onChange={(e) => setProvenanceTagOn(e.target.checked)}
                      disabled={busy}
                    />
                    Carry provenance on every agent message (fix)
                  </label>
                </div>
                {emailLoadError ? (
                  <p className="hint">Some files were skipped: {emailLoadError}</p>
                ) : null}
                {selectedEmail ? (
                  <>
                    <p className="hint">
                      <span className={`email-kind kind-${selectedEmail.kind}`}>
                        {selectedEmail.kind}
                      </span>{" "}
                      {selectedEmail.technique} · sender check:{" "}
                      <strong
                        className={
                          selectedEmail.senderCheck.verdict === "SUSPICIOUS"
                            ? "verdict-bad"
                            : "verdict-ok"
                        }
                      >
                        {selectedEmail.senderCheck.verdict}
                      </strong>
                      {selectedEmail.senderCheck.reasons.length
                        ? ` — ${selectedEmail.senderCheck.reasons.join("; ")}`
                        : ""}
                      {senderCheckOn ? "" : " (computed, not shown to agents)"}
                    </p>
                    <pre className="email-preview">{selectedEmail.email}</pre>
                  </>
                ) : null}
              </>
            )}
          </div>
        )}
        <p className="hint">
          Seed:{" "}
          {catalog.find((a) => a.id === seedAgentId)?.name ?? "(none)"} — they
          alone see this {scenarioSource === "email" ? "email" : "text"} and
          decide next steps.
        </p>

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
            disabled={!canLaunch}
          >
            {busy ? "Running…" : "Launch conversation"}
          </button>
        </div>
        {rerunFixes.length ? (
          <div className="controls">
            {rerunFixes.map((fix) => (
              <button
                key={fix}
                type="button"
                className="btn"
                onClick={() => void rerunWithFix(fix)}
                title={FIX_BUTTON[fix].title}
              >
                {FIX_BUTTON[fix].label}
              </button>
            ))}
            {judgment?.audit?.recommendedFix &&
            rerunFixes.includes(judgment.audit.recommendedFix as FixName) ? (
              <span className="hint">
                The judge recommends {judgment.audit.recommendedFix}.
              </span>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        {run ? (
          <p className="hint">
            run: {run.id} · {run.status} · {run.agents.length} agents · seed
            first
          </p>
        ) : null}

        <label className="block-label">
          Paste conversation / live trace
          <textarea
            className="paste-trace"
            value={pastedTranscript}
            onChange={(e) => setPastedTranscript(e.target.value)}
            disabled={judging}
            placeholder="Paste the copied live-trace output here, then Judge paste…"
            rows={8}
            spellCheck={false}
          />
        </label>
        <div className="controls">
          <button
            type="button"
            className="btn"
            disabled={judging || pastedTranscript.trim().length < 40}
            onClick={() => void judgePasted()}
          >
            {judging ? "Judging…" : "Judge paste"}
          </button>
        </div>
        <p className="hint">
          Uses the scenario + currently selected agents as context. No run id
          needed — works after server restarts.
        </p>

        <label className="block-label">
          Or load run by id (in-memory only)
          <div className="controls run-id-row">
            <input
              type="text"
              value={manualRunId}
              onChange={(e) => setManualRunId(e.target.value)}
              placeholder="paste run id…"
              spellCheck={false}
              disabled={busy || judging}
            />
            <button
              type="button"
              className="btn ghost"
              disabled={busy || judging || !manualRunId.trim()}
              onClick={() => void loadRunById()}
            >
              Load
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={judging || !manualRunId.trim()}
              onClick={() => void requestJudge(manualRunId)}
            >
              Judge id
            </button>
          </div>
        </label>
      </section>

      {runRiskPaths ? (
        <RiskPathsPanel
          title="Risk paths (MESH) — this run"
          analysis={runRiskPaths.predicted}
          observed={runRiskPaths.observed}
        />
      ) : (
        <RiskPathsPanel
          title="Risk paths (MESH) — predicted for this setup"
          analysis={preview}
          loading={previewLoading}
          error={previewError}
        />
      )}

      <section className="panel">
        <h2>Live trace</h2>
        <p className="hint">
          Thoughts, messages, and tool calls stream over SSE.
        </p>
        <Timeline events={events} agentIndex={agentIndex} />
      </section>

      <RunOutcomePanel evaluation={evaluation} />

      {baseline && run ? (
        <BeforeAfterPanel
          before={baseline}
          after={{ runId: run.id, label: afterLabel, evaluation, judgment }}
        />
      ) : null}

      <RunJudgmentPanel
        judgment={judgment}
        loading={judging}
        error={judgeError}
        canRetry={Boolean(run && (run.status === "completed" || run.status === "failed"))}
        onRetry={() => run && void requestJudge(run.id)}
      />
    </>
  );
}

function emailKeyOf(e: Pick<EmailScenarioSummary, "file" | "id">): string {
  return `${e.file}#${e.id}`;
}
