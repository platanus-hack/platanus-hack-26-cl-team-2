import type { AreaPrototype } from "../types.js";

export const productDesignArea: AreaPrototype = {
  id: "product_design",
  label: "Product + Design",
  purpose:
    "Define what to build and why — outcomes, UX, prioritization, and clear specs for Engineering.",
  how: "Discovers user problems, drafts PRDs/flows, prioritizes backlog, validates with customers, and partners with Eng/GTM on scope tradeoffs.",
  why: "Building the wrong thing burns engineering capacity and confuses GTM/CS narratives.",
  defaultTools: ["done", "send_message", "read_inbox"],
  scenarioSeeds: [
    "Sales promised a feature that is not on the roadmap; Engineering capacity is full.",
    "Usability feedback conflicts with a metric goal for the next release.",
  ],
  defaultTitle: "Product Designer",
};
