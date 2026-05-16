import { type RuntimeEndpoint } from "@/server/db";

export type DiscoveredRuntime = {
  baseUrl: string;
  status: "healthy" | "degraded" | "offline";
  agents: string[];
  providers: string[];
  latencyMs: number | null;
  note: string;
};

function unwrapData(value: unknown) {
  if (value && typeof value === "object" && "data" in value) {
    return (value as { data: unknown }).data;
  }

  return value;
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const named = item as { name?: string; id?: string };
          return named.name ?? named.id ?? JSON.stringify(item);
        }

        return String(item);
      })
      .filter(Boolean);
  }

  return [];
}

export async function inspectOpenCodeRuntime(baseUrl: string): Promise<DiscoveredRuntime> {
  const start = Date.now();

  try {
    const { createOpencodeClient } = await import("@opencode-ai/sdk");
    const client = createOpencodeClient({ baseUrl });
    const [agentsResult, providersResult] = await Promise.all([
      client.app.agents(),
      client.config.providers(),
    ]);

    return {
      baseUrl,
      status: "healthy",
      agents: toStringArray(unwrapData(agentsResult)),
      providers: toStringArray(unwrapData(providersResult)),
      latencyMs: Date.now() - start,
      note: "Discovered via OpenCode SDK",
    };
  } catch (error) {
    return {
      baseUrl,
      status: "offline",
      agents: [],
      providers: [],
      latencyMs: null,
      note: error instanceof Error ? error.message : "Runtime probe failed",
    };
  }
}

export async function discoverConfiguredRuntimes(runtimes: RuntimeEndpoint[]) {
  const candidates = Array.from(
    new Set([
      "http://127.0.0.1:4096",
      "http://localhost:4096",
      ...runtimes.map((runtime) => runtime.baseUrl),
    ]),
  );

  return Promise.all(candidates.map((candidate) => inspectOpenCodeRuntime(candidate)));
}
