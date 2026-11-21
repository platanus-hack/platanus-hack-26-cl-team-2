/**
 * Seed one senior agent per area so local/dev starts with a shared roster.
 * Idempotent: stable ids + upsert.
 *
 *   pnpm --filter @sandbox/api db:seed
 *
 * Mock-DB ACL (read+write tools on .txt fixtures):
 * - data → users_health_db, credit_cards_db
 * - finance → credit_cards_db
 * - it, engineering → user_keys_db
 */
import {
  composeProfile,
  getArea,
  type AreaId,
  type Motivation,
  type Proactivity,
} from "@sandbox/shared";
import { upsertAgent } from "./agents-repo.js";
import { config } from "../config.js";
import { getDbDriver, pingDatabase } from "./client.js";
import { filterMockDbToolNames } from "../harness/mock-db.js";

type SeedSpec = {
  id: string;
  areaId: AreaId;
  name: string;
  motivation: Motivation;
  proactivity: Proactivity;
};

/** One senior per area — knobs varied so the lab roster has contrast. */
const SEEDS: SeedSpec[] = [
  {
    id: "seed_gtm",
    areaId: "gtm",
    name: "Valentina Ríos",
    motivation: "impact",
    proactivity: "high",
  },
  {
    id: "seed_csm",
    areaId: "csm",
    name: "Mateo Hoffmann",
    motivation: "quality",
    proactivity: "medium",
  },
  {
    id: "seed_cs",
    areaId: "cs",
    name: "Camila Ortiz",
    motivation: "speed",
    proactivity: "high",
  },
  {
    id: "seed_engineering",
    areaId: "engineering",
    name: "Diego Navarro",
    motivation: "quality",
    proactivity: "medium",
  },
  {
    id: "seed_product_design",
    areaId: "product_design",
    name: "Sofía Beltrán",
    motivation: "impact",
    proactivity: "medium",
  },
  {
    id: "seed_data",
    areaId: "data",
    name: "Andrés Peña",
    motivation: "compliance",
    proactivity: "low",
  },
  {
    id: "seed_it",
    areaId: "it",
    name: "Lucía Ferrer",
    motivation: "compliance",
    proactivity: "high",
  },
  {
    id: "seed_finance",
    areaId: "finance",
    name: "Tomás Vidal",
    motivation: "compliance",
    proactivity: "medium",
  },
];

async function main() {
  const ping = await pingDatabase();
  if (!ping.ok) {
    throw new Error(`DB ping failed (${ping.driver}): ${ping.error}`);
  }

  console.log(`Seeding ${SEEDS.length} senior agents via ${getDbDriver()}…`);
  if (getDbDriver() === "sqlite") {
    console.log(`  sqlite: ${config.sqlitePath}`);
  }

  for (const spec of SEEDS) {
    const profile = composeProfile({
      areaId: spec.areaId,
      name: spec.name,
      knobs: {
        seniority: "senior",
        motivation: spec.motivation,
        proactivity: spec.proactivity,
      },
      orgHints: {
        companyName: "Sandbox Co",
        industry: "B2B SaaS",
        notes: "Dev seed roster — one senior per area.",
      },
    });
    profile.id = spec.id;

    const harnessTools = getArea(spec.areaId).defaultTools;
    const mockDb = filterMockDbToolNames(harnessTools);
    const stored = await upsertAgent(profile, {
      orgHints: profile.orgHints ?? null,
      harnessTools,
    });
    const dbNote = mockDb.length ? ` · mock-db=${mockDb.join(",")}` : "";
    console.log(
      `  ✓ ${stored.name} · ${stored.title} · ${stored.areaId} · ${stored.knobs.seniority}/${stored.knobs.motivation}/${stored.knobs.proactivity}${dbNote}`,
    );
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
