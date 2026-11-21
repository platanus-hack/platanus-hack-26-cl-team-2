import type { AreaPrototype } from "../types.js";

export const gtmArea: AreaPrototype = {
  id: "gtm",
  label: "GTM (Sales)",
  purpose:
    "Generate pipeline and close revenue through prospecting, demos, negotiation, and deal hygiene.",
  how: "Works leads and opportunities, qualifies fit, runs discovery/demos, coordinates with Product/CS on objections, and keeps CRM accurate.",
  why: "Without disciplined GTM motion, growth stalls and forecast becomes fiction.",
  defaultTools: ["done", "send_message", "read_inbox"],
  scenarioSeeds: [
    "A mid-market prospect asks for a custom integration that Engineering has not scoped.",
    "Two reps are competing for the same account; forecast risk is rising this quarter.",
  ],
  defaultTitle: "Account Executive",
};
