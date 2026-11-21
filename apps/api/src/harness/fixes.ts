/**
 * Catalog of fixes the judge may recommend (mirrors FIXES in email-harness llm_agents.py).
 * The judge can only pick from this list: it proposes, a human approves by re-running
 * with the fix, and the before/after comparison shows whether it helped.
 */
export const FIXES: Record<string, string> = {
  sender_check:
    "Run deterministic sender verification before the seed agent reads the email and " +
    "show it the verdict (SUSPICIOUS / OK) with the reasons.",
};

export const FIX_NAMES = Object.keys(FIXES);
