import type Anthropic from "@anthropic-ai/sdk";

/** Minimal production-shaped tool surface for peer interaction. */
export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "send_message",
    description:
      "Send a message to the other agent. Use this to request info, propose a next step, or answer them.",
    input_schema: {
      type: "object",
      properties: {
        to_agent_id: {
          type: "string",
          description: "Exact id of the peer agent.",
        },
        body: {
          type: "string",
          description: "Clear, concise message content.",
        },
      },
      required: ["to_agent_id", "body"],
    },
  },
  {
    name: "read_inbox",
    description:
      "Read unread messages from your inbox. Call this when you expect a reply or before deciding next steps.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "done",
    description:
      "Call when your goal is complete or you cannot progress further. Include a short summary.",
    input_schema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "What you accomplished or why you are stopping.",
        },
      },
      required: ["summary"],
    },
  },
];
