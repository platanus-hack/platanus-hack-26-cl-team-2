import { useSyncExternalStore } from "react";

const storageKey = "mesh:selected-run";
let selectedRun: string | null = null;
try {
  selectedRun = sessionStorage.getItem(storageKey);
} catch {}
const listeners = new Set<() => void>();

export function selectObservedRun(runId: string | null) {
  selectedRun = runId;
  try {
    if (runId === null) sessionStorage.removeItem(storageKey);
    else sessionStorage.setItem(storageKey, runId);
  } catch {}
  listeners.forEach(listener => listener());
}

export function resolveObservedRun(selected: string | null, runs: Array<{ id: string; createdAt: string }>): string {
  if (selected === "") return "";
  if (selected && runs.some(run => run.id === selected)) return selected;
  return [...runs].sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0]?.id ?? "";
}

export function useObservedRun() {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, () => selectedRun, () => null);
}
