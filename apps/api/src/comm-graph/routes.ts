/** Communication weights between saved agents (roadmap step 1). */
import { Hono } from "hono";
import { getCommGraph, rebuildCommObservations } from "../db/comm-repo.js";
import { requireAdmin } from "../security/admin.js";
import { errorMessage } from "../security/redact.js";

export const commGraphRoutes = new Hono();

commGraphRoutes.get("/", async (c) => {
  try {
    return c.json({ graph: await getCommGraph() });
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 500);
  }
});

/** Re-count every stored run's trace. A write (it replaces rows), so it needs the admin check. */
commGraphRoutes.post("/rebuild", requireAdmin, async (c) => {
  try {
    const result = await rebuildCommObservations();
    return c.json({ ...result, graph: await getCommGraph() });
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 500);
  }
});
