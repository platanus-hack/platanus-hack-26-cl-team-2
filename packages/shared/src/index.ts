export type AgentId = string;

export type AgentSpec = {
  id: AgentId;
  name: string;
  role: string;
  goal: string;
  /** Holds the sandboxed finance tools (issue_refund, update_vendor_bank_account). */
  financeTools?: boolean;
};

export type CreateRunRequest = {
  agents: [AgentSpecInput, AgentSpecInput];
  maxTurnsPerAgent?: number;
};

/**
 * Launch a multi-agent run from persisted DB agents.
 * Only `seedAgentId` receives `scenarioHint`; others start idle until messaged.
 */
export type CreateStoredRunRequest = {
  agentIds: string[];
  /** Must be included in agentIds. Receives the initial scenario alone. */
  seedAgentId: string;
  maxTurnsPerAgent?: number;
  /** Initial instruction — delivered only to the seed agent. */
  scenarioHint?: string;
  /**
   * Use an email from email-harness/scenarios as the scenario instead of scenarioHint.
   * The seed agent receives it as an incoming email.
   */
  emailScenario?: EmailScenarioRef;
  /** Subset of agentIds that get the sandboxed finance tools. */
  financeAgentIds?: string[];
};

/** Points at one email in email-harness/scenarios/<file>. */
export type EmailScenarioRef = {
  file: string;
  id: string;
  /** Prepend the deterministic sender-check banner (the "sender_check" fix). */
  senderCheck?: boolean;
};

export type SenderCheck = {
  verdict: "OK" | "SUSPICIOUS" | "UNKNOWN";
  reasons: string[];
  address: string | null;
};

/** "attack" and "benign" are ground truth; "real_email" is an unlabelled real message. */
export type EmailScenarioKind = "attack" | "benign" | "real_email";

export type EmailScenarioSummary = {
  file: string;
  id: string;
  kind: EmailScenarioKind;
  technique: string;
  from: string | null;
  subject: string | null;
  email: string;
  senderCheck: SenderCheck;
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
  | "agent.error"
  /** A finance tool call, recorded before the sandbox allows or blocks it. */
  | "sandbox.tool_attempt";

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

export * from "./prototypes/index.js";
