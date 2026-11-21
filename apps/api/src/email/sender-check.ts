/**
 * Deterministic sender verification (no LLM, so it can't be talked out of a verdict).
 *
 * TypeScript port of email-harness/src/mesh_harness/sender_check.py — keep the two in sync.
 * Works on the "From:" line of an email. Real deployments should also check SPF/DKIM/DMARC
 * results from the mail headers; we only have the From line, so these are heuristics.
 */
import type { SenderCheck } from "@sandbox/shared";

const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "outlook.com",
  "outlook.es", "live.com", "yahoo.com", "icloud.com", "proton.me", "protonmail.com",
]);
const BRANDS = [
  "microsoft", "google", "apple", "amazon", "paypal", "nvidia", "openai", "linkedin",
  "netflix", "bank", "banco", "santander", "bci", "visa", "mastercard",
];
const FROM_RE = /^From:\s*(?:(?<name>.*?)\s*<(?<addr>[^>]+)>|(?<bare>\S+))/m;
const SAFE_ADDR = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

/** Long label mixing upper, lower and digits, e.g. 'uWRv1hyc8ZPI4OTfy70iEW0sn9lX'. */
function randomLabel(label: string): boolean {
  return (
    [...label].length >= 16 &&
    /\p{Lu}/u.test(label) &&
    /\p{Ll}/u.test(label) &&
    /\p{Nd}/u.test(label)
  );
}

export function checkSender(email: string): SenderCheck {
  const m = FROM_RE.exec(email);
  if (!m?.groups) {
    return { verdict: "UNKNOWN", reasons: ["no From line"], address: null };
  }
  const name = (m.groups.name ?? "").trim().replace(/^"+|"+$/g, "");
  const addr = (m.groups.addr ?? m.groups.bare ?? "").trim();
  const reasons: string[] = [];

  if (!SAFE_ADDR.test(addr)) {
    reasons.push("address contains characters a real mail server would not use");
  }
  const domain = addr.includes("@") ? addr.slice(addr.lastIndexOf("@") + 1).toLowerCase() : "";
  const labels = domain.split(".").filter(Boolean);
  if (addr.replace("@", ".").split(".").some(randomLabel)) {
    reasons.push("random-looking string in the address");
  }
  const base = labels.length >= 2 ? labels.slice(-2).join(".") : domain;
  if (FREEMAIL.has(base) && labels.length > 2) {
    reasons.push(`fake subdomain of consumer mail service ${base}`);
  } else if (FREEMAIL.has(base) && /^(no-reply|noreply)/i.test(addr)) {
    reasons.push(`bulk 'no-reply' sender on consumer mail service ${base}`);
  }
  const claimed = BRANDS.filter((b) => name.toLowerCase().includes(b));
  if (claimed.length && !claimed.some((b) => domain.includes(b))) {
    reasons.push(`display name claims '${claimed[0]}' but domain is ${domain || "?"}`);
  }
  return { verdict: reasons.length ? "SUSPICIOUS" : "OK", reasons, address: addr };
}

export function senderBanner(result: SenderCheck): string {
  if (result.verdict === "SUSPICIOUS") {
    return `[Automated sender check: SUSPICIOUS - ${result.reasons.join("; ")}]`;
  }
  return `[Automated sender check: ${result.verdict}]`;
}
