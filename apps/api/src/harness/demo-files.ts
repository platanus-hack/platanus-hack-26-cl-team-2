/**
 * DEMO-mode .txt files with separate auto-generated read/write tools.
 *
 * Example: secrets.txt → secrets_txt_read, secrets_txt_write
 * ACL is per tool via agent.harnessTools / mockDbTools.
 */
import type Anthropic from "@anthropic-ai/sdk";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { traceBus } from "../events.js";

// On a read-only serverless filesystem (e.g. Vercel) the package dir under
// /var/task is not writable, so mkdir there throws ENOENT/EROFS and any demo
// endpoint that syncs files returns 500. Fall back to the OS temp dir there;
// locally we keep the repo-relative path so the folder is easy to inspect.
const DEMO_FILES_DIR = process.env.VERCEL
  ? join(tmpdir(), "mesh-mock-db-demo")
  : resolve(dirname(fileURLToPath(import.meta.url)), "../../mock-db/demo");

export type DemoFileSpec = {
  id: string;
  filename: string;
  content: string;
  label: string;
  readAgentIds: string[];
  writeAgentIds: string[];
};

export type DemoFileToolMeta = {
  tool: string;
  file: string;
  label: string;
  action: "read" | "write";
  fileId: string;
  sensitivity: "demo";
};

const registry = new Map<string, DemoFileToolMeta>();

export function slugFromFilename(filename: string): string {
  const base = filename.trim().toLowerCase().replace(/\.txt$/i, "");
  const slug = base
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || "file";
}

export function normalizeDemoFilename(raw: string): string {
  let name = raw.trim();
  if (!name) throw new Error("Filename is required");
  if (!name.toLowerCase().endsWith(".txt")) name = `${name}.txt`;
  if (!/^[\w.\- ]+\.txt$/i.test(name)) {
    throw new Error("Filename must be a simple .txt name");
  }
  return name;
}

export function toolsForDemoFile(filename: string): {
  read: string;
  write: string;
  slug: string;
} {
  const slug = slugFromFilename(filename);
  return {
    slug,
    read: `${slug}_txt_read`,
    write: `${slug}_txt_write`,
  };
}

export function isDemoFileTool(name: string): boolean {
  return registry.has(name);
}

export function listDemoFileTools(): DemoFileToolMeta[] {
  return [...registry.values()];
}

/** Unique files currently registered (one entry per .txt). */
export function listDemoFileCatalog(): Array<{
  tool: string;
  file: string;
  label: string;
  sensitivity: string;
  readTool: string;
  writeTool: string;
}> {
  const byFile = new Map<
    string,
    {
      tool: string;
      file: string;
      label: string;
      sensitivity: string;
      readTool: string;
      writeTool: string;
    }
  >();
  for (const meta of registry.values()) {
    const tools = toolsForDemoFile(meta.file);
    const existing = byFile.get(meta.file);
    if (!existing) {
      byFile.set(meta.file, {
        tool: tools.read,
        file: meta.file,
        label: meta.label,
        sensitivity: "demo",
        readTool: tools.read,
        writeTool: tools.write,
      });
    }
  }
  return [...byFile.values()];
}

export function demoFileAnthropicTools(
  allowed: readonly string[] | undefined,
): Anthropic.Tool[] {
  if (!allowed?.length) return [];
  const set = new Set(allowed);
  const tools: Anthropic.Tool[] = [];
  for (const meta of registry.values()) {
    if (!set.has(meta.tool)) continue;
    if (meta.action === "read") {
      tools.push({
        name: meta.tool,
        description: `Read the DEMO file ${meta.file} (${meta.label}). Returns plaintext contents. Only call if authorized.`,
        input_schema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      });
    } else {
      tools.push({
        name: meta.tool,
        description: `Overwrite the DEMO file ${meta.file} (${meta.label}). Provide the full new file body in content.`,
        input_schema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "Full new file contents.",
            },
          },
          required: ["content"],
        },
      });
    }
  }
  return tools;
}

export function filterDemoFileToolNames(
  tools: readonly string[] | undefined,
): string[] {
  if (!tools?.length) return [];
  return tools.filter((t) => isDemoFileTool(t));
}

function ensureDir(): void {
  mkdirSync(DEMO_FILES_DIR, { recursive: true });
}

function filePath(filename: string): string {
  return resolve(DEMO_FILES_DIR, filename);
}

/** Wipe registry + on-disk demo folder, then register files from the DEMO org. */
export function syncDemoFiles(files: DemoFileSpec[]): void {
  registry.clear();
  if (existsSync(DEMO_FILES_DIR)) {
    rmSync(DEMO_FILES_DIR, { recursive: true, force: true });
  }
  ensureDir();

  const usedSlugs = new Set<string>();
  for (const file of files) {
    const filename = normalizeDemoFilename(file.filename);
    let { slug, read, write } = toolsForDemoFile(filename);
    if (usedSlugs.has(slug)) {
      slug = `${slug}_${file.id.slice(-4)}`;
      read = `${slug}_txt_read`;
      write = `${slug}_txt_write`;
    }
    usedSlugs.add(slug);

    const label = file.label?.trim() || filename;
    writeFileSync(filePath(filename), `${file.content.trimEnd()}\n`, "utf8");

    registry.set(read, {
      tool: read,
      file: filename,
      label,
      action: "read",
      fileId: file.id,
      sensitivity: "demo",
    });
    registry.set(write, {
      tool: write,
      file: filename,
      label,
      action: "write",
      fileId: file.id,
      sensitivity: "demo",
    });
  }
}

export function accessDemoFile(
  runId: string,
  agentId: string,
  tool: string,
  args: Record<string, unknown>,
  allowed: readonly string[],
): Record<string, unknown> {
  const meta = registry.get(tool);
  if (!meta) {
    return { ok: false, error: `Unknown DEMO file tool: ${tool}` };
  }

  const granted = allowed.includes(tool);
  if (!granted) {
    const result = {
      ok: false,
      status: "denied",
      tool,
      file: meta.file,
      action: meta.action,
      error: `You are not authorized to ${meta.action} ${meta.file}.`,
    };
    emitAttempt(runId, agentId, tool, args, true, meta.file, result);
    return result;
  }

  const path = filePath(meta.file);

  if (meta.action === "read") {
    let content: string;
    try {
      content = readFileSync(path, "utf8").trimEnd();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `DEMO file missing: ${meta.file} (${message})`,
      };
    }
    const result = {
      ok: true,
      status: "ok",
      simulated: true,
      action: "read",
      tool,
      file: meta.file,
      label: meta.label,
      content,
    };
    emitAttempt(runId, agentId, tool, args, false, meta.file, {
      ...result,
      content: "[redacted in attempt meta]",
    });
    return result;
  }

  const content = String(args.content ?? "");
  if (!content.trim()) {
    return {
      ok: false,
      error: "content is required for write",
      tool,
      file: meta.file,
    };
  }

  try {
    writeFileSync(path, `${content.trimEnd()}\n`, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Failed to write ${meta.file}: ${message}` };
  }

  const result = {
    ok: true,
    status: "ok",
    simulated: true,
    action: "write",
    tool,
    file: meta.file,
    label: meta.label,
    bytes: content.length,
  };
  emitAttempt(
    runId,
    agentId,
    tool,
    { content: "[redacted]" },
    false,
    meta.file,
    result,
  );
  return result;
}

function emitAttempt(
  runId: string,
  agentId: string,
  tool: string,
  args: Record<string, unknown>,
  blocked: boolean,
  file: string,
  result: Record<string, unknown>,
): void {
  traceBus.emit(
    runId,
    "sandbox.tool_attempt",
    {
      tool,
      args,
      blocked,
      dangerous: false,
      mockDb: true,
      demoFile: true,
      file,
      result,
    },
    agentId,
  );
}
