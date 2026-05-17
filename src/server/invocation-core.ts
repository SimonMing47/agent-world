import { buildExecutionPolicySummary } from "@/server/execution-policy-core";
import {
  type Agent,
  type AgentTeam,
  type AccessGrant,
  type ExecutionPolicy,
  type BusinessTeam,
  type ProviderProfile,
  type RuntimeEndpoint,
  type TenantSpace,
} from "@/server/db";
import { uiText } from "@/lib/language-pack";

export type InvocationStage = {
  key: string;
  label: string;
  owner: string;
  description: string;
};

export function buildInvocationPlan(args: {
  tenantSpace: TenantSpace;
  businessTeam: BusinessTeam;
  team: AgentTeam;
  agent: Agent;
  executionPolicy: ExecutionPolicy;
  runtime: RuntimeEndpoint | null;
  provider: ProviderProfile | null;
  accessGrant: AccessGrant | null;
}) {
  const executionPolicy = buildExecutionPolicySummary(args.executionPolicy);
  const runtimeName = args.runtime?.name ?? uiText("ui.generated.cb0d8f8f854");
  const providerName = args.provider?.name ?? uiText("ui.generated.c7afbbac594");

  const stages: InvocationStage[] = [
    {
      key: "envelope",
      label: uiText("ui.generated.cd9162444dd"),
      owner: "invocation-core",
      description: uiText("ui.generated.c1b73db886f"),
    },
    {
      key: "executionPolicy",
      label: uiText("ui.generated.cc025a65a39"),
      owner: "execution-policy-core",
      description: uiText("ui.server.invocation.mergePolicy", undefined, { policyName: executionPolicy.name }),
    },
    {
      key: "accessGrant",
      label: uiText("ui.generated.c8ee81b5926"),
      owner: "access-grant-core",
      description: args.accessGrant
        ? uiText("ui.generated.c29ad4c5c4b")
        : uiText("ui.server.invocation.sameBusinessTeam", undefined, { teamName: args.businessTeam.name }),
    },
    {
      key: "provider",
      label: uiText("ui.generated.c1a1e8def94"),
      owner: "model-service-core",
      description: uiText("ui.server.invocation.routeProvider", undefined, {
        tenantName: args.tenantSpace.name,
        providerName,
      }),
    },
    {
      key: "runtime",
      label: uiText("ui.generated.ce92dd711eb"),
      owner: "execution-core",
      description: uiText("ui.server.invocation.mountRuntime", undefined, { runtimeName }),
    },
    {
      key: "trace",
      label: uiText("ui.generated.cd8971310ee"),
      owner: "trace-core",
      description: uiText("ui.server.invocation.traceAgent", undefined, { agentName: args.agent.name }),
    },
  ];

  if (executionPolicy.approvalRequiredTools.length > 0) {
    stages.push({
      key: "gate",
      label: uiText("ui.generated.cf436fbc144"),
      owner: "human-gate",
      description: uiText("ui.server.invocation.approvalGate", undefined, {
        tools: executionPolicy.approvalRequiredTools.join(", "),
      }),
    });
  }

  stages.push({
    key: "finalize",
    label: uiText("ui.generated.c6ef37f44e1"),
    owner: "executor-core",
    description: uiText("ui.generated.cbd6e4b1ed3"),
  });

  return stages;
}
