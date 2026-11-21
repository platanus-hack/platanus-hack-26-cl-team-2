import { EventEmitter } from "node:events";
import { nanoid } from "nanoid";
import type { TraceEvent, TraceEventType } from "@sandbox/shared";

type Listener = (event: TraceEvent) => void;

export class TraceBus {
  private readonly emitter = new EventEmitter();
  private readonly byRun = new Map<string, TraceEvent[]>();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit(
    runId: string,
    type: TraceEventType,
    payload: Record<string, unknown> = {},
    agentId?: string,
  ): TraceEvent {
    const event: TraceEvent = {
      id: nanoid(10),
      runId,
      ts: new Date().toISOString(),
      type,
      agentId,
      payload,
    };

    const list = this.byRun.get(runId) ?? [];
    list.push(event);
    this.byRun.set(runId, list);
    this.emitter.emit(runId, event);
    this.emitter.emit("*", event);
    return event;
  }

  history(runId: string): TraceEvent[] {
    return [...(this.byRun.get(runId) ?? [])];
  }

  subscribe(runId: string, listener: Listener): () => void {
    this.emitter.on(runId, listener);
    return () => this.emitter.off(runId, listener);
  }
}

export const traceBus = new TraceBus();
