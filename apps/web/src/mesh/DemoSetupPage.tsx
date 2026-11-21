import { useEffect, useMemo, useState } from "react";
import { listAgents, type StoredAgent } from "../api";
import "./demo-setup.css";

type Props = { hasDatabase: boolean };

function companyName(agent: StoredAgent): string {
  return agent.orgHints?.companyName?.trim() ?? "";
}

/** Pick a saved company. The two spaces stay empty until a later step fills them. */
export function DemoSetupPage({ hasDatabase }: Props) {
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(hasDatabase);

  useEffect(() => {
    if (!hasDatabase) {
      setAgents([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    listAgents()
      .then((list) => {
        if (!cancelled) setAgents(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasDatabase]);

  const companies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const agent of agents) {
      const name = companyName(agent);
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [agents]);

  return (
    <section className="demo-setup">
      <label className="demo-setup-pick">
        Empresa
        <select
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          disabled={!hasDatabase || loading || companies.length === 0}
        >
          <option value="">{loading ? "Cargando…" : "Elige una empresa"}</option>
          {companies.map(([name, count]) => (
            <option key={name} value={name}>
              {name} · {count} agente{count === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>
      {!hasDatabase ? <p className="error">Base de datos no disponible: no hay empresas cargadas.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && hasDatabase && !error && companies.length === 0 ? (
        <p className="hint">No hay empresas cargadas. Créalas en Empresa y agentes.</p>
      ) : null}
      <div className="demo-setup-spaces">
        <div className="demo-space">
          <h2>Espacio A</h2>
        </div>
        <div className="demo-space">
          <h2>Espacio B</h2>
        </div>
      </div>
    </section>
  );
}
