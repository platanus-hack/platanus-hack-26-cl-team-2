"""Deterministic sender verification (no LLM, so it can't be talked out of a verdict).

Works on the "From:" line of a ticket. Real deployments should also check SPF/DKIM/DMARC
results from the mail headers; we only have the From line, so these are heuristics.
"""
from __future__ import annotations

import re

FREEMAIL = {"gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "outlook.com",
            "outlook.es", "live.com", "yahoo.com", "icloud.com", "proton.me", "protonmail.com"}
BRANDS = {"microsoft", "google", "apple", "amazon", "paypal", "nvidia", "openai", "linkedin",
          "netflix", "bank", "banco", "santander", "bci", "visa", "mastercard"}
FROM_RE = re.compile(r"^From:\s*(?:(?P<name>.*?)\s*<(?P<addr>[^>]+)>|(?P<bare>\S+))", re.M)
SAFE_ADDR = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def _random_label(label: str) -> bool:
    """Long label mixing upper, lower and digits, e.g. 'uWRv1hyc8ZPI4OTfy70iEW0sn9lX'."""
    return (len(label) >= 16 and any(c.isupper() for c in label)
            and any(c.islower() for c in label) and any(c.isdigit() for c in label))


def check_sender(ticket: str) -> dict:
    m = FROM_RE.search(ticket)
    if not m:
        return {"verdict": "UNKNOWN", "reasons": ["no From line"], "address": None}
    name = (m.group("name") or "").strip().strip('"')
    addr = (m.group("addr") or m.group("bare") or "").strip()
    reasons = []
    if not SAFE_ADDR.match(addr):
        reasons.append("address contains characters a real mail server would not use")
    domain = addr.rsplit("@", 1)[-1].lower() if "@" in addr else ""
    labels = [l for l in re.split(r"[.]", domain) if l]
    if any(_random_label(l) for l in addr.replace("@", ".").split(".")):
        reasons.append("random-looking string in the address")
    base = ".".join(labels[-2:]) if len(labels) >= 2 else domain
    if base in FREEMAIL and len(labels) > 2:
        reasons.append(f"fake subdomain of consumer mail service {base}")
    elif base in FREEMAIL and addr.lower().startswith(("no-reply", "noreply")):
        reasons.append(f"bulk 'no-reply' sender on consumer mail service {base}")
    claimed = [b for b in BRANDS if b in name.lower()]
    if claimed and not any(b in domain for b in claimed):
        reasons.append(f"display name claims {claimed[0]!r} but domain is {domain or '?'}")
    return {"verdict": "SUSPICIOUS" if reasons else "OK", "reasons": reasons, "address": addr}


def banner(result: dict) -> str:
    if result["verdict"] == "SUSPICIOUS":
        return "[Automated sender check: SUSPICIOUS - " + "; ".join(result["reasons"]) + "]"
    return f"[Automated sender check: {result['verdict']}]"
