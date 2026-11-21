import { useEffect, useState } from "react";
import type { AreaHeadcount, AreaId, OrgSizePreset } from "@sandbox/shared";
import { fetchEnterprisePresets, generateEnterprise } from "../api";

type Props = {
  hasDatabase: boolean;
};

type Size = "ones" | OrgSizePreset;

/** Minimal company creator: name + size → deterministic agents (no AI), 25/50/25 seniority mix. */
export function EnterprisePage({ hasDatabase }: Props) {
  const [presets, setPresets] = useState<Record<OrgSizePreset, AreaHeadcount> | null>(null);
  const [areas, setAreas] = useState<AreaId[]>([]);
  const [companyName, setCompanyName] = useState("Acme Corp");
  // Default to the smallest useful company (1 per area) so one click doesn't flood the lab.
  const [size, setSize] = useState<Size>("ones");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchEnterprisePresets()
      .then((data) => {
        setPresets(data.presets);
        setAreas(data.areas);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  async function onGenerate() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const counts = {} as AreaHeadcount;
      for (const id of areas) counts[id] = size === "ones" ? 1 : (presets?.[size][id] ?? 0);
      const data = await generateEnterprise({
        companyName: companyName.trim() || undefined,
        orgSizePreset: size === "ones" ? undefined : size,
        counts,
        seniorityMix: { junior: 0.25, mid: 0.5, senior: 0.25 },
        persist: true,
      });
      setNotice(`${data.saved} agentes guardados. Ábrelos en Evaluaciones.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel generator">
      {!hasDatabase ? (
        <p className="error">Base de datos desconectada: no se pueden guardar los agentes.</p>
      ) : null}

      <div className="knobs-form">
        <label>
          Nombre de empresa
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={busy} />
        </label>
        <label>
          Tamaño
          <select value={String(size)} onChange={(e) => setSize(e.target.value === "ones" ? "ones" : (Number(e.target.value) as OrgSizePreset))} disabled={busy}>
            <option value="ones">1 por área ({areas.length || 8} agentes)</option>
            {([100, 200, 400] as const).map((n) => (
              <option key={n} value={n} disabled={!presets}>
                {n} agentes
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="controls">
        <button className="btn" type="button" onClick={onGenerate} disabled={busy || !hasDatabase || areas.length === 0}>
          {busy ? "Generando…" : "Generar empresa"}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
    </section>
  );
}
