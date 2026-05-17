import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@earendil-works/pi-ai", "@earendil-works/pi-agent-core"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
