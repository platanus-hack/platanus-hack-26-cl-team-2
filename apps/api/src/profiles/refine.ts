import Anthropic from "@anthropic-ai/sdk";
import { anthropicClient } from "../anthropic-client.js";
import type { AgentProfile } from "@sandbox/shared";
import { assertApiKeyConfigured, config } from "../config.js";

const REFINE_MODEL =
  process.env.ANTHROPIC_REFINE_MODEL ?? "claude-haiku-4-5-20251001";

type RefineFields = {
  systemContext: string;
  operatingStyle: string[];
  goalTemplate: string;
};

function extractJsonObject(text: string): RefineFields {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) {
    throw new Error("Refine model did not return JSON");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<RefineFields>;
  if (
    typeof parsed.systemContext !== "string" ||
    !Array.isArray(parsed.operatingStyle) ||
    typeof parsed.goalTemplate !== "string"
  ) {
    throw new Error("Refine JSON missing required fields");
  }
  return {
    systemContext: parsed.systemContext.trim(),
    operatingStyle: parsed.operatingStyle
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8),
    goalTemplate: parsed.goalTemplate.trim(),
  };
}

/** Cheap Haiku pass: polish wording only, keep area truth + knobs. */
export async function refineProfileWithHaiku(
  profile: AgentProfile,
): Promise<AgentProfile> {
  assertApiKeyConfigured();

  const client = anthropicClient();

  const response = await client.messages.create({
    model: REFINE_MODEL,
    max_tokens: 600,
    system: [
      "You refine corporate agent harness profiles.",
      "Keep the area purpose/how/why facts intact.",
      "Only sharpen voice to match seniority, motivation, and proactivity.",
      "Do not invent new tools, policies, or company facts.",
      "Respond with JSON only: { systemContext, operatingStyle, goalTemplate }",
      "operatingStyle must be an array of 4-7 short bullet strings.",
      "Keep systemContext under 900 characters. Keep goalTemplate under 280 characters.",
    ].join(" "),
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          knobs: profile.knobs,
          name: profile.name,
          title: profile.title,
          areaId: profile.areaId,
          draft: {
            systemContext: profile.systemContext,
            operatingStyle: profile.operatingStyle,
            goalTemplate: profile.goalTemplate,
          },
        }),
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const refined = extractJsonObject(text);

  return {
    ...profile,
    systemContext: refined.systemContext || profile.systemContext,
    operatingStyle:
      refined.operatingStyle.length > 0
        ? refined.operatingStyle
        : profile.operatingStyle,
    goalTemplate: refined.goalTemplate || profile.goalTemplate,
    refinedByModel: true,
  };
}

export function refineModelId(): string {
  return REFINE_MODEL;
}
