import { serve } from "@hono/node-server";
import app from "./app.js";
import { config } from "./config.js";
import { pingDatabase } from "./db/client.js";

serve({ fetch: app.fetch, port: config.port }, async info => {
  const database = await pingDatabase();
  console.log("[api] port=" + info.port + " DB=" + database.ok);
});
