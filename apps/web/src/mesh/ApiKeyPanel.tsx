import { useState } from "react";
import { clearUserApiKey, getUserApiKey, isAnthropicKey, setUserApiKey } from "../userApiKey";

/**
 * Small sidebar panel where a visitor pastes their own Anthropic API key, so runs, judge and
 * evaluations use (and bill) their key. It stays in this browser; `onChange` lets the app re-read
 * whether a key is available.
 */
export function ApiKeyPanel({ serverHasKey, onChange }: { serverHasKey: boolean; onChange: () => void }) {
  const [saved, setSaved] = useState(getUserApiKey());
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  function save(event: React.FormEvent) {
    event.preventDefault();
    const key = draft.trim();
    if (!isAnthropicKey(key)) {
      setError("Debe empezar con sk-ant- (cópiala desde console.anthropic.com).");
      return;
    }
    if (!setUserApiKey(key)) {
      setError("Este navegador no permite guardarla (modo privado o almacenamiento bloqueado).");
      return;
    }
    setSaved(key);
    setDraft("");
    setError("");
    onChange();
  }

  function forget() {
    clearUserApiKey();
    setSaved("");
    onChange();
  }

  return (
    <div className="mesh-apikey">
      <p className="mesh-apikey-title">Tu API key de Claude</p>
      {saved ? (
        <div className="mesh-apikey-saved">
          <span>
            Usando la tuya <code>sk-ant-…{saved.slice(-4)}</code>
          </span>
          <button type="button" className="mesh-apikey-btn" onClick={forget}>
            Quitar
          </button>
        </div>
      ) : (
        <form className="mesh-apikey-form" onSubmit={save}>
          <input
            id="mesh-apikey-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-…"
            aria-label="API key de Anthropic"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setError("");
            }}
          />
          <button type="submit" className="mesh-apikey-btn" disabled={!draft.trim()}>
            Guardar
          </button>
        </form>
      )}
      {error ? <small className="mesh-apikey-error" role="alert">{error}</small> : null}
      <small className="mesh-apikey-note">
        {saved
          ? "Se guarda solo en este navegador. Las ejecuciones se cobran a tu cuenta."
          : serverHasKey
            ? "Opcional: sin ella se usa la key del servidor."
            : "Sin key no se pueden lanzar agentes. Se guarda solo en este navegador."}
      </small>
    </div>
  );
}
