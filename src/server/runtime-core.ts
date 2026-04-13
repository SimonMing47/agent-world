import { type RuntimeEndpoint } from "@/server/db";

export function buildRuntimeSummary(runtime: RuntimeEndpoint) {
  return {
    id: runtime.id,
    name: runtime.name,
    baseUrl: runtime.baseUrl,
    healthStatus: runtime.healthStatus,
    runtimeKind: runtime.runtimeKind,
    activeRunCount: runtime.activeRunCount,
    concurrencyLimit: runtime.concurrencyLimit,
    agents: JSON.parse(runtime.agentCatalogJson) as string[],
    providers: JSON.parse(runtime.providerCatalogJson) as string[],
  };
}
