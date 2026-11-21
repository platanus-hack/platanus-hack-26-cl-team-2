import { useEffect, useMemo, useState } from "react";
import type {
  AreaHeadcount,
  AreaId,
  OrgSizePreset,
  SeniorityMix,
} from "@sandbox/shared";
import { fetchEnterprisePresets, generateEnterprise } from "../api";

const AREA_LABELS: Record<AreaId, string> = {
  gtm: "GTM (Sales)",
  csm: "CSM",
  cs: "Customer Support",
  engineering: "Engineering",
  product_design: "Product + Design",
  data: "Data",
  it: "IT",
};

const EMPTY: AreaHeadcount = {
  gtm: 0,
  csm: 0,
  cs: 0,
  engineering: 0,
  product_design: 0,
  data: 0,
  it: 0,
};

type Props = {
  hasDatabase: boolean;
};

export function EnterprisePage({ hasDatabase }: Props) {
  const [presets, setPresets] = useState<Record<
    OrgSizePreset,
    AreaHeadcount
  > | null>(null);
  const [areas, setAreas] = useState<AreaId[]>([]);
  const [preset, setPreset] = useState<OrgSizePreset | "custom">(100);
  const [companyName, setCompanyName] = useState("Acme Corp");
  const [counts, setCounts] = useState<AreaHeadcount>({ ...EMPTY });
  const [mix, setMix] = useState<SeniorityMix>({
    junior: 25,
    mid: 50,
    senior: 25,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    total: number;
    saved: number;
    usedAi: boolean;
    summary: {
      byArea: Record<string, number>;
      bySeniority: Record<string, number>;
    };
  } | null>(null);

  useEffect(() => {
    fetchEnterprisePresets()
      .then((data) => {
        setPresets(data.presets);
        setAreas(data.areas);
        setCounts({ ...data.presets[100] });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      );
  }, []);

  const total = useMemo(
    () => areas.reduce((sum, id) => sum + (counts[id] ?? 0), 0),
    [areas, counts],
  );

  function applyPreset(size: OrgSizePreset) {
    if (!presets) return;
    setPreset(size);
    setCounts({ ...presets[size] });
  }

  function applyCustomBlank() {
    setPreset("custom");
    setCounts({ ...EMPTY });
  }

  function applyOnes() {
    setPreset("custom");
    const next = { ...EMPTY };
    for (const id of areas) next[id] = 1;
    setCounts(next);
  }

  function setCount(id: AreaId, value: number) {
    setPreset("custom");
    setCounts((prev) => ({
      ...prev,
      [id]: Math.max(0, Math.floor(value) || 0),
    }));
  }

  async function onGenerate() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const sum = mix.junior + mix.mid + mix.senior;
      const data = await generateEnterprise({
        companyName: companyName.trim() || undefined,
        orgSizePreset: preset === "custom" ? undefined : preset,
        counts,
        seniorityMix: {
          junior: mix.junior / Math.max(sum, 1),
          mid: mix.mid / Math.max(sum, 1),
          senior: mix.senior / Math.max(sum, 1),
        },
        persist: true,
      });
      setResult({
        total: data.total,
        saved: data.saved,
        usedAi: data.usedAi,
        summary: data.summary,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel generator">
      <h2>Enterprise generator</h2>
      <p className="hint">
        Bulk-create harness profiles from area templates.{" "}
        <strong>No AI / no tokens</strong> — deterministic compose only. Default
        seniority mix ≈ 25% junior · 50% mid · 25% senior.
      </p>

      {!hasDatabase ? (
        <p className="error">Database offline — cannot persist the fleet.</p>
      ) : null}

      <label className="block-label">
        Company name
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          disabled={busy}
        />
      </label>

      <div className="controls" style={{ marginTop: "1rem" }}>
        <span className="hint" style={{ margin: 0 }}>
          Presets = exact agent count, split by area:
        </span>
        {([100, 200, 400] as const).map((size) => (
          <button
            key={size}
            type="button"
            className={preset === size ? "btn" : "btn ghost"}
            onClick={() => applyPreset(size)}
            disabled={busy || !presets}
          >
            {size} agents
          </button>
        ))}
        <button
          type="button"
          className={preset === "custom" ? "btn" : "btn ghost"}
          onClick={applyCustomBlank}
          disabled={busy}
        >
          Custom
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={applyOnes}
          disabled={busy}
        >
          1 per area
        </button>
      </div>
      <p className="hint">
        {preset === "custom"
          ? "Custom: edit the numbers below (total updates live)."
          : `Preset ${preset}: totals ${total} agents across areas. Edit any field to switch to Custom.`}
      </p>

      <div className="enterprise-grid">
        {areas.map((id) => (
          <label key={id}>
            {AREA_LABELS[id] ?? id}
            <input
              type="number"
              min={0}
              max={200}
              value={counts[id] ?? 0}
              onChange={(e) => setCount(id, Number(e.target.value))}
              disabled={busy}
            />
          </label>
        ))}
      </div>

      <p className="hint">Total agents: {total}</p>

      <div className="enterprise-grid mix">
        <label>
          Junior %
          <input
            type="number"
            min={0}
            max={100}
            value={mix.junior}
            onChange={(e) =>
              setMix((m) => ({ ...m, junior: Number(e.target.value) || 0 }))
            }
            disabled={busy}
          />
        </label>
        <label>
          Mid %
          <input
            type="number"
            min={0}
            max={100}
            value={mix.mid}
            onChange={(e) =>
              setMix((m) => ({ ...m, mid: Number(e.target.value) || 0 }))
            }
            disabled={busy}
          />
        </label>
        <label>
          Senior %
          <input
            type="number"
            min={0}
            max={100}
            value={mix.senior}
            onChange={(e) =>
              setMix((m) => ({ ...m, senior: Number(e.target.value) || 0 }))
            }
            disabled={busy}
          />
        </label>
      </div>

      <div className="controls">
        <button
          className="btn"
          type="button"
          onClick={onGenerate}
          disabled={busy || !hasDatabase || total === 0}
        >
          {busy ? "Generating…" : "Generate fleet (no AI)"}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {result ? (
        <div className="notice enterprise-result">
          <p>
            Created {result.total} profiles · saved {result.saved} · AI used:{" "}
            {result.usedAi ? "yes" : "no"}
          </p>
          <p>
            Seniority — junior {result.summary.bySeniority.junior ?? 0}, mid{" "}
            {result.summary.bySeniority.mid ?? 0}, senior{" "}
            {result.summary.bySeniority.senior ?? 0}
          </p>
          <p className="hint">
            Open Multi-agent lab to pick any two and run a conversation.
          </p>
        </div>
      ) : null}
    </section>
  );
}
