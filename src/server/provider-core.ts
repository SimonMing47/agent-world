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
          `World whitelist allows ${whitelist.join(", ")}.`,
          `Kingdom preference points to ${kingdomPolicy.preferredProvider ?? "no explicit provider"}.`,
          `Agent ${args.agent.name} prefers ${args.agent.model}.`,
        ]
      : ["No enabled provider satisfies the current model whitelist."],
  };
}
