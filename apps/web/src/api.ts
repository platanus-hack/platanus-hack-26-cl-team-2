import type {
  AgentKnobs,
  AgentOrigin,
  CommGraph,
  BatchResults,
  AgentProfile,
  EvaluationJob,
  AgentVulnAssessment,
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
  VulnBatch,
  VulnBatchEstimate,
  VulnCategory,
  VulnDesignerBrief,
  VulnScores,
} from "@sandbox/shared";

export type VulnRunTraceDto = {
  category: VulnCategory;
  runId: string;
  status: string;
  error?: string;
  trace: string;
  iteration?: number;
};

export async function listEvaluationJobs(): Promise<EvaluationJob[]> {
  const res = await fetch("/api/evaluation-jobs", { headers: writeHeaders(false) });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error ?? "No se pudo consultar la cola");
  return data.jobs;
}
export async function startEvaluationJob(agentIds: string[], iterations: number): Promise<EvaluationJob> {
  const res = await fetch("/api/evaluation-jobs", { method: "POST", headers: writeHeaders(true), body: JSON.stringify({ agentIds, iterations }) });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error ?? "No se pudo iniciar el análisis");
  return data.job;
}
export async function cancelEvaluationJob(id: string): Promise<EvaluationJob> {
  const res = await fetch(`/api/evaluation-jobs/${encodeURIComponent(id)}/cancel`, { method: "POST", headers: writeHeaders(true), body: "{}" });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error ?? "No se pudo detener el análisis");
  return data.job;
}

export type StoredAgent = AgentProfile & {
  harnessTools: string[];
  harnessModel: string | null;
  /** manual = made in the agent creator; enterprise/seed/test = generated. */
  origin: AgentOrigin;
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

/** An API error that keeps the HTTP status (429 = daily budget spent, 401 = admin token). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
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
  if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar los correos de prueba");
  return data;
}

export type MockDbSummary = {
  tool: string;
  file: string;
  label: string;
  sensitivity: string;
  kind: string;
  readTool?: string;
  writeTool?: string;
};

export function isDemoStoredAgent(agent: {
  id: string;
  orgHints?: { notes?: string } | null;
}): boolean {
  return (
    agent.id.startsWith("demo_agent_") ||
    Boolean(agent.orgHints?.notes?.includes("mesh:demo-org:"))
  );
}

export async function listMockDatabases(): Promise<{ databases: MockDbSummary[] }> {
  const res = await fetch("/api/mock-db");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load mock databases");
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

export async function getVulnAssessment(
  agentId: string,
): Promise<AgentVulnAssessment | null> {
  const res = await fetch(`/api/agents/${agentId}/vuln-assessment`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "No se pudo cargar el assessment");
  return (data.assessment ?? null) as AgentVulnAssessment | null;
}

/** Runs designer + solo exploit evals; can take several minutes. */
export async function runVulnAssess(
  agentId: string,
  body?: { maxTurnsPerAgent?: number; maxScenarios?: number },
): Promise<AgentVulnAssessment> {
  const res = await fetch(`/api/agents/${agentId}/vuln-assess`, {
    method: "POST",
    headers: writeHeaders(true),
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Falló el vulnerability assessment");
  return data.assessment as AgentVulnAssessment;
}

export async function designVulnScenarios(
  agentId: string,
): Promise<{ agentId: string; brief: VulnDesignerBrief }> {
  const res = await fetch(`/api/agents/${agentId}/vuln-design`, {
    method: "POST",
    headers: writeHeaders(true),
    body: "{}",
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Falló el diseño de escenarios");  return data as { agentId: string; brief: VulnDesignerBrief };
}

export async function runOneVulnScenario(
  agentId: string,
  body: {
    category: VulnCategory;
    title?: string;
    scenarioHint: string;
    grantFinanceTools?: boolean;
    rationale?: string;
    maxTurnsPerAgent?: number;
    iteration?: number;
  },
): Promise<VulnRunTraceDto> {
  const res = await fetch(`/api/agents/${agentId}/vuln-run-one`, {
    method: "POST",
    headers: writeHeaders(true),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Falló el escenario");  return data.result as VulnRunTraceDto;
}

export async function finalizeVulnAssessment(
  agentId: string,
  body: {
    brief: VulnDesignerBrief;
    runTraces: VulnRunTraceDto[];
    updateAgentDescription?: boolean;
  },
): Promise<{
  assessment: AgentVulnAssessment;
  descriptionUpdated: boolean;
  previousScores: VulnScores | null;
}> {
  const res = await fetch(`/api/agents/${agentId}/vuln-finalize`, {
    method: "POST",
    headers: writeHeaders(true),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Falló el scoring final");  return data as {
    assessment: AgentVulnAssessment;
    descriptionUpdated: boolean;
    previousScores: VulnScores | null;
  };
}

export async function getAgent(id: string): Promise<StoredAgent> {
  const res = await fetch(`/api/agents/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Agente no encontrado");
  return data.agent as StoredAgent;
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

/** Published batch result sets the API serves (see BATCH_RESULT_SETS in apps/api). */
export type BatchResultSet = "latest" | "business" | "org20";

/** A published batch experiment ("latest" by default), or null if none has been published yet. */
export async function fetchBatchResults(set: BatchResultSet = "latest"): Promise<BatchResults | null> {
  const res = await fetch(`/api/batch-results?set=${encodeURIComponent(set)}`);
  const data = await res.json().catch(() => ({ error: `La API respondió ${res.status} sin datos del lote` }));
  if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar los resultados del lote");
  return data.results ?? null;
}

export type DemoOrgFile = {
  id: string;
  filename: string;
  content: string;
  label: string;
  readAgentIds: string[];
  writeAgentIds: string[];
};

export type DemoOrg = {
  id: string;
  companyName: string;
  context: string;
  agentIds: string[];
  files: DemoOrgFile[];
  createdAt: string;
  updatedAt: string;
};

export async function saveDemoOrg(body: {
  companyName?: string;
  context: string;
  agents: Array<{ name: string; prompt: string }>;
  files?: Array<{
    filename: string;
    content: string;
    label?: string;
    readAgentNames: string[];
    writeAgentNames: string[];
  }>;
}): Promise<{ org: DemoOrg; agents: StoredAgent[] }> {
  const res = await fetch("/api/demo-orgs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la empresa DEMO");
  return data as { org: DemoOrg; agents: StoredAgent[] };
}

/** @deprecated alias — saves overwrite the current DEMO org */
export const createDemoOrg = saveDemoOrg;

export async function getCurrentDemoOrg(): Promise<{
  org: DemoOrg | null;
  agents: StoredAgent[];
}> {
  const res = await fetch("/api/demo-orgs/current");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "No se pudo cargar la empresa DEMO");
  return data as { org: DemoOrg | null; agents: StoredAgent[] };
}

export async function listDemoOrgs(): Promise<DemoOrg[]> {
  const res = await fetch("/api/demo-orgs");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "No se pudieron listar las empresas DEMO");
  return data.orgs as DemoOrg[];
}

export async function getDemoOrg(id: string): Promise<DemoOrg> {
  const res = await fetch(`/api/demo-orgs/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Empresa DEMO no encontrada");
  return data.org as DemoOrg;
}

export async function patchDemoOrgContext(context: string): Promise<{
  org: DemoOrg;
  agents: StoredAgent[];
}> {
  const res = await fetch("/api/demo-orgs/current/context", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "No se pudo actualizar el contexto DEMO");
  return data as { org: DemoOrg; agents: StoredAgent[] };
}

export type DemoBusinessScenarioDto = {
  title: string;
  businessProblem: string;
  seedAgentId: string;
  scenarioHint?: string;
  peerMessage?: { fromAgentId: string; toAgentId: string; body: string };
  rationale: string;
};

export type DemoCommPatternsDto = {
  edges: Array<{
    from: string;
    to: string;
    about: string;
    frequencyHint: string;
  }>;
  notes: string;
};

export type DemoChainActionDto = {
  kind: "scenarioHint" | "peerMessage";
  label: string;
  seedAgentId: string;
  scenarioHint?: string;
  peerMessage?: { fromAgentId: string; toAgentId: string; body: string };
};

export type DemoChainAttackDesignDto = {
  attackSurface: string;
  actions: DemoChainActionDto[];
  successCriteria: string;
  rationale: string;
};

export type DemoChainEvalDto = {
  empty: boolean;
  surface: string;
  failuresAmplifications: string[];
  actionableRemediations: string[];
  scoreSummary: string;
};

export type DemoChainDiagnosisDto = {
  whyEmpty: string;
  llmInteractionReview: string;
  improvedHackPrompt: string;
};

async function demoPipelinePost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/demo-pipeline${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Falló ${path}`);
  return data as T;
}

export async function designDemoCommScenario(body?: {
  avoidTitles?: string[];
}): Promise<{
  scenario: DemoBusinessScenarioDto;
  agents: StoredAgent[];
  companyName: string;
  context: string;
  model: string;
}> {
  return demoPipelinePost("/comm-learn/design", body);
}

export async function analyzeDemoCommPatterns(runId: string): Promise<{
  patterns: DemoCommPatternsDto;
  tracePreview: string;
  model: string;
}> {
  return demoPipelinePost("/comm-learn/analyze", { runId });
}

export async function finalizeDemoCommLearn(
  patternsBatches: DemoCommPatternsDto[],
): Promise<{
  org: DemoOrg;
  agents: StoredAgent[];
  trendsBlock: string;
  trendsMarkdown: string;
}> {
  return demoPipelinePost("/comm-learn/finalize", { patternsBatches });
}

export async function designDemoChainAttack(body?: {
  hackPrompt?: string;
}): Promise<{
  design: DemoChainAttackDesignDto;
  model: string;
  hackPrompt: string;
}> {
  return demoPipelinePost("/chain-attack/design", body);
}

export async function evaluateDemoChainAttack(body: {
  design: DemoChainAttackDesignDto;
  runIds: string[];
}): Promise<{ evaluation: DemoChainEvalDto; model: string; traces: string }> {
  return demoPipelinePost("/chain-attack/evaluate", body);
}

export async function diagnoseDemoChainAttack(body: {
  design: DemoChainAttackDesignDto;
  evaluation: DemoChainEvalDto;
  llmLog: string;
  hackPrompt?: string;
}): Promise<{ diagnosis: DemoChainDiagnosisDto; model: string }> {
  return demoPipelinePost("/chain-attack/diagnose", body);
}

/** Poll until run completes or fails. */
export async function waitForStoredRun(
  runId: string,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<Awaited<ReturnType<typeof fetchRun>>> {
  const timeoutMs = opts?.timeoutMs ?? 180_000;
  const intervalMs = opts?.intervalMs ?? 1500;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const data = await fetchRun(runId);
    if (data.run.status === "completed" || data.run.status === "failed") {
      return data;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout esperando run ${runId}`);
}

export type EverydayProblem = {
  title: string;
  scenarioHint: string;
};

export type FlowGraphNode = {
  agentId: string;
  label: string;
  weight: number;
};

export type FlowGraphEdge = {
  fromAgentId: string;
  toAgentId: string;
  from: string;
  to: string;
  weight: number;
};

export type FlowGraph = {
  companyName: string;
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 429 && attempt < 5) {
      const retry = Number(res.headers.get("Retry-After") ?? "15");
      const wait = Number.isFinite(retry) ? Math.min(Math.max(retry, 1), 60) : 15;
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      continue;
    }
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `La API respondió ${res.status}`);
    return data as T;
  }
  throw new Error("Demasiados intentos");
}

export function designEverydayProblems(body: {
  seedAgentId: string;
  agentIds: string[];
  count: number;
  avoidTitles?: string[];
}): Promise<{ problems: EverydayProblem[] }> {
  return postJson("/api/characterize/problems", body);
}

export function startCharacterizeRuns(
  runs: Array<{
    agentIds: string[];
    seedAgentId: string;
    scenarioHint: string;
    maxTurnsPerAgent?: number;
  }>,
): Promise<{ runs: RunSummary[] }> {
  return postJson("/api/characterize/runs", { runs });
}

export function summarizeFlows(body: {
  companyName: string;
  runs: Array<{ runId: string; seedAgentId: string; names: Record<string, string> }>;
}): Promise<{ graph: FlowGraph }> {
  return postJson("/api/characterize/flows", body);
}

export type CompanyTxtFile = {
  id: string;
  filename: string;
  content: string;
  label: string;
  readAgentIds: string[];
  writeAgentIds: string[];
};

export async function fetchCompanyTxtFiles(companyName: string): Promise<CompanyTxtFile[]> {
  const res = await fetch(`/api/characterize/files?company=${encodeURIComponent(companyName)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudieron cargar los archivos");
  return (data.files as CompanyTxtFile[]) ?? [];
}

export function saveCompanyTxtFiles(body: {
  companyName: string;
  files: Array<Omit<CompanyTxtFile, "id"> & { id?: string }>;
}): Promise<{ files: CompanyTxtFile[] }> {
  return postJson("/api/characterize/files", body);
}

export async function fetchFlowGraph(companyName: string): Promise<FlowGraph | null> {
  const res = await fetch(`/api/characterize/graph?company=${encodeURIComponent(companyName)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudo cargar el grafo");
  return (data.graph as FlowGraph | null) ?? null;
}

export type DemoSimAction = {
  kind: "scenarioHint" | "peerMessage";
  label: string;
  seedAgentId: string;
  scenarioHint?: string;
  peerMessage?: { fromAgentId: string; toAgentId: string; body: string };
};

export type DemoSimDesign = {
  attackSurface: string;
  actions: DemoSimAction[];
  successCriteria: string;
  rationale: string;
};

export type DemoSimEval = {
  empty: boolean;
  surface: string;
  failuresAmplifications: string[];
  actionableRemediations: string[];
  scoreSummary: string;
};

export function designRiskPrompts(companyName: string): Promise<{ design: DemoSimDesign; model: string }> {
  return postJson("/api/demo-sim/design", { companyName });
}

export function startRiskRuns(body: {
  companyName: string;
  actions: DemoSimAction[];
}): Promise<{ runs: RunSummary[] }> {
  return postJson("/api/demo-sim/runs", body);
}

export function evaluateRiskRun(body: {
  companyName: string;
  design: DemoSimDesign;
  runIds: string[];
}): Promise<{ evaluation: DemoSimEval; model: string }> {
  return postJson("/api/demo-sim/evaluate", body);
}

export type DemoSimDeepen = {
  changes: string[];
  attackSurface: string;
  prompt: string;
  seedAgentId: string;
};

export function deepenRiskPrompt(body: {
  companyName: string;
  prompt: string;
  seedAgentId?: string;
  attackSurface?: string;
  runId?: string;
  evaluation: DemoSimEval;
}): Promise<{ deepen: DemoSimDeepen; model: string }> {
  return postJson("/api/demo-sim/deepen", body);
}

export type DemoSimVectorStep = { title: string; detail: string };

export type DemoSimFinding = {
  id: string;
  companyName: string;
  createdAt: string;
  prompt: string;
  attackSurface: string;
  vector: DemoSimVectorStep[];
  runId: string;
  analysis: {
    surface: string;
    failuresAmplifications: string[];
    actionableRemediations: string[];
    scoreSummary: string;
    empty?: boolean;
  };
};

export async function fetchDemoSimFindings(): Promise<DemoSimFinding[]> {
  const res = await fetch("/api/demo-sim/findings");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudieron cargar las evaluaciones");
  return (data.findings as DemoSimFinding[]) ?? [];
}

export function saveDemoSimFinding(body: {
  companyName: string;
  prompt: string;
  attackSurface: string;
  runId: string;
  evaluation: DemoSimEval;
  allowEmpty?: boolean;
}): Promise<{ finding: DemoSimFinding }> {
  return postJson("/api/demo-sim/findings", body);
}

/** Who talks to whom, summed over every saved run (weights for the org map). */
export async function getCommGraph(): Promise<CommGraph> {
  const res = await fetch("/api/comm-graph");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "No se pudo cargar el grafo de comunicación");
  return data.graph as CommGraph;
}

/** Re-count every saved run's messages (admin write). */
export async function rebuildCommGraph(): Promise<{ runs: number; pairs: number; graph: CommGraph }> {
  const res = await fetch("/api/comm-graph/rebuild", { method: "POST", headers: writeHeaders(true), body: "{}" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "No se pudo recontar");
  return data;
}

export type VulnBatchOptions = {
  agentIds?: string[];
  iterations: number;
  maxTurnsPerAgent: number;
  concurrency: number;
};

async function batchJson<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? fallback);
  return data as T;
}

export async function listVulnBatches(): Promise<VulnBatch[]> {
  const res = await fetch("/api/vuln-batches");
  return (await batchJson<{ batches: VulnBatch[] }>(res, "No se pudieron cargar los lotes")).batches;
}

export async function estimateVulnBatch(options: VulnBatchOptions): Promise<VulnBatchEstimate> {
  const res = await fetch("/api/vuln-batches/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  return (await batchJson<{ estimate: VulnBatchEstimate }>(res, "No se pudo estimar el costo")).estimate;
}

export async function startVulnBatch(options: VulnBatchOptions): Promise<VulnBatch> {
  const res = await fetch("/api/vuln-batches", {
    method: "POST",
    headers: writeHeaders(true),
    body: JSON.stringify(options),
  });
  return (await batchJson<{ batch: VulnBatch }>(res, "No se pudo iniciar el lote")).batch;
}

export async function reportVulnBatchAgent(
  batchId: string,
  agentId: string,
  body: { status: "ok" | "failed"; error?: string },
): Promise<VulnBatch> {
  const res = await fetch(`/api/vuln-batches/${batchId}/agents/${encodeURIComponent(agentId)}`, {
    method: "POST",
    headers: writeHeaders(true),
    body: JSON.stringify({ ...body, error: body.error?.slice(0, 1000) }),
  });
  return (await batchJson<{ batch: VulnBatch }>(res, "No se pudo guardar el resultado")).batch;
}

export async function finishVulnBatch(
  batchId: string,
  status: "completed" | "stopped" | "failed",
): Promise<VulnBatch> {
  const res = await fetch(`/api/vuln-batches/${batchId}/finish`, {
    method: "POST",
    headers: writeHeaders(true),
    body: JSON.stringify({ status }),
  });
  return (await batchJson<{ batch: VulnBatch }>(res, "No se pudo cerrar el lote")).batch;}
