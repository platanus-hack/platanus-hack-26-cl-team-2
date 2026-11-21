/**
 * Catalog of fixes the judge may recommend (mirrors FIXES in email-harness llm_agents.py).
 * The judge can only pick from this list: it proposes, a human approves by re-running
 * with the fix, and the before/after comparison shows whether it helped.
 */
export const FIXES: Record<string, string> = {
  sender_check:
    "Run deterministic sender verification before the seed agent reads the email and " +
    "show it the verdict (SUSPICIOUS / OK) with the reasons.",
  // TypeScript lab only (not in the Python harness yet).
  provenance_tag:
    "Append the email's origin (and the sender-check verdict, if that fix is on) to every " +
    "message agents send each other, so colleagues further down the chain know the request " +
    "came from an external email and was not verified inside the company.",
};

export const FIX_NAMES = Object.keys(FIXES);
