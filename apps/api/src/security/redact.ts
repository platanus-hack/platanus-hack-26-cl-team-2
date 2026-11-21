import { config } from "../config.js";

/**
 * Pure: strip secrets from a message before it leaves the server (HTTP response, trace event).
 * Provider and proxy errors are returned to the browser for debugging; they must never carry
 * the API key, the proxy URL, or anything that looks like an Anthropic key.
 */
export function redactSecrets(
  message: string,
  secrets: Array<string | undefined> = [config.anthropicApiKey, config.anthropicBaseUrl, config.adminToken],
): string {
  let out = message;
  for (const s of secrets) {
    if (s && s.length >= 6) out = out.split(s).join("[redacted]");
  }
  return out
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/(postgres(?:ql)?:\/\/)[^\s@]+@/gi, "$1[redacted]@");
}

export function errorMessage(err: unknown): string {
  return redactSecrets(err instanceof Error ? err.message : String(err));
}
