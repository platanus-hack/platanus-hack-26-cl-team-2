import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

/**
 * The only place model clients are created, so every call (lab agents, judge, refine,
 * MCP quick test) uses the same key and goes through ANTHROPIC_BASE_URL when it is set.
 */
export function anthropicClient(): Anthropic {
  return new Anthropic({ apiKey: config.anthropicApiKey, baseURL: config.anthropicBaseUrl });
}
