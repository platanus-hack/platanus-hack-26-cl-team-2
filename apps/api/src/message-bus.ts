import { nanoid } from "nanoid";
import type { AgentId, PeerMessage } from "@sandbox/shared";

/** In-process peer mailbox. Later this becomes a real distributed queue. */
export class MessageBus {
  private readonly inboxes = new Map<string, PeerMessage[]>();

  private key(runId: string, agentId: AgentId): string {
    return `${runId}:${agentId}`;
  }

  ensureAgents(runId: string, agentIds: AgentId[]): void {
    for (const id of agentIds) {
      const k = this.key(runId, id);
      if (!this.inboxes.has(k)) this.inboxes.set(k, []);
    }
  }

  send(
    runId: string,
    fromAgentId: AgentId,
    toAgentId: AgentId,
    body: string,
  ): PeerMessage {
    const message: PeerMessage = {
      id: nanoid(10),
      runId,
      fromAgentId,
      toAgentId,
      body,
      ts: new Date().toISOString(),
    };
    const k = this.key(runId, toAgentId);
    const box = this.inboxes.get(k) ?? [];
    box.push(message);
    this.inboxes.set(k, box);
    return message;
  }

  /** Destructive read: returns and clears unread messages. */
  readInbox(runId: string, agentId: AgentId): PeerMessage[] {
    const k = this.key(runId, agentId);
    const box = this.inboxes.get(k) ?? [];
    this.inboxes.set(k, []);
    return box;
  }

  dropRun(runId: string): void {
    const prefix = `${runId}:`;
    for (const k of this.inboxes.keys()) if (k.startsWith(prefix)) this.inboxes.delete(k);
  }

  peek(runId: string, agentId: AgentId): PeerMessage[] {
    return [...(this.inboxes.get(this.key(runId, agentId)) ?? [])];
  }
}

export const messageBus = new MessageBus();
