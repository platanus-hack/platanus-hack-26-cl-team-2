import { useEffect, useMemo, useState } from "react";
import type {
  AreaHeadcount,
  AreaId,
  OrgSizePreset,
  SeniorityMix,
} from "@sandbox/shared";
import { fetchEnterprisePresets, generateEnterprise } from "../api";
import { AREA_LABELS } from "./labels";


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
  // Default to the smallest useful company (1 per area = 8 agents) so one click
  // doesn't flood the org graph and the lab with 100 agents.
  const [preset, setPreset] = useState<OrgSizePreset | "custom">("custom");
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
        const ones = { ...EMPTY };
        for (const id of data.areas) ones[id] = 1;
        setCounts(ones);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      );
  }, []);

  const total = useMemo(
    () => areas.reduce((sum, id) => sum + (counts[id] ?? 0), 0),
    [areas, counts],
  );

  const isOnes =
    preset === "custom" &&
    areas.length > 0 &&
    areas.every((id) => counts[id] === 1);

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
          Tamaño de la empresa:
        </span>
        <button
          type="button"
          className={isOnes ? "btn" : "btn ghost"}
          onClick={applyOnes}
          disabled={busy}
        >
          1 por área ({areas.length || 8} agentes)
        </button>
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
          className={preset === "custom" && !isOnes ? "btn" : "btn ghost"}
          onClick={applyCustomBlank}
          disabled={busy}
        >
          Personalizado
        </button>
      </div>
      <p className="hint">
        {preset === "custom"
          ? isOnes
            ? "1 por área: una empresa pequeña con un agente en cada área. Puedes editar las cantidades."
            : "Personalizado: edita las cantidades; el total se actualiza automáticamente."
          : `Configuración de ${preset} agentes: ${total} agentes repartidos entre las áreas. Si editas una cantidad, pasa a Personalizado.`}
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
