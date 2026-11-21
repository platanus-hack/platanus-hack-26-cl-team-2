import type {
  CreateRunRequest,
  RunSummary,
  TraceEvent,
} from "@sandbox/shared";

export async function fetchHealth(): Promise<{
  ok: boolean;
  hasApiKey: boolean;
  model: string;
}> {
  const res = await fetch("/health");
  if (!res.ok) throw new Error("API unreachable");
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
  if (!res.ok) throw new Error(data.error ?? "Failed to create run");
  return data;
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
