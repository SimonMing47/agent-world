import { type Agent, type Kingdom, type ProviderProfile, type World } from "@/server/db";

export function buildProviderSelection(args: {
  world: World;
  kingdom: Kingdom;
  agent: Agent;
  providers: ProviderProfile[];
}) {
  const whitelist = JSON.parse(args.world.modelWhitelistJson) as string[];
  const kingdomPolicy = JSON.parse(args.kingdom.policyJson) as {
    preferredProvider?: string;
  };

  const availableProviders = args.providers.filter((provider) => {
    const models = JSON.parse(provider.modelsJson) as string[];
    return provider.isEnabled && models.some((model) => whitelist.includes(model));
  });

  const preferred =
    availableProviders.find((provider) => provider.name === kingdomPolicy.preferredProvider) ??
    availableProviders.find((provider) =>
      (JSON.parse(provider.modelsJson) as string[]).includes(args.agent.model),
    ) ??
    availableProviders[0] ??
    null;

  return {
    provider: preferred,
    whitelist,
    rationale: preferred
      ? [
          `World 白名单允许使用 ${whitelist.join(", ")}。`,
          `Kingdom 的偏好 Provider 为 ${kingdomPolicy.preferredProvider ?? "未显式指定"}。`,
          `Agent ${args.agent.name} 当前偏好模型是 ${args.agent.model}。`,
        ]
      : ["当前没有启用中的 Provider 同时满足模型白名单约束。"],
  };
}
