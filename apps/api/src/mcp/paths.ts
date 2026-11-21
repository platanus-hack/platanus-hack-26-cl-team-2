/**
 * Side-effect module: import it FIRST in MCP entry points.
 *
 * email/scenarios.ts resolves the scenario folder from process.cwd() at load time. An MCP
 * client (Claude Code, quick-test) may start the server from any directory, so pin the
 * folder to this repo unless EMAIL_SCENARIOS_DIR is already set.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const REPO_ROOT = resolve(API_DIR, "../..");
export const SERVER_PATH = resolve(API_DIR, "src/mcp/server.ts");

if (!process.env.EMAIL_SCENARIOS_DIR?.trim()) {
  process.env.EMAIL_SCENARIOS_DIR = resolve(REPO_ROOT, "email-harness/scenarios");
}
