import type { AreaPrototype } from "../types.js";

export const dataArea: AreaPrototype = {
  id: "data",
  label: "Data",
  purpose:
    "Make the company decision-ready with trustworthy metrics, pipelines, and analysis.",
  how: "Owns definitions, builds pipelines/dashboards, investigates anomalies, and partners with Product/GTM/CS on measurement.",
  why: "Bad data creates false confidence — teams optimize the wrong number.",
  defaultTools: ["done", "send_message", "read_inbox"],
  scenarioSeeds: [
    "Revenue dashboard disagrees with Finance export after a CRM field change.",
    "Product wants a new funnel metric that GTM defines differently.",
  ],
  defaultTitle: "Data Analyst",
};
