import { AsyncLocalStorage } from "node:async_hooks";
import { config, setRequestKeyReader } from "./config.js";

/**
 * A visitor's own Anthropic API key, sent by the web app in this header on every /api request.
 * It is used only for the model calls that request starts (runs it launches keep it through
 * async continuations) and is never stored, logged or returned.
 */
export const USER_API_KEY_HEADER = "x-anthropic-api-key";

const store = new AsyncLocalStorage<{ apiKey: string }>();

/** Pure: a plausible Anthropic key, or "" (so a typo never replaces the server's key with junk). */
export function normalizeUserApiKey(raw: string | undefined | null): string {
  const key = (raw ?? "").trim();
  return /^sk-ant-[A-Za-z0-9_-]{20,200}$/.test(key) ? key : "";
}

export function withUserApiKey<T>(apiKey: string, fn: () => T): T {
  return apiKey ? store.run({ apiKey }, fn) : fn();
}

/** The visitor's key for the current request, or "" when they did not send one. */
export function userApiKey(): string {
  return store.getStore()?.apiKey ?? "";
}
setRequestKeyReader(userApiKey);

/** The key model calls use right now: the visitor's own when they sent one, else the server's. */
export function activeApiKey(): string {
  return userApiKey() || config.anthropicApiKey;
}

// Queued evaluation jobs run later in the worker, outside the request: keep the key in memory
// (never in the database) until the worker takes the job. Lost on restart, like the queue's lock.
const jobKeys = new Map<string, string>();

export function rememberJobApiKey(jobId: string, apiKey: string): void {
  if (apiKey) jobKeys.set(jobId, apiKey);
}

export function takeJobApiKey(jobId: string): string {
  const key = jobKeys.get(jobId) ?? "";
  jobKeys.delete(jobId);
  return key;
}
