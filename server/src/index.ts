import "./env.js";
import { serve } from "@hono/node-server";
import { env } from "./env.js";
import app from "./app.js";

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🚀 Server running on http://localhost:${info.port}`);
  console.log(`   NODE_ENV : ${env.NODE_ENV}`);
});
