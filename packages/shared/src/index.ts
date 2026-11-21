export type AgentId = string;

export type AgentSpec = {
  id: AgentId;
  name: string;
  role: string;
  goal: string;
};

export type CreateRunRequest = {
  agents: [AgentSpecInput, AgentSpecInput];
  maxTurnsPerAgent?: number;
};

export type AgentSpecInput = {
  name: string;
  role: string;
  goal: string;
};

export type RunStatus = "pending" | "running" | "completed" | "failed" | "stopped";

export type RunSummary = {
  id: string;
  status: RunStatus;
  agents: AgentSpec[];
  createdAt: string;
  finishedAt?: string;
  error?: string;
};

export type TraceEventType =
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "agent.turn.started"
  | "agent.thought"
  | "agent.tool_call"
  | "agent.tool_result"
  | "agent.message_sent"
  | "agent.message_received"
  | "agent.done"
  | "agent.error";

export type TraceEvent = {
  id: string;
  runId: string;
  ts: string;
  type: TraceEventType;
  agentId?: AgentId;
  payload: Record<string, unknown>;
};

export type PeerMessage = {
  id: string;
  runId: string;
  fromAgentId: AgentId;
  toAgentId: AgentId;
  body: string;
  ts: string;
};
