import type { AgentDefinition, ProviderRuntimeBinding } from "@/server/db";
import { parseJsonRecord, resolveRuntimeBindingConfig } from "@/server/runtime-provider-config";

export type AgentHarnessConfig = {
  approvalMode?: "allow" | "ask" | "deny" | "manual";
  humanIntervention?: "steer" | "follow_up" | "disabled";
  thinkingLevel?: "off" | "low" | "medium" | "high";
  maxToolCalls?: number;
};

export type AgentPermissionPolicy = {
  repositoryAccess?: "read_only" | "disabled";
  memoryAccess?: "inherit" | "private_only" | "team_shared" | "global";
  secretAccess?: "inherit" | "none" | "runtime_bound_only";
  allowedToolNames?: string[];
  deniedToolNames?: string[];
};

type HarnessCarrier = {
  harnessConfigJson?: string | null;
  permissionPolicyJson?: string | null;
};

function parseStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function parseAgentHarnessConfig(value: string | null | undefined): AgentHarnessConfig {
  const parsed = parseJsonRecord(value ?? "") as AgentHarnessConfig;
  return {
    approvalMode:
      parsed.approvalMode === "allow" ||
      parsed.approvalMode === "ask" ||
      parsed.approvalMode === "deny" ||
      parsed.approvalMode === "manual"
        ? parsed.approvalMode
        : undefined,
    humanIntervention:
      parsed.humanIntervention === "steer" ||
      parsed.humanIntervention === "follow_up" ||
      parsed.humanIntervention === "disabled"
        ? parsed.humanIntervention
        : undefined,
    thinkingLevel:
      parsed.thinkingLevel === "off" ||
      parsed.thinkingLevel === "low" ||
      parsed.thinkingLevel === "medium" ||
      parsed.thinkingLevel === "high"
        ? parsed.thinkingLevel
        : undefined,
    maxToolCalls:
      typeof parsed.maxToolCalls === "number" && Number.isFinite(parsed.maxToolCalls)
        ? Math.max(0, Math.min(50, Math.round(parsed.maxToolCalls)))
        : undefined,
  };
}

export function parseAgentPermissionPolicy(
  value: string | null | undefined,
): AgentPermissionPolicy {
  const parsed = parseJsonRecord(value ?? "") as AgentPermissionPolicy;
  return {
    repositoryAccess:
      parsed.repositoryAccess === "read_only" || parsed.repositoryAccess === "disabled"
        ? parsed.repositoryAccess
        : "read_only",
    memoryAccess:
      parsed.memoryAccess === "inherit" ||
      parsed.memoryAccess === "private_only" ||
      parsed.memoryAccess === "team_shared" ||
      parsed.memoryAccess === "global"
        ? parsed.memoryAccess
        : "inherit",
    secretAccess:
      parsed.secretAccess === "inherit" ||
      parsed.secretAccess === "none" ||
      parsed.secretAccess === "runtime_bound_only"
        ? parsed.secretAccess
        : "runtime_bound_only",
    allowedToolNames: parseStringArray(parsed.allowedToolNames),
    deniedToolNames: parseStringArray(parsed.deniedToolNames),
  };
}

export function buildAgentHarnessExecutionProfile(
  carrier: HarnessCarrier,
  runtimeBinding?: ProviderRuntimeBinding | null,
) {
  const harness = parseAgentHarnessConfig(carrier.harnessConfigJson);
  const permissions = parseAgentPermissionPolicy(carrier.permissionPolicyJson);
  const runtimeConfig = runtimeBinding ? resolveRuntimeBindingConfig(runtimeBinding) : {};

  return {
    approvalMode: harness.approvalMode ?? runtimeConfig.approvalMode ?? "allow",
    humanIntervention: harness.humanIntervention ?? runtimeConfig.humanIntervention ?? "steer",
    thinkingLevel: runtimeConfig.thinkingLevel ?? harness.thinkingLevel ?? "medium",
    maxToolCalls: harness.maxToolCalls ?? 6,
    repositoryAccess: permissions.repositoryAccess ?? "read_only",
    memoryAccess: permissions.memoryAccess ?? "inherit",
    secretAccess: permissions.secretAccess ?? "runtime_bound_only",
    allowedToolNames: permissions.allowedToolNames ?? [],
    deniedToolNames: permissions.deniedToolNames ?? [],
  };
}

export function buildDefaultAgentHarnessConfig(): AgentHarnessConfig {
  return {
    approvalMode: "allow",
    humanIntervention: "steer",
    thinkingLevel: "medium",
    maxToolCalls: 6,
  };
}

export function buildDefaultAgentPermissionPolicy(): AgentPermissionPolicy {
  return {
    repositoryAccess: "read_only",
    memoryAccess: "inherit",
    secretAccess: "runtime_bound_only",
    allowedToolNames: ["search_repo", "read_file", "list_dir"],
    deniedToolNames: [],
  };
}

export function getAgentDefaultSystemPrompt(agentDefinition: Pick<AgentDefinition, "systemPrompt">) {
  return agentDefinition.systemPrompt;
}
