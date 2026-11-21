export type EvaluationJobStatus = "queued" | "running" | "cancelling" | "completed" | "failed" | "cancelled";
export type EvaluationJobData = {
  company: string;
  iterations: number;
  agents: Array<{ id: string; name: string; version: string }>;
  completedSteps: number;
  totalSteps: number;
  phase: string;
  agentStatus: Record<string, string>;
  logs: string[];
};
export type EvaluationJob = EvaluationJobData & {
  id: string;
  status: EvaluationJobStatus;
  createdAt: string;
  updatedAt: string;
};
export function evaluationJobActive(status: EvaluationJobStatus): boolean {
  return status === "queued" || status === "running" || status === "cancelling";
}
