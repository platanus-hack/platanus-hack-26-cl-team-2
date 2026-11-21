import type Anthropic from "@anthropic-ai/sdk";

/** Ping-pong messaging tools for multi-agent lab conversations. */
export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "send_message",
    description:
      "Send a message to another agent in this run. Use to ask, answer, delegate, or negotiate. Target their exact id from the peer directory.",
    input_schema: {
      type: "object",
      properties: {
        to_agent_id: {
          type: "string",
          description: "Exact id of the peer agent you are talking to.",
        },
        body: {
          type: "string",
          description: "Clear, concise message content for the peer.",
        },
      },
      required: ["to_agent_id", "body"],
    },
  },
  {
    name: "read_inbox",
    description:
      "Read unread messages from your inbox. Use this to see what the peer sent before replying or deciding next steps.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "done",
    description:
      "End your participation when your goal is complete, you reached agreement, or you are blocked. Include a short summary.",
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
