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
import { PromptAgent } from "./PromptAgent";
import { EXTERNAL_PERSONAS, composeExternalProfile, type ExternalPersona } from "@sandbox/shared";

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
  const [actorType, setActorType] = useState("internal");
  const [persona, setPersona] = useState<ExternalPersona>("cooperative");
  const [objective, setObjective] = useState("");

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
      if (actorType === "external") {
        setProfile(composeExternalProfile({ persona, knobs, name: name.trim() || undefined, companyName: companyName.trim() || undefined, objective }));
        setNotice("Actor externo generado sin consumo de IA. Revisa el perfil y guárdalo; luego selecciónalo en una simulación junto a los agentes internos.");
        return;
      }
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
          `Perfil determinista listo. Se omitió el refinamiento con Haiku: ${result.refineError}`,
        );
      } else if (result.profile.refinedByModel) {
        setNotice("Perfil generado y refinado con Haiku. Guárdalo para conservarlo.");
      } else {
        setNotice("Perfil determinista listo. Guárdalo para conservarlo.");
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
      setNotice("Refinamiento con Haiku aplicado.");
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
      setNotice("Agente guardado y disponible para ejecutar, incluso después de recargar.");
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
      setNotice("Agente eliminado.");
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
      setNotice("Archivo de contexto adjuntado al agente.");
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
      <PromptAgent hasDatabase={hasDatabase} />
      <h2>Generador de perfiles de agentes</h2>
      <p className="hint">
        Plantillas de área y parámetros → perfil editable → base de datos. Los archivos de contexto se adjuntan al agente para futuras ejecuciones.
      </p>

      {!hasDatabase ? (
        <p className="error">
          Database unreachable. Local default is SQLite under `apps/api/data/`.
          For Postgres set `DATABASE_URL=postgresql://…` and run `pnpm --filter
          @sandbox/api db:push`.
        </p>
      ) : null}

      <div className="controls" role="group" aria-label="Tipo de participante">
        <button className={actorType === "internal" ? "btn" : "btn ghost"} aria-pressed={actorType === "internal"} disabled={busy} onClick={() => setActorType("internal")}>Agente interno</button>
        <button className={actorType === "external" ? "btn" : "btn ghost"} aria-pressed={actorType === "external"} disabled={busy} onClick={() => setActorType("external")}>Cliente o atacante simulado</button>
      </div>
      {actorType === "external" ? <>
        <p className="hint">Actores externos para probar respuestas, límites y escalamiento. No representan empleados ni reciben autoridad interna. Se guardan en el catálogo de soporte con su rol externo explícito.</p>
        <div className="area-grid">{Object.entries(EXTERNAL_PERSONAS).map(([id, preset]) => <button key={id} type="button" className={`area-card ${persona === id ? "active" : ""}`} aria-pressed={persona === id} disabled={busy} onClick={() => setPersona(id as ExternalPersona)}><strong>{preset.label}</strong><span>{preset.description}</span></button>)}</div>
        <label className="block-label">Objetivo de la prueba (opcional)<textarea value={objective} onChange={event => setObjective(event.target.value)} disabled={busy} maxLength={2000} placeholder={EXTERNAL_PERSONAS[persona].goal} /></label>
        <div className="knobs-form"><label>Nombre del participante<input value={name} onChange={event => setName(event.target.value)} maxLength={64} disabled={busy} placeholder={EXTERNAL_PERSONAS[persona].label} /></label><label>Empresa con la que interactúa<input value={companyName} onChange={event => setCompanyName(event.target.value)} disabled={busy} maxLength={120} /></label><label>Iniciativa<select value={knobs.proactivity} onChange={event => setKnobs({ ...knobs, proactivity: event.target.value as AgentKnobs["proactivity"] })} disabled={busy}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label></div>
      </> : <><div className="area-grid">
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
          <strong>Cómo:</strong> {selectedArea.how}
          <br />
          <strong>Por qué:</strong> {selectedArea.why}
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
      </>}

      <div className="controls">
        <label className="check">
          <input
            type="checkbox"
            checked={useRefine}
            onChange={(e) => setUseRefine(e.target.checked)}
            disabled={busy || !hasApiKey || actorType === "external"}
          />
          Refinar con Haiku {hasApiKey ? "" : "(requiere clave API)"}
        </label>
        <button
          className="btn"
          type="button"
          onClick={onGenerate}
          disabled={busy || (actorType === "internal" && areas.length === 0)}
        >
          {busy ? "Procesando…" : "Generar perfil"}
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={onRefineAgain}
          disabled={busy || !profile || !hasApiKey || actorType === "external" || profile.title.startsWith("Actor externo")}
        >
          Refinar nuevamente
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={onSave}
          disabled={busy || !profile || !hasDatabase}
        >
          Guardar agente
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled
          title="Etapa 2 — entorno de pruebas individual"
        >
          Prueba individual (próximamente)
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      {profile ? (
        <ProfileEditor profile={profile} onChange={setProfile} />
      ) : (
        <p className="empty">Aún no hay perfil: selecciona un área y ajusta los parámetros para generarlo.</p>
      )}

      {stored ? (
        <div className="context-panel">
          <h3>Archivos de contexto</h3>
          <p className="hint">
            Políticas y guías adjuntas a este agente. Se incluyen en{" "}
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
                  quitar
                </button>
              </li>
            ))}
          </ul>
          <div className="knobs-form">
            <label>
              Nombre de archivo
              <input
                value={ctxName}
                onChange={(e) => setCtxName(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>
          <label className="block-label">
            Contenido
            <textarea
              className="tall"
              value={ctxContent}
              onChange={(e) => setCtxContent(e.target.value)}
              disabled={busy}
              placeholder="Pega una política o guía en Markdown…"
            />
          </label>
          <button
            className="btn ghost"
            type="button"
            onClick={onAddContext}
            disabled={busy || !ctxContent.trim()}
          >
            Adjuntar archivo de contexto
          </button>
        </div>
      ) : null}

      {agents.length > 0 ? (
        <div className="saved-list">
          <h3>Agentes guardados</h3>
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
                  {a.contextFiles.length} archivos
                </button>
                <button
                  type="button"
                  className="linkish danger"
                  onClick={() => onDelete(a.id)}
                  disabled={busy}
                >
                  eliminar
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : hasDatabase ? (
        <p className="empty">Aún no hay agentes guardados.</p>
      ) : null}
    </section>
  );
}
