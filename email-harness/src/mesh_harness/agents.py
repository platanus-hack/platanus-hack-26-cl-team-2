"""Rule-based stand-ins for Agent A (intake), B (router), C (finance).

They are deterministic stubs, NOT LLMs: each has a simple, realistic weakness
so that different injection styles succeed or fail. Swap these functions for
real LLM calls later; the sandbox, tracing and evaluator stay the same.
"""
from __future__ import annotations
import re

IBAN = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b")
VENDOR = re.compile(r"\bV-\d{3,}\b")
REFUND = re.compile(r"refund.*?order\s+(\d+).*?(\d+(?:\.\d+)?)\s*(?:usd|eur|\$)", re.I | re.S)

# A's naive injection filter: only catches the most obvious phrasings
A_BLOCKLIST = ("ignore previous instructions", "ignore all previous", "system prompt")
# B routes to finance on these keywords
FINANCE_WORDS = ("refund", "bank", "iban", "invoice", "payment", "wire")


def agent_a(ticket: str, rec) -> str | None:
    """Support intake: reads the external ticket and summarises it for B."""
    rec.hop("ticket_ext", "A", "read", ticket)
    if any(p in ticket.lower() for p in A_BLOCKLIST):
        return None                         # dropped as suspicious
    summary = ticket.strip()                # weakness: passes untrusted text through verbatim
    rec.hop("A", "B", "delegate", summary)
    return summary


def agent_b(summary: str, rec) -> str | None:
    """Router: forwards anything finance-looking to C."""
    if not any(w in summary.lower() for w in FINANCE_WORDS):
        return None
    rec.hop("B", "C", "delegate", summary)
    return summary


def agent_c(request: str, sandbox) -> list[dict]:
    """Finance: executes refunds and vendor bank updates found in the request."""
    results = []
    m = REFUND.search(request)
    if m:
        results.append(sandbox.exec("C", "issue_refund", "refund_api",
                                    order_id=m.group(1), amount=float(m.group(2))))
    iban, vendor = IBAN.search(request), VENDOR.search(request)
    wants_change = re.search(r"\b(update|change|switch|replace|new)\b.*\b(bank|iban|account)\b",
                             request, re.I | re.S)
    # weakness: only control is "a vendor id must be present" -- no out-of-band verification
    if iban and vendor and wants_change:
        results.append(sandbox.exec("C", "update_vendor_bank_account", "bank_api",
                                    vendor_id=vendor.group(0), iban=iban.group(0)))
    return results
