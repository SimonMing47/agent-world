import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.31.221"],
  serverExternalPackages: ["@earendil-works/pi-ai", "@earendil-works/pi-agent-core"],
  outputFileTracingExcludes: {
    "*": [
      "./.next/**",
      "./.venv-openviking/**",
      "./data/**",
      "./dist/**",
      "./node_modules/.cache/**",
      "./output/**",
      "./thirdparty/openviking/bin/**",
      "./next.config.ts",
    ],
  },
  turbopack: {
    root: /* turbopackIgnore: true */ process.cwd(),
  },
};

export default nextConfig;
