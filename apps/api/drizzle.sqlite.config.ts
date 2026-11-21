import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";
import { config } from "./src/config.js";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv();

export default defineConfig({
  schema: "./src/db/schema.sqlite.ts",
  out: "./drizzle-sqlite",
  dialect: "sqlite",
  dbCredentials: {
    url: config.sqlitePath || resolve(process.cwd(), "data/sandbox.sqlite"),
  },
});
