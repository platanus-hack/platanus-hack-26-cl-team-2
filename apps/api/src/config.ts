import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv();

function normalizeApiKey(raw: string | undefined): string {
  const key = (raw ?? "").trim();
  if (!key) return "";
  // Ignore .env.example placeholder
  if (key === "sk-ant-..." || key.endsWith("...")) return "";
  return key;
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  anthropicApiKey: normalizeApiKey(process.env.ANTHROPIC_API_KEY),
  model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
  maxTurnsPerAgent: Number(process.env.MAX_TURNS_PER_AGENT ?? 12),
};

export function assertApiKeyConfigured(): void {
  if (!config.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY missing. Copy .env.example to .env and paste your key.",
    );
  }
}
