import { useEffect, useMemo, useState } from "react";
import type {
  AreaHeadcount,
  AreaId,
  OrgSizePreset,
  SeniorityMix,
} from "@sandbox/shared";
import { fetchEnterprisePresets, generateEnterprise } from "../api";

const AREA_LABELS: Record<AreaId, string> = {
  gtm: "Comercial (Ventas)",
  csm: "CSM",
  cs: "Soporte al cliente",
  engineering: "Ingeniería",
  product_design: "Producto y diseño",
  data: "Datos",
  it: "IT",
  finance: "Finance",
};

const EMPTY: AreaHeadcount = {
  gtm: 0,
  csm: 0,
  cs: 0,
  engineering: 0,
  product_design: 0,
  data: 0,
  it: 0,
  finance: 0,
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
      <h2>Generador de empresas</h2>
      <p className="hint">
        Crea múltiples perfiles de agentes a partir de plantillas por área.{" "}
        <strong>Sin IA ni consumo de tokens</strong> — generación determinista. Distribución predeterminada: 25% inicial · 50% intermedio · 25% avanzado.
      </p>

      {!hasDatabase ? (
        <p className="error">Base de datos desconectada: no se pueden guardar los agentes.</p>
      ) : null}

      <label className="block-label">
        Nombre de empresa
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          disabled={busy}
        />
      </label>

      <div className="controls" style={{ marginTop: "1rem" }}>
        <span className="hint" style={{ margin: 0 }}>
          Configuraciones con cantidad exacta de agentes, distribuidos por área:
        </span>
        {([100, 200, 400] as const).map((size) => (
          <button
            key={size}
            type="button"
            className={preset === size ? "btn" : "btn ghost"}
            onClick={() => applyPreset(size)}
            disabled={busy || !presets}
          >
            {size} agentes
          </button>
        ))}
        <button
          type="button"
          className={preset === "custom" ? "btn" : "btn ghost"}
          onClick={applyCustomBlank}
          disabled={busy}
        >
          Personalizado
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={applyOnes}
          disabled={busy}
        >
          1 por área
        </button>
      </div>
      <p className="hint">
        {preset === "custom"
          ? "Personalizado: edita las cantidades; el total se actualiza automáticamente."
          : `Preset ${preset}: totals ${total} agentes across areas. Edit any field to switch to Custom.`}
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

      <p className="hint">Total de agentes: {total}</p>

      <div className="enterprise-grid mix">
        <label>
          Inicial %
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
          Intermedio %
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
          Avanzado %
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
          {busy ? "Generando…" : "Generar agentes (sin IA)"}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {result ? (
        <div className="notice enterprise-result">
          <p>
            Creados: {result.total} perfiles · guardados: {result.saved} · IA utilizada:{" "}
            {result.usedAi ? "sí" : "no"}
          </p>
          <p>
            Experiencia — inicial {result.summary.bySeniority.junior ?? 0}, intermedio{" "}
            {result.summary.bySeniority.mid ?? 0}, avanzado{" "}
            {result.summary.bySeniority.senior ?? 0}
          </p>
          <p className="hint">
            Abre Evaluaciones para seleccionar agentes e iniciar una conversación.
          </p>
        </div>
      ) : null}
    </section>
  );
}
