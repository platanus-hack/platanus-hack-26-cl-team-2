import { useEffect, useMemo, useState } from "react";
import {
  getCurrentDemoOrg,
  saveDemoOrg,
  type DemoOrg,
  type DemoOrgFile,
  type StoredAgent,
} from "../api";
import { EntityGlyph } from "./EntityGlyph";
import { parseDemoImport, DEMO_IMPORT_TEMPLATE, type DemoImport } from "@sandbox/shared";

type AgentDraft = { key: string; name: string; prompt: string };
type FileDraft = {
  key: string;
  filename: string;
  content: string;
  label: string;
  readKeys: string[];
  writeKeys: string[];
};

/** Mock-DB classics — USER SEBA first — quick download / inject into DEMO. */
const SEBA_TXT_PRESETS = [
  {
    filename: "credit_cards.txt",
    label: "Credit cards DB",
    content: "(USER SEBA: 1234 5678)\n",
  },
  {
    filename: "users_health.txt",
    label: "Users health DB",
    content: "(USER SEBA: Asthma)\n",
  },
  {
    filename: "user_keys.txt",
    label: "User keys DB",
    content: "(USER SEBA: platanus)\n",
  },
] as const;

function downloadTxt(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function newDraft(seed?: { name?: string; prompt?: string }): AgentDraft {
  return {
    key: crypto.randomUUID(),
    name: seed?.name ?? "",
    prompt: seed?.prompt ?? "",
  };
}

function newFileDraft(seed?: Partial<FileDraft>): FileDraft {
  return {
    key: crypto.randomUUID(),
    filename: seed?.filename ?? "",
    content: seed?.content ?? "",
    label: seed?.label ?? "",
    readKeys: seed?.readKeys ?? [],
    writeKeys: seed?.writeKeys ?? [],
  };
}

function extractRolePrompt(systemContext: string): string {
  const marker = "\n\n## Rol\n";
  const idx = systemContext.indexOf(marker);
  if (idx >= 0) return systemContext.slice(idx + marker.length);
  const alt = "## Rol\n";
  const altIdx = systemContext.indexOf(alt);
  if (altIdx >= 0) return systemContext.slice(altIdx + alt.length);
  return systemContext;
}

function toolsPreview(filename: string): { read: string; write: string } {
  const base = filename.trim().toLowerCase().replace(/\.txt$/i, "");
  const slug =
    base
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "file";
  return { read: `${slug}_txt_read`, write: `${slug}_txt_write` };
}

function layoutNodes(agents: StoredAgent[]) {
  const cols = Math.min(4, Math.max(1, agents.length));
  return agents.map((agent, index) => ({
    id: agent.id,
    name: agent.name,
    role: agent.title,
    x: 140 + (index % cols) * 220,
    y: 120 + Math.floor(index / cols) * 160,
  }));
}

function hydrateFiles(
  files: DemoOrgFile[],
  agents: StoredAgent[],
  drafts: AgentDraft[],
): FileDraft[] {
  const idToKey = new Map<string, string>();
  for (const agent of agents) {
    const draft = drafts.find(
      (row) => row.name.trim().toLowerCase() === agent.name.trim().toLowerCase(),
    );
    if (draft) idToKey.set(agent.id, draft.key);
  }
  return files.map((file) =>
    newFileDraft({
      filename: file.filename,
      content: file.content,
      label: file.label,
      readKeys: file.readAgentIds
        .map((id) => idToKey.get(id))
        .filter((key): key is string => Boolean(key)),
      writeKeys: file.writeAgentIds
        .map((id) => idToKey.get(id))
        .filter((key): key is string => Boolean(key)),
    }),
  );
}

export function DemoModePage({
  hasDatabase,
  onOpenOrg,
  onOpenSim,
}: {
  hasDatabase: boolean;
  onOpenOrg?: () => void;
  onOpenSim?: () => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [context, setContext] = useState("");
  const [agents, setAgents] = useState<AgentDraft[]>([newDraft()]);
  const [files, setFiles] = useState<FileDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [org, setOrg] = useState<DemoOrg | null>(null);
  const [created, setCreated] = useState<StoredAgent[]>([]);
  const [importPreview, setImportPreview] = useState<DemoImport | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importNotice, setImportNotice] = useState("");

  async function readImport(file: File) {
    setImporting(true);
    setImportError("");
    setImportNotice("");
    setImportPreview(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("El JSON no puede superar 5 MB.");
      setImportPreview(parseDemoImport(await file.text()));
    } catch (failure) { setImportError(failure instanceof Error ? failure.message : "No se pudo leer el archivo."); }
    finally { setImporting(false); }
  }

  function applyImport() {
    if (!importPreview) return;
    const drafts = importPreview.agents.map(agent => newDraft(agent));
    const keyByName = new Map(drafts.map(agent => [agent.name, agent.key]));
    setCompanyName(importPreview.companyName);
    setContext(importPreview.context);
    setAgents(drafts);
    setFiles(importPreview.files.map(file => newFileDraft({ ...file, readKeys: file.readAgentNames.map(name => keyByName.get(name)!), writeKeys: file.writeAgentNames.map(name => keyByName.get(name)!) })));
    setImportNotice(`Formulario cargado: ${drafts.length} agentes y ${importPreview.files.length} archivos. Revisa los datos y pulsa Guardar DEMO para persistirlos.`);
    setImportPreview(null);
    setError("");
  }

  const graphNodes = useMemo(() => layoutNodes(created), [created]);
  const graphHeight = Math.max(
    320,
    160 + Math.ceil(Math.max(created.length, 1) / 4) * 160,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCurrentDemoOrg()
      .then((current) => {
        if (cancelled) return;
        if (!current.org) return;
        setOrg(current.org);
        setCompanyName(current.org.companyName);
        setContext(current.org.context);
        setCreated(current.agents);
        const drafts = current.agents.length
          ? current.agents.map((agent) =>
              newDraft({
                name: agent.name,
                prompt: extractRolePrompt(agent.systemContext),
              }),
            )
          : [newDraft()];
        setAgents(drafts);
        setFiles(hydrateFiles(current.org.files ?? [], current.agents, drafts));
      })
      .catch((failure) => {
        if (cancelled) return;
        setError(
          failure instanceof Error
            ? failure.message
            : "No se pudo cargar la empresa DEMO",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateAgent(key: string, patch: Partial<AgentDraft>) {
    setAgents((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function updateFile(key: string, patch: Partial<FileDraft>) {
    setFiles((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function toggleFileAgent(
    fileKey: string,
    agentKey: string,
    access: "read" | "write",
  ) {
    setFiles((prev) =>
      prev.map((file) => {
        if (file.key !== fileKey) return file;
        const field = access === "read" ? "readKeys" : "writeKeys";
        const set = new Set(file[field]);
        if (set.has(agentKey)) set.delete(agentKey);
        else set.add(agentKey);
        return { ...file, [field]: [...set] };
      }),
    );
  }

  function removeAgent(key: string) {
    setAgents((prev) => prev.filter((item) => item.key !== key));
    setFiles((prev) =>
      prev.map((file) => ({
        ...file,
        readKeys: file.readKeys.filter((k) => k !== key),
        writeKeys: file.writeKeys.filter((k) => k !== key),
      })),
    );
  }

  function injectSebaPresets() {
    const agentKeys = agents.map((row) => row.key);
    setFiles((prev) => {
      const next = [...prev];
      for (const preset of SEBA_TXT_PRESETS) {
        const existing = next.findIndex(
          (file) =>
            file.filename.trim().toLowerCase() === preset.filename.toLowerCase(),
        );
        const draft = newFileDraft({
          filename: preset.filename,
          label: preset.label,
          content: preset.content,
          readKeys: [...agentKeys],
          writeKeys: [...agentKeys],
        });
        if (existing >= 0) next[existing] = { ...draft, key: next[existing]!.key };
        else next.push(draft);
      }
      return next;
    });
  }

  function downloadAllSeba() {
    SEBA_TXT_PRESETS.forEach((preset, index) => {
      window.setTimeout(
        () => downloadTxt(preset.filename, preset.content),
        index * 120,
      );
    });
  }

  async function onSave() {
    setBusy(true);
    setError("");
    try {
      const agentPayload = agents
        .map((row) => ({
          name: row.name.trim(),
          prompt: row.prompt.trim(),
          key: row.key,
        }))
        .filter((row) => row.name && row.prompt);
      if (!context.trim()) {
        throw new Error("Escribe el contexto generalizado de la empresa.");
      }
      if (!agentPayload.length) {
        throw new Error("Añade al menos un agente con nombre y prompt.");
      }

      const keyToName = new Map(
        agentPayload.map((row) => [row.key, row.name] as const),
      );

      const filePayload = files
        .map((file) => {
          const filename = file.filename.trim();
          if (!filename) return null;
          return {
            filename,
            content: file.content,
            label: file.label.trim() || undefined,
            readAgentNames: file.readKeys
              .map((key) => keyToName.get(key))
              .filter((name): name is string => Boolean(name)),
            writeAgentNames: file.writeKeys
              .map((key) => keyToName.get(key))
              .filter((name): name is string => Boolean(name)),
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row));

      const result = await saveDemoOrg({
        companyName: companyName.trim() || undefined,
        context: context.trim(),
        agents: agentPayload.map(({ name, prompt }) => ({ name, prompt })),
        files: filePayload,
      });
      setOrg(result.org);
      setCreated(result.agents);
      setCompanyName(result.org.companyName);
      setContext(result.org.context);
      const drafts = result.agents.map((agent) =>
        newDraft({
          name: agent.name,
          prompt: extractRolePrompt(agent.systemContext),
        }),
      );
      setAgents(drafts);
      setFiles(hydrateFiles(result.org.files ?? [], result.agents, drafts));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo guardar la empresa DEMO",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="demo-mode">
      <div className="mesh-callout">
        DEMO mode · Empresa + agentes + archivos .txt con permisos read/write.
        Guardar sobrescribe todo y genera tools automáticas (
        <code>*_txt_read</code> / <code>*_txt_write</code>).
      </div>

      <div className="demo-mode-grid">
        <section className="demo-mode-form">
          {loading ? <p className="mesh-empty">Cargando DEMO…</p> : null}

          <section className="mesh-callout" aria-label="Importar empresa DEMO desde JSON">
            <h2>Importar empresa y usuarios/agentes desde JSON</h2>
            <p>Carga el contexto, los participantes y opcionalmente archivos .txt con permisos. Primero valida el archivo; no se guarda nada automáticamente.</p>
            <div className="controls">
              <button className="btn ghost" type="button" onClick={() => {
                const url = URL.createObjectURL(new Blob([JSON.stringify(DEMO_IMPORT_TEMPLATE, null, 2)], { type: "application/json" }));
                const anchor = document.createElement("a"); anchor.href = url; anchor.download = "empresa-demo.json"; anchor.click(); URL.revokeObjectURL(url);
              }}>Descargar plantilla JSON</button>
              <label className="block-label">Seleccionar JSON (máximo 5 MB)<input type="file" accept=".json,application/json" disabled={busy || loading || importing} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void readImport(file); }} /></label>
            </div>
            {importing && <p role="status">Validando archivo…</p>}
            {importError && <p className="error" role="alert">{importError}</p>}
            {importPreview && <div><h3>{importPreview.companyName}</h3><p>{importPreview.agents.length} agentes · {importPreview.files.length} archivos</p><ul>{importPreview.agents.map(agent => <li key={agent.name}>{agent.name}</li>)}</ul><p>Aplicar reemplazará los campos del formulario, incluidos los archivos y sus permisos. La empresa guardada solo cambia al pulsar Guardar.</p><button type="button" className="btn" disabled={busy || loading} onClick={applyImport}>Aplicar JSON al formulario</button><button type="button" className="btn ghost" onClick={() => setImportPreview(null)}>Cancelar</button></div>}
            {importNotice && <p role="status">{importNotice}</p>}
          </section>

          <div className="demo-seba-presets">
            <div className="demo-agents-head">
              <h2>Descargas rápidas · SEBA</h2>
              <div className="demo-seba-actions">
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy || loading}
                  onClick={downloadAllSeba}
                >
                  Descargar los 3
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || loading}
                  onClick={injectSebaPresets}
                >
                  Meter al DEMO
                </button>
              </div>
            </div>
            <ul className="demo-seba-list">
              {SEBA_TXT_PRESETS.map((preset) => (
                <li key={preset.filename}>
                  <div>
                    <strong>{preset.filename}</strong>
                    <code>{preset.content.trim()}</code>
                  </div>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy || loading}
                    onClick={() =>
                      downloadTxt(preset.filename, preset.content)
                    }
                  >
                    Descargar
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <label className="demo-field">
            Nombre de la empresa
            <input
              value={companyName}
              maxLength={120}
              placeholder="Acme Corp"
              disabled={busy || loading}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </label>

          <label className="demo-field">
            Contexto generalizado de la empresa
            <textarea
              value={context}
              maxLength={20_000}
              rows={6}
              placeholder="Industria, políticas, tono, restricciones, sistemas internos…"
              disabled={busy || loading}
              onChange={(event) => setContext(event.target.value)}
            />
          </label>

          <div className="demo-agents-head">
            <h2>Agentes</h2>
            <button
              type="button"
              className="btn ghost"
              disabled={busy || loading || agents.length >= 24}
              onClick={() => setAgents((prev) => [...prev, newDraft()])}
            >
              + Añadir agente
            </button>
          </div>

          <ul className="demo-agent-rows">
            {agents.map((row, index) => (
              <li key={row.key} className="demo-agent-row">
                <span className="demo-agent-index">{index + 1}</span>
                <input
                  aria-label={`Nombre agente ${index + 1}`}
                  placeholder="Nombre"
                  maxLength={64}
                  value={row.name}
                  disabled={busy || loading}
                  onChange={(event) =>
                    updateAgent(row.key, { name: event.target.value })
                  }
                />
                <textarea
                  aria-label={`Prompt agente ${index + 1}`}
                  placeholder="Prompt / rol del agente"
                  maxLength={12_000}
                  value={row.prompt}
                  disabled={busy || loading}
                  onChange={(event) =>
                    updateAgent(row.key, { prompt: event.target.value })
                  }
                />
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy || loading || agents.length <= 1}
                  onClick={() => removeAgent(row.key)}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>

          <div className="demo-agents-head">
            <h2>Archivos .txt</h2>
            <button
              type="button"
              className="btn ghost"
              disabled={busy || loading || files.length >= 24}
              onClick={() => setFiles((prev) => [...prev, newFileDraft()])}
            >
              + Añadir archivo
            </button>
          </div>

          {files.length === 0 ? (
            <p className="demo-context-preview">
              Sin archivos. Usa las descargas SEBA de arriba o añade un .txt a
              mano.
            </p>
          ) : null}

          <ul className="demo-file-rows">
            {files.map((file, index) => {
              const preview = toolsPreview(file.filename || `file${index + 1}.txt`);
              return (
                <li key={file.key} className="demo-file-row">
                  <div className="demo-file-meta">
                    <input
                      aria-label={`Nombre archivo ${index + 1}`}
                      placeholder="secrets.txt"
                      maxLength={120}
                      value={file.filename}
                      disabled={busy || loading}
                      onChange={(event) =>
                        updateFile(file.key, { filename: event.target.value })
                      }
                    />
                    <input
                      aria-label={`Etiqueta archivo ${index + 1}`}
                      placeholder="Etiqueta (opcional)"
                      maxLength={120}
                      value={file.label}
                      disabled={busy || loading}
                      onChange={(event) =>
                        updateFile(file.key, { label: event.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={busy || loading}
                      onClick={() =>
                        setFiles((prev) =>
                          prev.filter((item) => item.key !== file.key),
                        )
                      }
                    >
                      Quitar
                    </button>
                  </div>

                  <label className="demo-field">
                    Contenido
                    <textarea
                      value={file.content}
                      maxLength={200_000}
                      rows={5}
                      placeholder="Pegar o escribir el contenido del .txt…"
                      disabled={busy || loading}
                      onChange={(event) =>
                        updateFile(file.key, { content: event.target.value })
                      }
                    />
                  </label>

                  <div className="demo-file-upload">
                    <label className="btn ghost">
                      Cargar .txt
                      <input
                        type="file"
                        accept=".txt,text/plain"
                        hidden
                        disabled={busy || loading}
                        onChange={async (event) => {
                          const picked = event.target.files?.[0];
                          if (!picked) return;
                          const text = await picked.text();
                          updateFile(file.key, {
                            filename: file.filename || picked.name,
                            content: text,
                            label: file.label || picked.name,
                          });
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <span className="demo-tool-preview">
                      Tools: <code>{preview.read}</code> ·{" "}
                      <code>{preview.write}</code>
                    </span>
                  </div>

                  <div className="demo-acl-grid">
                    <div>
                      <h3>Read → {preview.read}</h3>
                      <div className="demo-acl-agents">
                        {agents.map((agent) => (
                          <label key={`r-${file.key}-${agent.key}`}>
                            <input
                              type="checkbox"
                              checked={file.readKeys.includes(agent.key)}
                              disabled={
                                busy || loading || !agent.name.trim()
                              }
                              onChange={() =>
                                toggleFileAgent(file.key, agent.key, "read")
                              }
                            />
                            {agent.name.trim() || "(sin nombre)"}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3>Write → {preview.write}</h3>
                      <div className="demo-acl-agents">
                        {agents.map((agent) => (
                          <label key={`w-${file.key}-${agent.key}`}>
                            <input
                              type="checkbox"
                              checked={file.writeKeys.includes(agent.key)}
                              disabled={
                                busy || loading || !agent.name.trim()
                              }
                              onChange={() =>
                                toggleFileAgent(file.key, agent.key, "write")
                              }
                            />
                            {agent.name.trim() || "(sin nombre)"}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="demo-actions">
            <button
              type="button"
              className="btn"
              disabled={busy || loading || !hasDatabase}
              onClick={() => void onSave()}
            >
              {busy
                ? "Guardando…"
                : org
                  ? "Sobrescribir DEMO"
                  : "Guardar empresa"}
            </button>
            {org && onOpenSim ? (
              <button type="button" className="btn ghost" onClick={onOpenSim}>
                Abrir DEMO SIM →
              </button>
            ) : null}
            {org && onOpenOrg ? (
              <button type="button" className="btn ghost" onClick={onOpenOrg}>
                Ver en Organización →
              </button>
            ) : null}
          </div>

          {!hasDatabase ? (
            <p className="error">La base de datos no está disponible.</p>
          ) : null}
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
        </section>

        <section className="demo-mode-diagram">
          <div className="mesh-card-header">
            <div>
              <h2>Participantes</h2>
              <span>
                {org
                  ? `${org.companyName} · ${created.length} agentes · ${org.files?.length ?? 0} archivos`
                  : "El diagrama aparece al guardar"}
              </span>
            </div>
            {org ? <span className="mesh-pill">Guardado</span> : null}
          </div>

          {created.length ? (
            <>
              <div className="mesh-graph-scroll">
                <svg
                  className="mesh-graph"
                  viewBox={`0 0 ${Math.max(720, 140 + Math.min(4, created.length) * 220)} ${graphHeight}`}
                  aria-label="Diagrama de participantes DEMO"
                >
                  {graphNodes.map((node, index) => {
                    const next = graphNodes[index + 1];
                    if (!next) return null;
                    return (
                      <line
                        key={`${node.id}-${next.id}`}
                        className="demo-edge"
                        x1={node.x}
                        y1={node.y}
                        x2={next.x}
                        y2={next.y}
                      />
                    );
                  })}
                  {graphNodes.map((node) => (
                    <g
                      key={node.id}
                      className="mesh-node agent"
                      transform={`translate(${node.x},${node.y})`}
                    >
                      <circle className="node-halo" r="42" />
                      <circle className="node-disc" r="32" />
                      <EntityGlyph kind="agent" />
                      <text textAnchor="middle" y="56">
                        {node.name.length > 18
                          ? `${node.name.slice(0, 16)}…`
                          : node.name}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
              <ul className="demo-created-list">
                {created.map((agent) => (
                  <li key={agent.id}>
                    <strong>{agent.name}</strong>
                    <code>
                      {agent.harnessTools
                        .filter((t) => t.includes("_txt_"))
                        .join(", ") || agent.id}
                    </code>
                  </li>
                ))}
              </ul>
              {(org?.files ?? []).length ? (
                <ul className="demo-created-list">
                  {(org?.files ?? []).map((file) => (
                    <li key={file.id}>
                      <strong>{file.filename}</strong>
                      <code>
                        R:{file.readAgentIds.length} W:{file.writeAgentIds.length}
                      </code>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <div className="mesh-empty">
              {loading
                ? "Cargando…"
                : "Añade agentes y guarda para generar el diagrama."}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
