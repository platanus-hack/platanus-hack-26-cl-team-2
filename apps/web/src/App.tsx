import { useEffect, useState } from "react";
import { fetchHealth } from "./api";
import { EnterprisePage } from "./generator/EnterprisePage";
import { GeneratorPage } from "./generator/GeneratorPage";
import { LabPage } from "./LabPage";

type Tab = "generator" | "enterprise" | "lab";

export function App() {
  const [tab, setTab] = useState<Tab>("generator");
  const [health, setHealth] = useState<{
    ok: boolean;
    hasApiKey: boolean;
    hasDatabase?: boolean;
    dbDriver?: string;
    database?: { ok: boolean; driver?: string; error?: string };
    model: string;
    refineModel?: string;
  } | null>(null);

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

  return (
    <div className="app">
      <header className="hero">
        <p className="brand">
          Agent <span>Sandbox</span>
        </p>
        <p className="lede">
          Simulate corporate agents before production. Generate area-based
          harness profiles with seniority, motivation, and proactivity — then
          observe how they behave.
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
          <span>
            <span
              className={`dot ${health?.database?.ok ? "ok" : "bad"}`}
            />
            DB{" "}
            {health?.database?.ok
              ? `online (${health.dbDriver ?? health.database.driver ?? "?"})`
              : "error"}
          </span>
          <span>run: {health?.model ?? "…"}</span>
          <span>refine: {health?.refineModel ?? "…"}</span>
        </div>
        <nav className="tabs" aria-label="Main">
          <button
            type="button"
            className={tab === "generator" ? "tab active" : "tab"}
            onClick={() => setTab("generator")}
          >
            Profile generator
          </button>
          <button
            type="button"
            className={tab === "enterprise" ? "tab active" : "tab"}
            onClick={() => setTab("enterprise")}
          >
            Generador de empresas
          </button>
          <button
            type="button"
            className={tab === "lab" ? "tab active" : "tab"}
            onClick={() => setTab("lab")}
          >
            Laboratorio multiagente
          </button>
        </nav>
      </header>

      {tab === "generator" ? (
        <GeneratorPage
          hasApiKey={Boolean(health?.hasApiKey)}
          hasDatabase={Boolean(health?.database?.ok)}
        />
      ) : tab === "enterprise" ? (
        <EnterprisePage hasDatabase={Boolean(health?.database?.ok)} />
      ) : (
        <LabPage hasApiKey={Boolean(health?.hasApiKey)} />
      )}
    </div>
  );
}
