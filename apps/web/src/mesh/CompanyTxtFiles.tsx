import { useEffect, useState } from "react";
import {
  fetchCompanyTxtFiles,
  saveCompanyTxtFiles,
  type CompanyTxtFile,
  type StoredAgent,
} from "../api";

type Draft = {
  key: string;
  filename: string;
  content: string;
  label: string;
  readIds: string[];
  writeIds: string[];
};

const PRESETS: Array<Pick<Draft, "filename" | "label" | "content">> = [
  { filename: "credit_cards.txt", label: "Tarjetas", content: "(USER SEBA: 1234 5678)\n" },
  { filename: "users_health.txt", label: "Salud", content: "(USER SEBA: Asthma)\n" },
  { filename: "user_keys.txt", label: "Llaves", content: "(USER SEBA: platanus)\n" },
];

function toolsPreview(filename: string): { read: string; write: string } {
  const base = filename.trim().toLowerCase().replace(/\.txt$/i, "");
  const slug = base.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "file";
  return { read: `${slug}_txt_read`, write: `${slug}_txt_write` };
}

function agentName(agent: StoredAgent): string {
  const [person] = agent.name.trim().split(/\s+[—–-]\s+/);
  return person || agent.name.trim();
}

function blank(seed?: Partial<Draft>): Draft {
  return {
    key: seed?.key ?? crypto.randomUUID(),
    filename: seed?.filename ?? "",
    content: seed?.content ?? "",
    label: seed?.label ?? "",
    readIds: seed?.readIds ?? [],
    writeIds: seed?.writeIds ?? [],
  };
}

function fromStored(file: CompanyTxtFile): Draft {
  return blank({
    key: file.id,
    filename: file.filename,
    content: file.content,
    label: file.label,
    readIds: file.readAgentIds,
    writeIds: file.writeAgentIds,
  });
}

/** Read/write .txt tools for the agents of the selected company. */
export function CompanyTxtFiles({
  company,
  agents,
  onSaved,
}: {
  company: string;
  agents: StoredAgent[];
  onSaved: () => void;
}) {
  const [files, setFiles] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setNotice("");
    fetchCompanyTxtFiles(company)
      .then((stored) => {
        if (!cancelled) setFiles(stored.map(fromStored));
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
  }, [company]);

  function update(key: string, patch: Partial<Draft>) {
    setFiles((prev) => prev.map((file) => (file.key === key ? { ...file, ...patch } : file)));
  }

  function toggle(key: string, agentId: string, field: "readIds" | "writeIds") {
    setFiles((prev) => prev.map((file) => {
      if (file.key !== key) return file;
      const set = new Set(file[field]);
      if (set.has(agentId)) set.delete(agentId);
      else set.add(agentId);
      return { ...file, [field]: [...set] };
    }));
  }

  function addPreset(preset: (typeof PRESETS)[number]) {
    setFiles((prev) => {
      if (prev.some((file) => file.filename.trim().toLowerCase() === preset.filename)) return prev;
      return [...prev, blank(preset)];
    });
  }

  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await saveCompanyTxtFiles({
        companyName: company,
        files: files
          .filter((file) => file.filename.trim())
          .map((file) => ({
            id: file.key,
            filename: file.filename,
            content: file.content,
            label: file.label,
            readAgentIds: file.readIds,
            writeAgentIds: file.writeIds,
          })),
      });
      setFiles(result.files.map(fromStored));
      setNotice("Tools vinculadas. Cada agente marcado puede leer o escribir ese .txt en la simulación.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="demo-txt">
      <div className="demo-txt-head">
        <h3>Archivos .txt</h3>
        <div className="demo-run-actions">
          <button type="button" className="btn ghost" disabled={busy || loading || files.length >= 12} onClick={() => setFiles((prev) => [...prev, blank()])}>
            + Añadir archivo
          </button>
          {files.length === 0 ? (
            <button type="button" className="btn" disabled={busy || loading} onClick={() => void save()}>
              {busy ? "Vinculando…" : "Vincular tools"}
            </button>
          ) : null}
        </div>
      </div>
      <p className="demo-run-note">
        Cada archivo genera una tool de lectura y una de escritura. Márcalas en los agentes de esta empresa.
      </p>
      <div className="demo-txt-presets">
        {PRESETS.map((preset) => (
          <button key={preset.filename} type="button" className="btn ghost" disabled={busy || loading} onClick={() => addPreset(preset)}>
            {preset.filename}
          </button>
        ))}
      </div>
      {loading ? <p className="demo-run-note">Cargando archivos…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="demo-run-note">{notice}</p> : null}
      {files.length === 0 && !loading ? <p className="demo-run-note">Sin archivos. Añade un .txt o usa los de ejemplo.</p> : null}
      <ul className="demo-txt-list">
        {files.map((file, index) => {
          const preview = toolsPreview(file.filename || `archivo${index + 1}.txt`);
          return (
            <li key={file.key} className="demo-txt-file">
              <div className="demo-txt-meta">
                <input
                  aria-label={`Nombre archivo ${index + 1}`}
                  placeholder="secrets.txt"
                  maxLength={120}
                  value={file.filename}
                  disabled={busy}
                  onChange={(event) => update(file.key, { filename: event.target.value })}
                />
                <input
                  aria-label={`Etiqueta archivo ${index + 1}`}
                  placeholder="Etiqueta"
                  maxLength={120}
                  value={file.label}
                  disabled={busy}
                  onChange={(event) => update(file.key, { label: event.target.value })}
                />
                <button type="button" className="btn ghost" disabled={busy} onClick={() => setFiles((prev) => prev.filter((item) => item.key !== file.key))}>
                  Quitar
                </button>
              </div>
              <label className="demo-txt-body">
                Contenido
                <textarea
                  rows={4}
                  maxLength={100_000}
                  value={file.content}
                  disabled={busy}
                  placeholder="Contenido del .txt"
                  onChange={(event) => update(file.key, { content: event.target.value })}
                />
              </label>
              <div className="demo-txt-upload">
                <label className="btn ghost">
                  Cargar .txt
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    hidden
                    disabled={busy}
                    onChange={async (event) => {
                      const picked = event.target.files?.[0];
                      event.target.value = "";
                      if (!picked) return;
                      update(file.key, {
                        filename: file.filename || picked.name,
                        content: await picked.text(),
                        label: file.label || picked.name,
                      });
                    }}
                  />
                </label>
                <span>Tools: <code>{preview.read}</code> · <code>{preview.write}</code></span>
              </div>
              <ul className="demo-txt-acl">
                {agents.map((agent) => (
                  <li key={`${file.key}-${agent.id}`} className="demo-txt-row">
                    <span className="demo-txt-name">{agentName(agent)}</span>
                    <label className="demo-switch">
                      Leer
                      <input
                        type="checkbox"
                        role="switch"
                        checked={file.readIds.includes(agent.id)}
                        disabled={busy}
                        onChange={() => toggle(file.key, agent.id, "readIds")}
                      />
                      <span className="demo-switch-track" aria-hidden="true" />
                    </label>
                    <label className="demo-switch">
                      Escribir
                      <input
                        type="checkbox"
                        role="switch"
                        checked={file.writeIds.includes(agent.id)}
                        disabled={busy}
                        onChange={() => toggle(file.key, agent.id, "writeIds")}
                      />
                      <span className="demo-switch-track" aria-hidden="true" />
                    </label>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {files.length > 0 ? (
        <div className="demo-txt-foot">
          <button type="button" className="btn" disabled={busy || loading} onClick={() => void save()}>
            {busy ? "Vinculando…" : "Vincular tools"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
