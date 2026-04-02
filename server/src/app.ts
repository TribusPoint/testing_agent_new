import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());
app.use("*", prettyJSON());

app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Phase 2+: mount routers here
// app.route("/api/agent-configs", agentConfigRoutes);
// app.route("/api/scenarios", scenarioRoutes);
// app.route("/api/test-runs", testRunRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
