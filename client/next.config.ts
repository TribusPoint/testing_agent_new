import type { NextConfig } from "next";

/**
 * Target for same-container API (Docker/Railway `start.sh` runs uvicorn on 8000).
 * Local dev on port 8080: set `API_INTERNAL_URL=http://127.0.0.1:8080` in `client/.env.local`.
 */
const API_INTERNAL = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

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
