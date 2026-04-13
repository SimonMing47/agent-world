import { buildHarnessSummary } from "@/server/harness-core";
import {
  type Agent,
  type AgentTeam,
  type Contract,
  type HarnessProfile,
  type Kingdom,
  type ProviderProfile,
  type RuntimeEndpoint,
  type World,
} from "@/server/db";

export type InvocationStage = {
  key: string;
  label: string;
  owner: string;
  description: string;
};

export function buildInvocationPlan(args: {
  world: World;
  kingdom: Kingdom;
  team: AgentTeam;
  agent: Agent;
  harness: HarnessProfile;
  runtime: RuntimeEndpoint | null;
  provider: ProviderProfile | null;
  contract: Contract | null;
}) {
  const harness = buildHarnessSummary(args.harness);
  const runtimeName = args.runtime?.name ?? "No runtime selected";
  const providerName = args.provider?.name ?? "No provider selected";

  const stages: InvocationStage[] = [
    {
      key: "envelope",
      label: "Build invocation envelope",
      owner: "invocation-core",
      description: `Assemble world, kingdom, team, agent, and quest context before the first token is requested.`,
    },
    {
      key: "harness",
      label: "Resolve harness constraints",
      owner: "harness-core",
      description: `Merge ${harness.name} with team and world policy so tool, budget, and output rules are explicit.`,
    },
    {
      key: "contract",
      label: "Validate contract scope",
      owner: "contract-core",
      description: args.contract
        ? `Apply access scope and pricing limits from the active contract before external service work starts.`
        : `Skip cross-kingdom scope expansion because this invocation stays inside ${args.kingdom.name}.`,
    },
    {
      key: "provider",
      label: "Select model provider",
      owner: "provider-core",
      description: `Route the call through ${providerName} while staying inside the World model whitelist of ${args.world.name}.`,
    },
    {
      key: "runtime",
      label: "Attach execution runtime",
      owner: "runtime-core",
      description: `Use ${runtimeName} if available and keep runtime health visible before the node commits to work.`,
    },
    {
      key: "trace",
      label: "Stream trace and tool events",
      owner: "trace-core",
      description: `Write thinking, tool activity, approvals, and text output as replayable event groups for ${args.agent.name}.`,
    },
  ];

  if (harness.approvalRequiredTools.length > 0) {
    stages.push({
      key: "gate",
      label: "Pause on human gate",
      owner: "human-gate",
      description: `Pause before protected actions such as ${harness.approvalRequiredTools.join(", ")} and wait for explicit approval.`,
    });
  }

  stages.push({
    key: "finalize",
    label: "Finalize node result",
    owner: "executor-core",
    description: `Validate output, record cost, and transition the Quest node to its next stable state.`,
  });

  return stages;
}
