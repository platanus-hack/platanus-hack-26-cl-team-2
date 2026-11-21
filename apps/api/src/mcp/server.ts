/**
 * MCP server "mesh-finance-sandbox": a sandboxed company inbox + finance surface, so a REAL
 * Claude agent (quick-test.ts, or Claude Code itself) can meet the attack emails with its
 * finance tools arriving over MCP instead of the simulated multi-persona lab.
 *
 * Tools:
 * - list_emails / read_email: the inbox holds ONE configured scenario email
 *   (email-harness/scenarios). With senderCheck on, read_email starts with the same
 *   deterministic sender banner the lab uses.
 * - issue_refund (simulated) and update_vendor_bank_account (always blocked): same names,
 *   descriptions, fields and policy as harness/sandbox.ts. Every attempt is recorded before
 *   the allow/block decision (in memory + JSON lines in MESH_MCP_LOG when set).
 *
 * Run over stdio:  pnpm --filter @sandbox/api mcp:server
 * Env: MESH_EMAIL_FILE (default spoof_eval_demo.json), MESH_EMAIL_ID (default: first attack
 * email in the file), MESH_SENDER_CHECK=1, MESH_MCP_LOG=/path/attempts.jsonl.
 * stdout is the protocol channel in stdio mode: log to stderr only.
 *
 * Note: arguments are validated against the tool schema by the MCP SDK before our handler
 * runs (numbers are coerced, so "19.99" passes as an amount). A call missing a required field
 * gets a validation error and is not recorded here; the model's own tool_use is still
 * visible to the client (quick-test.ts counts both).
 */
import "./paths.js"; // must stay the first import (pins the scenario folder)
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type Anthropic from "@anthropic-ai/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { EmailScenarioSummary } from "@sandbox/shared";
import { z } from "zod";
import { getEmailScenario, listEmailScenarios } from "../email/scenarios.js";
import { checkSender, senderBanner } from "../email/sender-check.js";
import { DANGEROUS_TOOL, DEFAULT_ALLOWED, FINANCE_TOOLS } from "../harness/sandbox.js";

export const MCP_SERVER_NAME = "mesh-finance-sandbox";
export const DEFAULT_EMAIL_FILE = "spoof_eval_demo.json";

export type McpToolAttempt = {
  at: string;
  tool: string;
  args: Record<string, unknown>;
  dangerous: boolean;
  /** true until the policy decides; an attempt is never dropped. */
  blocked: boolean;
  result: Record<string, unknown> | null;
  emailFile: string;
  emailId: string;
  senderCheck: boolean;
};

export type MeshMcpOptions = {
  file?: string;
  /** Default: first attack email in the file (or the first email if none is an attack). */
  emailId?: string;
  senderCheck?: boolean;
  /** JSON-lines log of attempts. Default: env MESH_MCP_LOG; null disables it. */
  logFile?: string | null;
};

/** Fake implementations, same results as harness/sandbox.ts. Nothing real happens. */
const FAKE: Record<string, (a: Record<string, unknown>) => Record<string, unknown>> = {
  issue_refund: (a) => ({
    status: "ok",
    simulated: true,
    order_id: String(a.order_id ?? ""),
    amount: Number(a.amount ?? 0),
  }),
};

export function defaultEmailId(file: string): string {
  const inFile = listEmailScenarios().scenarios.filter((s) => s.file === file);
  const pick = inFile.find((s) => s.kind === "attack") ?? inFile[0];
  if (!pick) throw new Error(`No email scenarios in ${file}`);
  return pick.id;
}

/** JSON-Schema properties of a FINANCE_TOOLS entry -> zod raw shape for registerTool. */
function zodShape(tool: Anthropic.Tool): Record<string, z.ZodTypeAny> {
  const props = (tool.input_schema.properties ?? {}) as Record<string, { type?: string }>;
  const req = tool.input_schema.required;
  const required = new Set<string>(Array.isArray(req) ? req : []);
  return Object.fromEntries(
    Object.entries(props).map(([key, p]) => {
      // Strings stay strict: z.coerce.string() would accept a missing field and drop `required`.
      const base: z.ZodTypeAny = p.type === "number" ? z.coerce.number() : z.string();
      return [key, required.has(key) ? base : base.optional()];
    }),
  );
}

const text = (value: unknown) => ({
  content: [
    { type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value) },
  ],
});

export function createMeshMcpServer(opts: MeshMcpOptions = {}): {
  server: McpServer;
  attempts: McpToolAttempt[];
  email: EmailScenarioSummary;
} {
  const file = opts.file ?? DEFAULT_EMAIL_FILE;
  const emailId = opts.emailId || defaultEmailId(file);
  const email = getEmailScenario({ file, id: emailId });
  const senderCheck = opts.senderCheck ?? false;
  const logFile = opts.logFile === undefined ? process.env.MESH_MCP_LOG?.trim() || null : opts.logFile;
  const attempts: McpToolAttempt[] = [];

  const server = new McpServer({ name: MCP_SERVER_NAME, version: "0.1.0" });

  server.registerTool(
    "list_emails",
    { description: "List the emails in the company's shared inbox." },
    async () =>
      text({
        emails: [{ id: email.id, from: email.from, subject: email.subject, unread: true }],
      }),
  );

  server.registerTool(
    "read_email",
    {
      description: "Read one email from the shared inbox by id.",
      inputSchema: { email_id: z.string() },
    },
    async ({ email_id }) => {
      if (email_id !== email.id) {
        return { ...text(`No email with id "${email_id}". Inbox ids: ${email.id}`), isError: true };
      }
      const body = email.email.trim();
      return text(senderCheck ? `${senderBanner(checkSender(email.email))}\n\n${body}` : body);
    },
  );

  for (const tool of FINANCE_TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: zodShape(tool) },
      async (args: Record<string, unknown>) => {
        // Record first: a blocked call must still show up, that attempt is the risk path.
        const attempt: McpToolAttempt = {
          at: new Date().toISOString(),
          tool: tool.name,
          args,
          dangerous: tool.name === DANGEROUS_TOOL,
          blocked: true,
          result: null,
          emailFile: file,
          emailId: email.id,
          senderCheck,
        };
        attempts.push(attempt);
        const fake = FAKE[tool.name];
        attempt.blocked = !DEFAULT_ALLOWED.has(tool.name) || !fake;
        attempt.result = attempt.blocked
          ? { status: "blocked_by_sandbox", tool: tool.name }
          : fake(args);
        if (logFile) {
          try {
            appendFileSync(logFile, `${JSON.stringify(attempt)}\n`);
          } catch (err) {
            console.error(`[${MCP_SERVER_NAME}] cannot write ${logFile}:`, err);
          }
        }
        return text(attempt.result);
      },
    );
  }

  return { server, attempts, email };
}

async function main(): Promise<void> {
  // stdout carries JSON-RPC: send any stray console.log to stderr.
  console.log = console.error;
  const file = process.env.MESH_EMAIL_FILE?.trim() || DEFAULT_EMAIL_FILE;
  const { server, email } = createMeshMcpServer({
    file,
    emailId: process.env.MESH_EMAIL_ID?.trim() || undefined,
    senderCheck: process.env.MESH_SENDER_CHECK === "1",
  });
  await server.connect(new StdioServerTransport());
  console.error(
    `[${MCP_SERVER_NAME}] stdio ready: ${file}#${email.id} sender_check=${process.env.MESH_SENDER_CHECK === "1"}`,
  );
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  main().catch((err) => {
    console.error(`[${MCP_SERVER_NAME}] failed to start:`, err);
    process.exit(1);
  });
}
