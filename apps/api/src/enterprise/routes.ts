import { Hono } from "hono";
import {
  AREA_IDS,
  ENTERPRISE_PRESETS,
  composeEnterprise,
  totalAgents,
  type AreaId,
  type AreaHeadcount,
} from "@sandbox/shared";
import { z } from "zod";
import { upsertAgent } from "../db/agents-repo.js";

const areaCount = z.number().int().min(0).max(200).optional();

/**
 * One optional count per area, derived from AREA_IDS so a new area (e.g. finance)
 * can never be silently dropped. Strict: an unknown area key is a 400, not a no-op.
 */
export const areaCountSchema = z
  .object(
    Object.fromEntries(AREA_IDS.map((id) => [id, areaCount])) as Record<
      AreaId,
      typeof areaCount
    >,
  )
  .strict();

export const generateSchema = z.object({
  companyName: z.string().max(120).optional(),
  orgSizePreset: z.union([z.literal(100), z.literal(200), z.literal(400)]).optional(),
  counts: areaCountSchema.default({}),
  seniorityMix: z
    .object({
      junior: z.number().min(0).max(1).optional(),
      mid: z.number().min(0).max(1).optional(),
      senior: z.number().min(0).max(1).optional(),
    })
    .optional(),
  /** Persist all profiles to DB (no AI). Default true. */
  persist: z.boolean().optional().default(true),
});

export const enterpriseRoutes = new Hono();

enterpriseRoutes.get("/presets", (c) =>
  c.json({
    presets: ENTERPRISE_PRESETS,
    areas: AREA_IDS,
    defaultSeniorityMix: { junior: 0.25, mid: 0.5, senior: 0.25 },
    note: "Deterministic only — no LLM / no token spend.",
  }),
);

enterpriseRoutes.post("/generate", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = generateSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Solicitud inválida", details: parsed.error.flatten() }, 400);
  }

  const { companyName, orgSizePreset, counts, seniorityMix, persist } =
    parsed.data;

  const result = composeEnterprise({
    companyName,
    orgSizePreset,
    counts: counts as Partial<AreaHeadcount>,
    seniorityMix,
  });

  if (totalAgents(result.counts) === 0) {
    return c.json({ error: "Todas las cantidades por área están en cero." }, 400);
  }

  if (totalAgents(result.counts) > 500) {
    return c.json(
      { error: "El máximo es 500 agentes por generación." },
      400,
    );
  }

  let saved = 0;
  if (persist) {
    for (const profile of result.profiles) {
      await upsertAgent(profile, { orgHints: profile.orgHints ?? null });
      saved += 1;
    }
  }

  const byArea = {} as Record<AreaId, number>;
  for (const id of AREA_IDS) byArea[id] = 0;
  for (const p of result.profiles) byArea[p.areaId] += 1;

  const bySeniority = { junior: 0, mid: 0, senior: 0, staff: 0 };
  for (const p of result.profiles) {
    bySeniority[p.knobs.seniority] += 1;
  }

  return c.json({
    companyName: result.companyName,
    counts: result.counts,
    seniorityMix: result.seniorityMix,
    total: result.profiles.length,
    saved,
    persisted: persist,
    refinedByModel: false,
    usedAi: false,
    summary: { byArea, bySeniority },
    profiles: result.profiles,
  });
});
