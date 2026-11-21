import type {
  AgentKnobs,
  BatchResults,
  AgentProfile,
  AreaHeadcount,
  AreaId,
  AreaPrototype,
  CreateRunRequest,
  CreateStoredRunRequest,
  EmailScenarioSummary,
  OrgHints,
  OrgSizePreset,
  RunAudit,
  RiskPathAnalysis,
  RunEvaluation,
  RunRiskPaths,
  RunSummary,
  SeniorityMix,
  TraceEvent,
} from "@sandbox/shared";

export type StoredAgent = AgentProfile & {
  harnessTools: string[];
  harnessModel: string | null;
  contextFiles: Array<{
    id: string;
    agentId: string;
    name: string;
    kind: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  }>;
  updatedAt: string;
};

/**
 * Writes that change the shared agent store need x-admin-token when the API has ADMIN_TOKEN
 * set (public demo). Locally there is no token and nothing is sent. Team members on the
 * deployed app: run localStorage.setItem("meshAdminToken", "<token>") in the browser console.
 */
function writeHeaders(json: boolean): Record<string, string> {
  const headers: Record<string, string> = json ? { "Content-Type": "application/json" } : {};
  try {
    const token = localStorage.getItem("meshAdminToken");
    if (token) headers["x-admin-token"] = token;
  } catch {
    // storage blocked: no token
  }
  return headers;
}

export async function fetchHealth(): Promise<{
  ok: boolean;
  hasApiKey: boolean;
  hasDatabase?: boolean;
  database?: { ok: boolean; error?: string };
  model: string;
  refineModel?: string;
}> {
  const res = await fetch("/health");
  if (!res.ok) throw new Error("No se puede acceder a la API");
  return res.json();
}

export async function createRun(
  body: CreateRunRequest,
): Promise<{ run: RunSummary }> {
  const res = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "No se pudo crear la ejecución");
  return data;
}

export async function createRunFromStored(
  body: CreateStoredRunRequest,
): Promise<{ run: RunSummary }> {
  const res = await fetch("/api/runs/from-stored", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "No se pudo crear la ejecución");
  return data;
}

export async function listEmailScenarios(): Promise<{
  dir?: string;
  scenarios: EmailScenarioSummary[];
  errors: string[];
}> {
  const res = await fetch("/api/email-scenarios");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load email scenarios");
  return data;
}

export type RunJudgment = {
  summary: string;
  decisions: string[];
  risks: Array<{
    title: string;
    why: string;
    severity: "low" | "medium" | "high";
  }>;
  governanceNotes: string;
  score: number;
  scoreRationale: string;
  model: string;
  audit?: RunAudit;
};

export async function judgeRun(
  runId: string,
): Promise<{ judgment: RunJudgment; evaluation: RunEvaluation; cached: boolean }> {
  // JSON content type is required on every POST (CSRF guard on the API).
  const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/judge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Falló la evaluación");
  return data;
}

export async function judgeTranscript(body: {
  transcript: string;
  scenario?: string;
  agentsNote?: string;
}): Promise<{ judgment: RunJudgment }> {
  const res = await fetch("/api/judge/transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: body.transcript.slice(0, 180_000),
      scenario: body.scenario?.slice(0, 7000),
      agentsNote: body.agentsNote?.slice(0, 7000),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const detail =
      typeof data.details === "object"
        ? ` ${JSON.stringify(data.details.fieldErrors ?? data.details)}`
        : "";
    throw new Error((data.error ?? "Falló la evaluación") + detail);
  }
  return data;
}

export async function fetchRun(runId: string): Promise<{
  run: RunSummary;
  events: TraceEvent[];
  judgment: RunJudgment | null;
  evaluation: RunEvaluation | null;
  riskPaths: RunRiskPaths | null;
}> {
  const res = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Ejecución no encontrada");
  return data;
}

/** MESH risk paths for a setup, before launching (no model call). */
export async function analyzeRiskPaths(
  body: Pick<CreateStoredRunRequest, "agentIds" | "seedAgentId" | "financeAgentIds" | "emailScenario">,
  signal?: AbortSignal,
): Promise<RiskPathAnalysis> {
  const res = await fetch("/api/risk-paths", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "No se pudo analizar las rutas de riesgo");
  return data.analysis;
}

export async function listRuns(): Promise<RunSummary[]> {
  const response = await fetch("/api/runs");
  if (!response.ok) throw new Error("No se pudieron cargar las ejecuciones");
  const data = await response.json();
  return data.runs;
}

export function subscribeRunEvents(
  runId: string,
  onEvent: (event: TraceEvent) => void,
  onError?: (err: Error) => void,
): () => void {
  const source = new EventSource(`/api/runs/${runId}/events`);

  source.addEventListener("trace", (msg) => {
    try {
      const event = JSON.parse((msg as MessageEvent).data) as TraceEvent;
      onEvent(event);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  });

  source.onerror = () => {
    // Browser reconnects automatically while the stream is alive.
  };

  return () => source.close();
}

export async function fetchAreas(): Promise<AreaPrototype[]> {
  const res = await fetch("/api/profiles/areas");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar las áreas");
  return data.areas as AreaPrototype[];
}

export async function composeProfile(body: {
  areaId: AreaId;
  knobs: AgentKnobs;
  name?: string;
  orgHints?: OrgHints;
  refine?: boolean;
}): Promise<{
  profile: AgentProfile;
  refineError?: string;
  refineModel?: string;
}> {
  const res = await fetch("/api/profiles/compose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Falló la generación del perfil");
  return data;
}

export async function refineProfile(
  profile: AgentProfile,
): Promise<{ profile: AgentProfile }> {
  const res = await fetch("/api/profiles/refine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Falló el refinamiento");
  return data;
}

export async function saveProfile(
  profile: AgentProfile,
): Promise<{ agent: StoredAgent }> {
  const res = await fetch("/api/profiles/save", {
    method: "POST",
    headers: writeHeaders(true),
    body: JSON.stringify({ profile }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
  return data;
}

export async function listAgents(): Promise<StoredAgent[]> {
  const res = await fetch("/api/agents");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "No se pudieron listar los agentes");
  return data.agents as StoredAgent[];
}

export async function deleteAgent(id: string): Promise<void> {
  const res = await fetch(`/api/agents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: writeHeaders(false),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo eliminar");
}

export async function addContextFile(
  agentId: string,
  body: { name: string; kind?: string; content: string },
): Promise<StoredAgent["contextFiles"][number]> {
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/context-files`, {
    method: "POST",
    headers: writeHeaders(true),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "No se pudo adjuntar el archivo de contexto");
  return data.file;
}

export async function removeContextFile(
  agentId: string,
  fileId: string,
): Promise<void> {
  const res = await fetch(
    `/api/agents/${encodeURIComponent(agentId)}/context-files/${encodeURIComponent(fileId)}`,
    { method: "DELETE", headers: writeHeaders(false) },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo eliminar el archivo de contexto");
}

export async function invokeAgent(id: string): Promise<{
  agent: StoredAgent;
  projection: {
    systemPrompt: string;
    agentSpecInput: { name: string; role: string; goal: string };
    tools: string[];
    model: string | null;
  };
}> {
  const res = await fetch(`/api/agents/${id}/invoke`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Falló la ejecución del agente");
  return data;
}

export async function fetchEnterprisePresets(): Promise<{
  presets: Record<OrgSizePreset, AreaHeadcount>;
  areas: AreaId[];
  defaultSeniorityMix: SeniorityMix;
}> {
  const res = await fetch("/api/enterprise/presets");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar las configuraciones");
  return data;
}

export async function generateEnterprise(body: {
  companyName?: string;
  orgSizePreset?: OrgSizePreset;
  counts: Partial<AreaHeadcount>;
  seniorityMix?: Partial<SeniorityMix>;
  persist?: boolean;
}): Promise<{
  companyName: string;
  counts: AreaHeadcount;
  seniorityMix: SeniorityMix;
  total: number;
  saved: number;
  usedAi: boolean;
  summary: {
    byArea: Record<AreaId, number>;
    bySeniority: Record<string, number>;
  };
  profiles: AgentProfile[];
}> {
  const res = await fetch("/api/enterprise/generate", {
    method: "POST",
    headers: writeHeaders(true),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Falló la generación de la empresa");
  return data;
}

/** Last published batch experiment, or null if none has been published yet. */
export async function fetchBatchResults(): Promise<BatchResults | null> {
  const res = await fetch("/api/batch-results");
  const data = await res.json().catch(() => ({ error: `La API respondió ${res.status} sin datos del lote` }));
  if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar los resultados del lote");
  return data.results ?? null;
}
