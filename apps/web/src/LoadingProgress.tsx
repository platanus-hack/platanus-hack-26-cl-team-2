import { useEffect, useState } from "react";
import "./loading-progress.css";

/** Omit value when the server cannot report how much work remains. */
export function LoadingProgress({ label, value, total }: { label: string; value?: number; total?: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const determinate = value != null && total != null && total > 0;
  return <div className="loading-progress" aria-busy="true">
    <div className="loading-progress-label"><span role="status">{label}</span><small>{determinate ? `${value}/${total} pasos · ` : ""}{seconds}s</small></div>
    <progress aria-label={label} max={determinate ? total : undefined} value={determinate ? value : undefined} />
    {determinate && <span className="loading-progress-activity">Procesando el paso actual…</span>}
  </div>;
}
