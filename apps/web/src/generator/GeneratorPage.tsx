import { useCallback, useEffect, useState } from "react";
import type { AreaId, AreaPrototype, Seniority } from "@sandbox/shared";
import {
  composeProfile,
  deleteAgent,
  fetchAreas,
  listAgents,
  saveProfile,
  type StoredAgent,
} from "../api";
import { AREA_LABELS, SENIORITY_LABELS, areaLabel } from "./labels";

type Props = {
  hasDatabase: boolean;
  /** Clicking a saved agent opens its vulnerability evals. */
  onOpenEvals: (agentId: string) => void;
};

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Minimal agent creator: area + name + seniority → deterministic profile, saved in one step. */
export function GeneratorPage({ hasDatabase, onOpenEvals }: Props) {
  const [areas, setAreas] = useState<AreaPrototype[]>([]);
  const [areaId, setAreaId] = useState<AreaId>("engineering");
  const [name, setName] = useState("");
  const [seniority, setSeniority] = useState<Seniority>("mid");
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshAgents = useCallback(async () => {
    setAgents(hasDatabase ? await listAgents() : []);
  }, [hasDatabase]);

  useEffect(() => {
    fetchAreas()
      .then((list) => {
        setAreas(list);
        if (list[0]) setAreaId(list[0].id);
      })
      .catch((err) => setError(errorText(err)));
  }, []);

  useEffect(() => {
    refreshAgents().catch((err) => setError(errorText(err)));
  }, [refreshAgents]);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
      await refreshAgents();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const onCreate = () =>
    run(async () => {
      const { profile } = await composeProfile({
        areaId,
        knobs: { seniority, motivation: "quality", proactivity: "medium" },
        name: name.trim() || undefined,
        refine: false,
      });
      const { agent } = await saveProfile(profile);
      setName("");
      return `Agente "${agent.name}" creado.`;
    });

  const onDelete = (id: string) =>
    run(async () => {
      await deleteAgent(id);
      return "Agente eliminado.";
    });

  return (
    <section className="panel generator">
      {!hasDatabase ? (
        <p className="error">Base de datos no disponible: no se pueden guardar agentes.</p>
      ) : null}

      <div className="knobs-form">
        <label>
          Área
          <select value={areaId} onChange={(e) => setAreaId(e.target.value as AreaId)} disabled={busy}>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {AREA_LABELS[area.id] ?? area.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nombre (opcional)
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} disabled={busy} />
        </label>
        <label>
          Experiencia
          <select value={seniority} onChange={(e) => setSeniority(e.target.value as Seniority)} disabled={busy}>
            {Object.entries(SENIORITY_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="controls">
        <button className="btn" type="button" onClick={onCreate} disabled={busy || !hasDatabase || areas.length === 0}>
          {busy ? "Creando…" : "Crear agente"}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      {agents.length > 0 ? (
        <div className="saved-list">
          <h3>Agentes guardados</h3>
          <ul>
            {agents.map((a) => (
              <li key={a.id} className="saved-row">
                <button type="button" className="linkish" title="Abrir evals de vulnerabilidad" onClick={() => onOpenEvals(a.id)}>
                  {a.name} · {areaLabel(a.areaId)} · {SENIORITY_LABELS[a.knobs.seniority] ?? a.knobs.seniority}
                </button>
                <button type="button" className="linkish danger" onClick={() => onDelete(a.id)} disabled={busy}>
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
