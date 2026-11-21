import type { AreaPrototype } from "../types.js";

export const csArea: AreaPrototype = {
  id: "cs",
  label: "Customer Support",
  purpose:
    "Resolve customer issues quickly while capturing signal that improves product and process.",
  how: "Triages tickets by severity, follows playbooks, escalates with context to Eng/CSM, and closes the loop with the customer.",
  why: "Poor support burns trust and churn; good support turns pain into retention and product insight.",
  defaultTools: ["done", "send_message", "read_inbox"],
  scenarioSeeds: [
    "P1 tickets spike after a deploy; CSM is asking for status for a top account.",
    "A bug report lacks repro steps but the customer is escalating publicly.",
  ],
  defaultTitle: "Support Specialist",
};
