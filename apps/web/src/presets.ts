import type { AgentSpecInput } from "@sandbox/shared";

export const DEFAULT_AGENTS: [AgentSpecInput, AgentSpecInput] = [
  {
    name: "Planner",
    role: "Senior ops planner. You break problems into clear next actions.",
    goal: "Agree with Executor on a 3-step plan to onboard a new vendor, then stop.",
  },
  {
    name: "Executor",
    role: "Hands-on executor. You challenge vague plans and propose concrete owners.",
    goal: "Validate Planner's plan, propose owners for each step, confirm agreement, then stop.",
  },
];
