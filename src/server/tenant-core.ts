import { type Kingdom, type World } from "@/server/db";

export function buildWorldSummary(world: World, kingdoms: Kingdom[]) {
  const quota = JSON.parse(world.quotaLimitJson) as {
    monthlyUsd?: number;
    maxRunningQuests?: number;
  };

  return {
    id: world.id,
    name: world.name,
    status: world.status,
    kingdomCount: kingdoms.filter((kingdom) => kingdom.worldId === world.id).length,
    monthlyUsd: quota.monthlyUsd ?? 0,
    maxRunningQuests: quota.maxRunningQuests ?? 0,
  };
}

export function buildKingdomSummary(kingdom: Kingdom) {
  return {
    id: kingdom.id,
    name: kingdom.name,
    status: kingdom.status,
    balance: kingdom.balance,
    creditLimit: kingdom.creditLimit,
    privateMemoryNamespace: kingdom.privateMemoryNamespace,
    toolRefCount: (JSON.parse(kingdom.privateToolRefsJson) as string[]).length,
  };
}
