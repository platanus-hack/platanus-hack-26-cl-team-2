import { useCallback, useEffect, useState } from "react";
import {
  deleteAgent,
  listAgents,
  type StoredAgent,
} from "../api";
import { SENIORITY_LABELS, areaLabel } from "./labels";
import { PromptCreator } from "./PromptCreator";

type Props = {
  hasDatabase: boolean;
  /** Clicking a saved agent opens its vulnerability evals. */
  onOpenEvals: (agentId: string) => void;
};

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Company context and prompt-based agents, individually or in bulk. */
export function GeneratorPage({ hasDatabase, onOpenEvals }: Props) {
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshAgents = useCallback(async () => {
    setAgents(hasDatabase ? await listAgents() : []);
  }, [hasDatabase]);

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

      <PromptCreator hasDatabase={hasDatabase} onSaved={refreshAgents} />
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
