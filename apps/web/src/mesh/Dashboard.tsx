import { useEffect, useState } from "react";
import { summarizeMonitoring, type MonitoringRun } from "@sandbox/shared";
import { fetchRun, listRuns } from "../api";
import { selectObservedRun } from "./runSelection";
import "./dashboard.css";

const number = (value: number | null, suffix = "") => value === null ? "—" : `${value.toLocaleString("es-CL", { maximumFractionDigits: 1 })}${suffix}`;
const statuses: Record<string, string> = { pending: "Pendiente", running: "En curso", completed: "Completada", failed: "Fallida", stopped: "Detenida" };

export function Dashboard({ onInspect }: { onInspect: () => void }) {
  const [snapshots, setSnapshots] = useState<MonitoringRun[]>([]);
  const [period, setPeriod] = useState("24");
  const [refreshKey, setRefreshKey] = useState(0);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [automatic, setAutomatic] = useState(true);
  const [onlyRisky, setOnlyRisky] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      setLoading(true);
      try {
        const runs = await listRuns();
        const start = period === "all" ? -Infinity : Date.now() - Number(period) * 3600000;
        const selected = runs.filter(run => Date.parse(run.createdAt) >= start).sort((first, second) => second.createdAt.localeCompare(first.createdAt));
        const results: MonitoringRun[] = [];
        let failed = 0;
        for (let index = 0; index < selected.length; index += 4) {
          if (cancelled) return;
          const batch = await Promise.allSettled(selected.slice(index, index + 4).map(run => fetchRun(run.id)));
          for (const result of batch) {
            if (result.status === "fulfilled") results.push(result.value);
            else failed += 1;
          }
        }
        if (!cancelled) {
          setSnapshots(results);
          setUpdated(new Date());
          setError(failed ? `${failed} ejecuciones no pudieron cargarse. Las métricas son parciales; actualiza para reintentar.` : "");
        }
      } catch {
        if (!cancelled) setError("No se pudo actualizar el monitoreo. Los datos visibles pueden estar desactualizados.");
      } finally { pending = false; if (!cancelled) setLoading(false); }
    }
    setSnapshots([]);
    setUpdated(null);
    void refresh();
    const timer = automatic ? window.setInterval(() => void refresh(), 10000) : undefined;
    return () => { cancelled = true; if (timer) window.clearInterval(timer); };
  }, [period, refreshKey, automatic]);

  const metrics = summarizeMonitoring(snapshots);
  const visibleRows = metrics.rows.filter(row => !onlyRisky || row.flagged);
  const chartRows = [...metrics.rows].reverse().slice(-20);
  const maximum = Math.max(1, ...chartRows.map(row => row.interactions));
  const severity = ["high", "medium", "low"].map(level => ({ level, count: snapshots.reduce((sum, snapshot) => sum + (snapshot.judgment?.risks.filter(risk => risk.severity === level).length ?? 0), 0) }));
  return <div className="monitor-dashboard">
    <div className="monitor-toolbar"><label>Período <select value={period} onChange={event => setPeriod(event.target.value)}><option value="24">Últimas 24 horas</option><option value="168">Últimos 7 días</option><option value="all">Todo el historial disponible</option></select></label><label><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} /> Actualizar cada 10 s</label><button className="btn ghost" disabled={loading} onClick={() => setRefreshKey(value => value + 1)}>{loading ? "Actualizando…" : "↻ Actualizar"}</button><span aria-live="polite">{updated ? `Actualizado: ${updated.toLocaleTimeString("es-CL")}` : "Sin datos actualizados"}</span></div>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="mesh-callout">Monitoreo de simulaciones registradas, no de tráfico de producción. El historial está en memoria y se pierde al reiniciar la API. Las ejecuciones activas aportan datos parciales; una ejecución sin evaluación no equivale a una ejecución segura.</div>
    <div className="monitor-kpis">{[
      ["Interacciones registradas", number(metrics.interactions), `${metrics.messages} mensajes · ${metrics.tools} llamadas`, "cyan"],
      ["Promedio por ejecución", number(metrics.average), `${snapshots.length} ejecuciones en el período`, "blue"],
      ["Interacciones de riesgo observado", number(metrics.risky), "Intentos peligrosos o bloqueados en sandbox", "red"],
      ["Ejecuciones con señales de riesgo", number(metrics.riskyRate, "%"), `${metrics.riskyRuns} de ${snapshots.length} · traza o evaluador`, "amber"],
      ["Intentos bloqueados", number(metrics.blocked), "Bloqueados por el entorno de pruebas", "purple"],
      ["Puntaje medio del evaluador", number(metrics.score, " / 10"), `${metrics.judged} de ${snapshots.length} ejecuciones con puntaje`, "cyan"],
    ].map(([label, value, hint, tone]) => <article className={`monitor-kpi ${tone}`} key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>)}</div>
    <div className="monitor-charts"><section className="mesh-graph-card"><div className="mesh-card-header"><div><h2>Volumen de interacciones por ejecución</h2><span>Últimas 20, de más antigua a más reciente · selecciona una barra</span></div></div>{chartRows.length ? <div className="monitor-bars">{chartRows.map(row => <button key={row.run.id} title={`${row.run.id}: ${row.interactions} interacciones; ${row.risky} intentos de riesgo`} onClick={() => { selectObservedRun(row.run.id); onInspect(); }} aria-label={`Explorar ejecución ${row.run.id}: ${row.interactions} interacciones`}><span className="monitor-bar-value">{row.interactions}</span><span className={`monitor-bar ${row.flagged ? "flagged" : ""}`} style={{ height: `${Math.max(2, row.interactions / maximum * 160)}px` }} /><small>{new Date(row.run.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</small></button>)}</div> : <div className="mesh-empty">{loading ? "Cargando ejecuciones…" : "No hay ejecuciones en este período. Inicia una simulación para ver métricas."}</div>}<footer className="mesh-legend">Turquesa: sin señales registradas · Rojo: con señales de riesgo (no implica ataque exitoso).</footer></section>
    <section className="mesh-graph-card"><div className="mesh-card-header"><div><h2>Hallazgos del evaluador de IA</h2><span>{metrics.judged} ejecuciones evaluadas · {metrics.findings} hallazgos</span></div></div><div className="monitor-severity">{severity.map(item => <div key={item.level}><span>{{ high: "Alta", medium: "Media", low: "Baja" }[item.level]} severidad</span><strong>{item.count}</strong><progress aria-label={`Hallazgos de severidad ${item.level}`} value={item.count} max={Math.max(1, metrics.findings)} /></div>)}<p>Son hallazgos del evaluador, no un conteo de mensajes peligrosos. No se suman a los intentos observados.</p><p>Duración media finalizada: <strong>{number(metrics.duration === null ? null : metrics.duration / 1000, " s")}</strong></p><p>En curso: {metrics.rows.filter(row => row.run.status === "running" || row.run.status === "pending").length} · Fallidas: {metrics.rows.filter(row => row.run.status === "failed").length}</p></div></section></div>
    <section className="mesh-graph-card"><div className="mesh-card-header"><div><h2>Detalle de ejecuciones</h2><span>Inspecciona la evidencia detrás de cada indicador</span></div><label className="monitor-risk-filter"><input type="checkbox" checked={onlyRisky} onChange={event => setOnlyRisky(event.target.checked)} /> Solo con señales de riesgo</label></div><div className="monitor-table-scroll"><table className="monitor-table"><thead><tr>{["Ejecución", "Estado", "Interacciones", "Riesgo observado", "Bloqueos", "Hallazgos IA", "Puntaje", "Evidencia"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{visibleRows.map(row => <tr key={row.run.id}><td><strong>{row.run.id}</strong><small>{new Date(row.run.createdAt).toLocaleString("es-CL")}</small></td><td>{statuses[row.run.status] ?? row.run.status}</td><td>{row.interactions}</td><td className={row.risky ? "monitor-danger" : ""}>{row.risky}</td><td>{row.blocked}</td><td>{row.judgment ? row.findings : "Sin evaluar"}</td><td>{number(row.judgment?.score ?? null)}</td><td><button className="btn ghost" onClick={() => { selectObservedRun(row.run.id); onInspect(); }}>Explorar →</button></td></tr>)}</tbody></table>{!visibleRows.length && <p className="mesh-empty">{loading ? "Cargando…" : "Sin ejecuciones que coincidan con los filtros."}</p>}</div></section>
    <details className="monitor-definitions"><summary>¿Cómo se calculan las métricas?</summary><p>Interacciones = mensajes enviados + llamadas a herramientas. Se excluyen mensajes recibidos y se deduplican eventos por ID. Promedio = interacciones / ejecuciones cargadas, incluidas las activas. Riesgo observado = eventos sandbox.tool_attempt marcados como peligrosos o bloqueados. Porcentaje con señales = ejecuciones con al menos un intento de riesgo o hallazgo de IA / ejecuciones cargadas. El puntaje medio solo usa ejecuciones con puntaje; no es una tasa de seguridad ni de éxito de ataques. La duración media solo usa ejecuciones finalizadas.</p></details>
  </div>;
}
