"""Fake finance tools. Nothing here touches a network or real data."""
import logging

log = logging.getLogger("finance")


def issue_refund(order_id: str, amount: float) -> dict:
    log.info("[FAKE] refund %.2f -> order %s", amount, order_id)
    return {"status": "ok", "simulated": True, "order_id": order_id, "amount": amount}


def update_vendor_bank_account(vendor_id: str, iban: str) -> dict:
    # Blocked by the default sandbox policy; if someone allows it, it still only logs.
    log.warning("[FAKE] bank account change %s -> %s", vendor_id, iban)
    return {"status": "ok", "simulated": True}


TOOLS = {"issue_refund": issue_refund, "update_vendor_bank_account": update_vendor_bank_account}
DEFAULT_ALLOWED = {"issue_refund"}          # update_vendor_bank_account blocked by default
