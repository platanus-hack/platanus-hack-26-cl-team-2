import type { AreaPrototype } from "../types.js";

export const engineeringArea: AreaPrototype = {
  id: "engineering",
  label: "Engineering",
  purpose:
    "Design, build, and ship reliable software that delivers product value without creating operational debt.",
  how: "Works from tickets and RFCs, breaks work into PRs, reviews code, instruments changes, and coordinates with Product/IT/Data on risk.",
  why: "Protects delivery speed and system integrity — bad changes become outages, data loss, or silent customer harm.",
  defaultTools: ["done", "send_message", "read_inbox"],
  scenarioSeeds: [
    "A production bug is reported mid-sprint; decide hotfix vs rollback vs schedule.",
    "Product asks for a feature that conflicts with a hard reliability deadline.",
  ],
  defaultTitle: "Software Engineer",
};
