import type { NextConfig } from "next";

/**
 * Target for same-container API (Docker/Railway `start.sh` runs uvicorn on 8000).
 * - `DOCKER_INTERNAL_API` is set only in our Dockerfile so Railway project vars like
 *   `API_INTERNAL_URL=http://127.0.0.1:8080` (often confused with `PORT`) cannot break rewrites.
 * - Local dev on port 8080: set `API_INTERNAL_URL=http://127.0.0.1:8080` in `client/.env.local`.
 */
const API_INTERNAL =
  (process.env.DOCKER_INTERNAL_API || "").trim() ||
  (process.env.API_INTERNAL_URL || "").trim() ||
  "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_INTERNAL}/api/:path*` },
      { source: "/health", destination: `${API_INTERNAL}/health` },
      { source: "/ping", destination: `${API_INTERNAL}/ping` },
      { source: "/openapi.json", destination: `${API_INTERNAL}/openapi.json` },
    ];
  },
};

export default nextConfig;
