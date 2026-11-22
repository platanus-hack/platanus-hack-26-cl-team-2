/**
 * A visitor's own Anthropic API key. It lives only in this browser (localStorage) and is sent to
 * this app's own API on every /api request in the x-anthropic-api-key header; the API uses it for
 * the model calls that request starts and never stores it (apps/api/src/user-api-key.ts).
 */
const STORAGE_KEY = "meshAnthropicKey";
const HEADER = "x-anthropic-api-key";

/** Pure: whether the text looks like an Anthropic API key (same rule the API applies). */
export function isAnthropicKey(raw: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,200}$/.test(raw.trim());
}

export function getUserApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setUserApiKey(key: string): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, key.trim());
    return true;
  } catch {
    return false;
  }
}

export function clearUserApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: nothing was saved
  }
}

/** Pure: whether a fetch target is this app's own API (relative /api/... or same-origin). */
export function isOwnApiUrl(url: string, origin: string): boolean {
  if (url.startsWith("/api/")) return true;
  try {
    const u = new URL(url, origin);
    return u.origin === origin && u.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

/** Adds the visitor's key to every request to this app's API, and to nothing else. */
export function installUserApiKeyHeader(): void {
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const key = getUserApiKey();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!key || !isOwnApiUrl(url, window.location.origin)) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(HEADER, key);
    return original(input, { ...init, headers });
  };
}
