import { getUserApiKey } from "./userApiKey";
import type {
  AgentOrigin,
  BatchResults,
  AgentProfile,
  EvaluationJob,
  AgentVulnAssessment,
  RunAudit,
  RunEvaluation,
  RunRiskPaths,
  RunSummary,
  TraceEvent,
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
  /** True when the server has a key or the visitor saved their own (see userApiKey.ts). */
  hasApiKey: boolean;
  serverHasApiKey: boolean;
  hasDatabase?: boolean;
  database?: { ok: boolean; error?: string };
  model: string;
  refineModel?: string;
}> {
  const res = await fetch("/health");
  if (!res.ok) throw new Error("No se puede acceder a la API");
  const data = await res.json();
  return { ...data, serverHasApiKey: Boolean(data.hasApiKey), hasApiKey: Boolean(data.hasApiKey) || Boolean(getUserApiKey()) };
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


export async function getVulnAssessment(
  agentId: string,
): Promise<AgentVulnAssessment | null> {
  const res = await fetch(`/api/agents/${agentId}/vuln-assessment`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "No se pudo cargar el assessment");
  return (data.assessment ?? null) as AgentVulnAssessment | null;
}

/** Runs designer + solo exploit evals; can take several minutes. */

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


export type BatchResultSet = "latest" | "business" | "org20";

/** A published batch experiment ("latest" by default), or null if none has been published yet. */

export async function fetchBatchResults(set: BatchResultSet = "latest"): Promise<BatchResults | null> {
  const res = await fetch(`/api/batch-results?set=${encodeURIComponent(set)}`);
  const data = await res.json().catch(() => ({ error: `La API respondió ${res.status} sin datos del lote` }));
  if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar los resultados del lote");
  return data.results ?? null;
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
  objectiveScore?: number;
};


export type DemoSimGuardPatch = {
  agentId: string;
  agentName: string;
  reason: string;
  instruction: string;
};


export type DemoSimPatchPlan = {
  howCreated: string;
  patches: DemoSimGuardPatch[];
};


export type DemoSimRetestCompare = {
  before: { empty: boolean; score: number; scoreSummary: string };
  after: { empty: boolean; score: number; scoreSummary: string };
  delta: number;
  held: boolean;
};


export function designRiskPrompts(
  companyName: string,
  objective: string,
  pathSteps?: number,
  approachNotes?: string,
): Promise<{ design: DemoSimDesign; model: string }> {
  return postJson("/api/demo-sim/design", { companyName, objective, pathSteps, approachNotes });
}


export function startRiskRuns(body: {
  companyName: string;
  actions: DemoSimAction[];
  maxTurns?: number;
}): Promise<{ runs: RunSummary[] }> {
  return postJson("/api/demo-sim/runs", body);
}


export function evaluateRiskRun(body: {
  companyName: string;
  objective: string;
  design: DemoSimDesign;
  runIds: string[];
}): Promise<{ evaluation: DemoSimEval; model: string }> {
  return postJson("/api/demo-sim/evaluate", body);
}


export type DemoSimDeepen = {
  changes: string[];
  attackSurface: string;
  rationale: string;
  actions: DemoSimAction[];
};


export function deepenRiskPrompt(body: {
  companyName: string;
  objective: string;
  approach: string;
  seedAgentId?: string;
  attackSurface?: string;
  runId?: string;
  evaluation: DemoSimEval;
  userApproachNotes?: string;
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
    approach?: string;
    objectiveScore?: number;
    actions?: DemoSimAction[];
    maxTurns?: number;
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
  approach?: string;
  allowEmpty?: boolean;
  actions?: DemoSimAction[];
  maxTurns?: number;
}): Promise<{ finding: DemoSimFinding }> {
  return postJson("/api/demo-sim/findings", body);
}


export function designDemoSimPatch(findingId: string): Promise<{ plan: DemoSimPatchPlan; model: string }> {
  return postJson(`/api/demo-sim/findings/${encodeURIComponent(findingId)}/patch`, {});
}


export function retestDemoSimFinding(
  findingId: string,
  patches: DemoSimGuardPatch[],
): Promise<{ runId: string; evaluation: DemoSimEval; compare: DemoSimRetestCompare; model: string }> {
  return postJson(`/api/demo-sim/findings/${encodeURIComponent(findingId)}/retest`, { patches });
}

/** Who talks to whom, summed over every saved run (weights for the org map). */
