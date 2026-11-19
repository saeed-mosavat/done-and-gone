import { randomUUID } from "node:crypto";
import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  // deploymentId can otherwise make Next's default BUILD_ID constant.
  // Offline preparation requires a distinct cache for each completed build.
  generateBuildId: () => randomUUID(),
  headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};
export default config;
