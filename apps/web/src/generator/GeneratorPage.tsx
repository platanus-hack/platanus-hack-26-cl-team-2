import { useCallback, useEffect, useState } from "react";
import type {
  AgentKnobs,
  AgentProfile,
  AreaId,
  AreaPrototype,
} from "@sandbox/shared";
import {
  addContextFile,
  composeProfile,
  deleteAgent,
  fetchAreas,
  listAgents,
  refineProfile,
  removeContextFile,
  saveProfile,
  type StoredAgent,
} from "../api";
import { KnobsForm } from "./KnobsForm";
import { ProfileEditor } from "./ProfileEditor";

const DEFAULT_KNOBS: AgentKnobs = {
  seniority: "mid",
  motivation: "quality",
  proactivity: "medium",
};

type Props = {
  hasApiKey: boolean;
  hasDatabase: boolean;
};

export function GeneratorPage({ hasApiKey, hasDatabase }: Props) {
  const [areas, setAreas] = useState<AreaPrototype[]>([]);
  const [areaId, setAreaId] = useState<AreaId>("engineering");
  const [knobs, setKnobs] = useState<AgentKnobs>(DEFAULT_KNOBS);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [useRefine, setUseRefine] = useState(true);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [stored, setStored] = useState<StoredAgent | null>(null);
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ctxName, setCtxName] = useState("policy.md");
  const [ctxContent, setCtxContent] = useState("");

  const refreshAgents = useCallback(async () => {
    if (!hasDatabase) {
      setAgents([]);
      return;
    }
    const list = await listAgents();
    setAgents(list);
  }, [hasDatabase]);

  useEffect(() => {
    fetchAreas()
      .then((list) => {
        setAreas(list);
        if (list[0]) setAreaId(list[0].id);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      );
  }, []);

  useEffect(() => {
    refreshAgents().catch((err) =>
      setError(err instanceof Error ? err.message : String(err)),
    );
  }, [refreshAgents]);

  async function onGenerate() {
    setBusy(true);
    setError(null);
    setNotice(null);
    setStored(null);
    try {
      const result = await composeProfile({
        areaId,
        knobs,
        name: name.trim() || undefined,
        orgHints: companyName.trim()
          ? { companyName: companyName.trim() }
          : undefined,
        refine: useRefine && hasApiKey,
      });
      setProfile(result.profile);
      if (result.refineError) {
        setNotice(
          `Deterministic profile ready. Haiku refine skipped: ${result.refineError}`,
        );
      } else if (result.profile.refinedByModel) {
        setNotice("Profile composed + Haiku refined. Save to Postgres to persist.");
      } else {
        setNotice("Deterministic profile ready. Save to Postgres to persist.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRefineAgain() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await refineProfile(profile);
      setProfile(result.profile);
      setNotice("Haiku refine applied.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      const { agent } = await saveProfile({
        ...profile,
        orgHints: companyName.trim()
          ? { companyName: companyName.trim(), ...profile.orgHints }
          : profile.orgHints,
      });
      setProfile(agent);
      setStored(agent);
      await refreshAgents();
      setNotice("Agent saved. Stable across reloads and ready to invoke.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteAgent(id);
      if (profile?.id === id) {
        setProfile(null);
        setStored(null);
      }
      await refreshAgents();
      setNotice("Agent deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onAddContext() {
    if (!stored || !ctxContent.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addContextFile(stored.id, {
        name: ctxName.trim() || "context.md",
        kind: "markdown",
        content: ctxContent,
      });
      await refreshAgents();
      const updated = (await listAgents()).find((a) => a.id === stored.id);
      if (updated) {
        setStored(updated);
        setProfile(updated);
      }
      setCtxContent("");
      setNotice("Context file attached to harness.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveContext(fileId: string) {
    if (!stored) return;
    setBusy(true);
    try {
      await removeContextFile(stored.id, fileId);
      const updated = (await listAgents()).find((a) => a.id === stored.id);
      if (updated) {
        setStored(updated);
        setProfile(updated);
      }
      await refreshAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const selectedArea = areas.find((a) => a.id === areaId);

  return (
    <section className="panel generator">
      <h2>Harness profile generator</h2>
      <p className="hint">
        Area templates + knobs → editable harness profile → Postgres. Context
        files attach to the agent for later invoke.
      </p>

      {!hasDatabase ? (
        <p className="error">
          Database unreachable. Local default is SQLite under `apps/api/data/`.
          For Postgres set `DATABASE_URL=postgresql://…` and run `pnpm --filter
          @sandbox/api db:push`.
        </p>
      ) : null}

      <div className="area-grid">
        {areas.map((area) => (
          <button
            key={area.id}
            type="button"
            className={`area-card ${areaId === area.id ? "active" : ""}`}
            onClick={() => setAreaId(area.id)}
            disabled={busy}
          >
            <strong>{area.label}</strong>
            <span>{area.purpose}</span>
          </button>
        ))}
      </div>

      {selectedArea ? (
        <p className="area-detail">
          <strong>How:</strong> {selectedArea.how}
          <br />
          <strong>Why:</strong> {selectedArea.why}
        </p>
      ) : null}

      <KnobsForm
        knobs={knobs}
        name={name}
        companyName={companyName}
        onKnobsChange={setKnobs}
        onNameChange={setName}
        onCompanyChange={setCompanyName}
        disabled={busy}
      />

      <div className="controls">
        <label className="check">
          <input
            type="checkbox"
            checked={useRefine}
            onChange={(e) => setUseRefine(e.target.checked)}
            disabled={busy || !hasApiKey}
          />
          Refine with Haiku {hasApiKey ? "" : "(needs API key)"}
        </label>
        <button
          className="btn"
          type="button"
          onClick={onGenerate}
          disabled={busy || areas.length === 0}
        >
          {busy ? "Working…" : "Generate profile"}
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={onRefineAgain}
          disabled={busy || !profile || !hasApiKey}
        >
          Refine again
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={onSave}
          disabled={busy || !profile || !hasDatabase}
        >
          Save agent
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled
          title="Iteration 2 — solo sandbox"
        >
          Use in solo sandbox (soon)
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      {profile ? (
        <ProfileEditor profile={profile} onChange={setProfile} />
      ) : (
        <p className="empty">No profile yet — generate one from an area + knobs.</p>
      )}

      {stored ? (
        <div className="context-panel">
          <h3>Context files</h3>
          <p className="hint">
            Policies / playbooks attached to this harness. Included on{" "}
            <code>GET /api/agents/{stored.id}/invoke</code>.
          </p>
          <ul className="ctx-list">
            {stored.contextFiles.map((f) => (
              <li key={f.id}>
                <span>
                  {f.name} · {f.kind}
                </span>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => onRemoveContext(f.id)}
                  disabled={busy}
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
          <div className="knobs-form">
            <label>
              Filename
              <input
                value={ctxName}
                onChange={(e) => setCtxName(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>
          <label className="block-label">
            Content
            <textarea
              className="tall"
              value={ctxContent}
              onChange={(e) => setCtxContent(e.target.value)}
              disabled={busy}
              placeholder="Paste policy / playbook markdown…"
            />
          </label>
          <button
            className="btn ghost"
            type="button"
            onClick={onAddContext}
            disabled={busy || !ctxContent.trim()}
          >
            Attach context file
          </button>
        </div>
      ) : null}

      {agents.length > 0 ? (
        <div className="saved-list">
          <h3>Saved agents</h3>
          <ul>
            {agents.map((a) => (
              <li key={a.id} className="saved-row">
                <button
                  type="button"
                  className="linkish"
                  onClick={() => {
                    setProfile(a);
                    setStored(a);
                    setAreaId(a.areaId);
                    setKnobs(a.knobs);
                    setName(a.name);
                    setCompanyName(a.orgHints?.companyName ?? "");
                  }}
                >
                  {a.name} · {a.areaId} · {a.knobs.seniority} ·{" "}
                  {a.contextFiles.length} files
                </button>
                <button
                  type="button"
                  className="linkish danger"
                  onClick={() => onDelete(a.id)}
                  disabled={busy}
                >
                  delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : hasDatabase ? (
        <p className="empty">No agents saved yet.</p>
      ) : null}
    </section>
  );
}
