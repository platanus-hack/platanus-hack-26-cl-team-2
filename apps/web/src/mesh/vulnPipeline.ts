/**
 * One agent's vulnerability eval, driven from the browser step by step (design → solo runs →
 * score), the same steps AgentEvalsPage runs. Each step is its own request, so none hits the
 * serverless time limit. Used by the "evaluate every agent" batch.
 */
import type { VulnDesignerBrief } from "@sandbox/shared";
import {
  ApiError,
  designVulnScenarios,
  finalizeVulnAssessment,
  runOneVulnScenario,
  type VulnRunTraceDto,
} from "../api";

export type PipelineLog = (line: string, tone?: "ok" | "warn" | "err") => void;

export type PipelineOutcome =
  | { ok: true; failedRuns: number }
  | { ok: false; error: string; fatal: boolean };

/** 429 (daily budget) and 401/403 (admin token) stop the whole batch, not just this agent. */
export function isFatalForBatch(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 429 || err.status === 401 || err.status === 403);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function runAgentVulnPipeline(input: {
  agentId: string;
  iterations: number;
  maxTurnsPerAgent: number;
  log: PipelineLog;
  shouldStop: () => boolean;
}): Promise<PipelineOutcome> {
  const { agentId, log, shouldStop } = input;
  let brief: VulnDesignerBrief;
  try {
    brief = (await designVulnScenarios(agentId)).brief;
    log(`${brief.scenarios.length} escenarios diseñados`);
  } catch (err) {
    return { ok: false, error: `Diseño: ${message(err)}`, fatal: isFatalForBatch(err) };
  }

  const traces: VulnRunTraceDto[] = [];
  let failedRuns = 0;
  for (let iteration = 1; iteration <= input.iterations; iteration++) {
    for (const scenario of brief.scenarios) {
      if (shouldStop()) break;
      try {
        const result = await runOneVulnScenario(agentId, {
          category: scenario.category,
          title: scenario.title,
          scenarioHint: scenario.scenarioHint,
          grantFinanceTools: scenario.grantFinanceTools,
          rationale: scenario.rationale,
          maxTurnsPerAgent: input.maxTurnsPerAgent,
          iteration,
        });
        traces.push(result);
        if (result.status === "failed") failedRuns++;
        log(`${scenario.category} → ${result.status}`, result.status === "failed" ? "warn" : undefined);
      } catch (err) {
        if (isFatalForBatch(err)) return { ok: false, error: message(err), fatal: true };
        failedRuns++;
        log(`${scenario.category}: ${message(err)}`, "err");
      }
    }
    if (shouldStop()) break;
  }

  if (traces.length === 0) {
    return { ok: false, error: shouldStop() ? "Detenido antes de tener trazas" : "Ningún escenario produjo traza", fatal: false };
  }
  try {
    // Scored once, on everything gathered (also when stopped early).
    await finalizeVulnAssessment(agentId, { brief, runTraces: traces, updateAgentDescription: true });
    return { ok: true, failedRuns };
  } catch (err) {
    return { ok: false, error: `Scoring: ${message(err)}`, fatal: isFatalForBatch(err) };
  }
}

/** Runs `worker` over `items` with at most `limit` in flight; stops taking new items once `shouldStop()`. */
export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
  shouldStop: () => boolean,
): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (!shouldStop() && next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, lane));
}
