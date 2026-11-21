import type { AreaPrototype } from "../types.js";

export const csmArea: AreaPrototype = {
  id: "csm",
  label: "CSM",
  purpose:
    "Drive adoption, renewal, and expansion by owning the customer relationship after the sale.",
  how: "Runs QBRs, tracks health scores, escalates product gaps, aligns Success plans with stakeholders, and coordinates with CS/Support on risk.",
  why: "Retention and expansion are the compounding engine — churn destroys CAC payback.",
  defaultTools: ["done", "send_message", "read_inbox"],
  scenarioSeeds: [
    "A strategic account's usage dropped 40% after a release; renewal is in 60 days.",
    "The customer wants a roadmap commitment that Product has not approved.",
  ],
  defaultTitle: "Customer Success Manager",
};
