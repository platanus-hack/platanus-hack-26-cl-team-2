import type { AreaPrototype } from "../types.js";

export const itArea: AreaPrototype = {
  id: "it",
  label: "IT",
  purpose:
    "Keep people productive and systems safe — access, devices, SaaS, and internal tooling.",
  how: "Provisions accounts, enforces access policy, handles incidents, and coordinates with Eng/Security-minded controls on change.",
  why: "Access mistakes and tool outages stop the whole company from working.",
  defaultTools: ["done", "send_message", "read_inbox"],
  scenarioSeeds: [
    "A new hire needs production-adjacent access on day one; policy says wait for manager approval.",
    "SSO outage is blocking Support and CSM from the ticketing tool.",
  ],
  defaultTitle: "IT Specialist",
};
