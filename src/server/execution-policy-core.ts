import { type ExecutionPolicy } from "@/server/db";
import { uiText } from "@/lib/language-pack";

export type ResolvedExecutionPolicy = {
  name: string;
  systemInstruction: string;
  allowedTools: string[];
  blockedTools: string[];
  approvalRequiredTools: string[];
  maxRuntimeMs: number;
  maxSteps: number;
  maxToolCalls: number;
  collapseThinkingByDefault: boolean;
  structuredOutput: boolean;
  defaultLocale: string;
  promptScan: boolean;
  outputScan: boolean;
};

export type ExecutionPolicyScope = "Global" | "TenantSpace" | "BusinessTeam" | "AgentTeam";

export type ExecutionPolicyCompositionResult = {
  resolved: ResolvedExecutionPolicy;
  scopes: ExecutionPolicyScope[];
  sourceProfileIds: string[];
};

export function resolveExecutionPolicy(profile: ExecutionPolicy): ResolvedExecutionPolicy {
  const toolPolicy = JSON.parse(profile.toolPolicyJson) as {
    allowed?: string[];
    blocked?: string[];
    approvalRequired?: string[];
  };
  const limitPolicy = JSON.parse(profile.budgetPolicyJson) as {
    maxRuntimeMs?: number;
    maxSteps?: number;
    maxToolCalls?: number;
  };
  const outputPolicy = JSON.parse(profile.outputPolicyJson) as {
    collapseThinkingByDefault?: boolean;
    structuredOutput?: boolean;
    defaultLocale?: string;
  };
  const securityPolicy = JSON.parse(profile.securityPolicyJson) as {
    promptScan?: boolean;
    outputScan?: boolean;
  };

  return {
    name: profile.name,
    systemInstruction: profile.systemInstruction,
    allowedTools: toolPolicy.allowed ?? [],
    blockedTools: toolPolicy.blocked ?? [],
    approvalRequiredTools: toolPolicy.approvalRequired ?? [],
    maxRuntimeMs: limitPolicy.maxRuntimeMs ?? 0,
    maxSteps: limitPolicy.maxSteps ?? 0,
    maxToolCalls: limitPolicy.maxToolCalls ?? 0,
    collapseThinkingByDefault: outputPolicy.collapseThinkingByDefault ?? true,
    structuredOutput: outputPolicy.structuredOutput ?? true,
    defaultLocale: outputPolicy.defaultLocale ?? "zh-CN",
    promptScan: securityPolicy.promptScan ?? true,
    outputScan: securityPolicy.outputScan ?? true,
  };
}

function intersectAllowedTools(current: string[], incoming: string[]) {
  // An empty list means this layer does not narrow the inherited allow list.
  if (incoming.length === 0) return current;
  if (current.length === 0) return incoming;
  return current.filter((tool) => incoming.includes(tool));
}

function pickMinPositive(current: number, incoming: number) {
  if (incoming <= 0) return current;
  if (current <= 0) return incoming;
  return Math.min(current, incoming);
}

function dedupe(values: string[]) {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

function detectExecutionPolicyScope(profile: ExecutionPolicy): ExecutionPolicyScope {
  if (profile.teamId) return "AgentTeam";
  if (profile.businessTeamId) return "BusinessTeam";
  if (profile.tenantSpaceId) return "TenantSpace";
  return "Global";
}

export function composeExecutionPolicy(args: {
  profiles: ExecutionPolicy[];
  tenantSpaceId: string;
  businessTeamId: string;
  teamId: string;
}) {
  const ordered = args.profiles
    .filter((profile) => !profile.tenantSpaceId && !profile.businessTeamId && !profile.teamId)
    .concat(
      args.profiles.filter(
        (profile) =>
          profile.tenantSpaceId === args.tenantSpaceId && !profile.businessTeamId && !profile.teamId,
      ),
      args.profiles.filter((profile) => profile.businessTeamId === args.businessTeamId && !profile.teamId),
      args.profiles.filter((profile) => profile.teamId === args.teamId),
    );

  const base: ResolvedExecutionPolicy = {
    name: uiText("ui.generated.cd2822a7873"),
    systemInstruction: "",
    allowedTools: [],
    blockedTools: [],
    approvalRequiredTools: [],
    maxRuntimeMs: 0,
    maxSteps: 0,
    maxToolCalls: 0,
    collapseThinkingByDefault: true,
    structuredOutput: true,
    defaultLocale: "zh-CN",
    promptScan: true,
    outputScan: true,
  };

  const scopes: ExecutionPolicyScope[] = [];
  const sourceProfileIds: string[] = [];
  let composed = base;

  for (const profile of ordered) {
    const resolved = resolveExecutionPolicy(profile);
    composed = {
      name: resolved.name,
      systemInstruction: [composed.systemInstruction, resolved.systemInstruction]
        .filter(Boolean)
        .join("\n"),
      allowedTools: intersectAllowedTools(composed.allowedTools, resolved.allowedTools),
      blockedTools: dedupe([...composed.blockedTools, ...resolved.blockedTools]),
      approvalRequiredTools: dedupe([
        ...composed.approvalRequiredTools,
        ...resolved.approvalRequiredTools,
      ]),
      maxRuntimeMs: pickMinPositive(composed.maxRuntimeMs, resolved.maxRuntimeMs),
      maxSteps: pickMinPositive(composed.maxSteps, resolved.maxSteps),
      maxToolCalls: pickMinPositive(composed.maxToolCalls, resolved.maxToolCalls),
      collapseThinkingByDefault: resolved.collapseThinkingByDefault,
      structuredOutput: resolved.structuredOutput,
      defaultLocale: resolved.defaultLocale ?? composed.defaultLocale,
      // Safety scans use a union strategy so lower layers cannot disable upstream protection.
      promptScan: composed.promptScan || resolved.promptScan,
      outputScan: composed.outputScan || resolved.outputScan,
    };
    scopes.push(detectExecutionPolicyScope(profile));
    sourceProfileIds.push(profile.id);
  }

  const blockedSet = new Set(composed.blockedTools);

  return {
    resolved: {
      ...composed,
      approvalRequiredTools: composed.approvalRequiredTools.filter(
        (tool) => !blockedSet.has(tool),
      ),
    },
    scopes,
    sourceProfileIds,
  } satisfies ExecutionPolicyCompositionResult;
}

export type ExecutionPolicyToolDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
  policyHit:
    | "allow"
    | "blocked_tool"
    | "not_allowed_tool"
    | "approval_required_tool";
};

export function evaluateExecutionPolicyToolPolicy(
  composed: ResolvedExecutionPolicy,
  toolName: string,
): ExecutionPolicyToolDecision {
  if (composed.blockedTools.includes(toolName)) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: uiText("ui.server.executionPolicy.blockedTool", undefined, { toolName }),
      policyHit: "blocked_tool",
    };
  }

  if (composed.allowedTools.length > 0 && !composed.allowedTools.includes(toolName)) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: uiText("ui.server.executionPolicy.notAllowedTool", undefined, { toolName }),
      policyHit: "not_allowed_tool",
    };
  }

  if (composed.approvalRequiredTools.includes(toolName)) {
    return {
      allowed: true,
      requiresApproval: true,
      reason: uiText("ui.server.executionPolicy.approvalTool", undefined, { toolName }),
      policyHit: "approval_required_tool",
    };
  }

  return {
    allowed: true,
    requiresApproval: false,
    reason: uiText("ui.server.executionPolicy.allowedTool", undefined, { toolName }),
    policyHit: "allow",
  };
}

export function buildExecutionPolicySummary(profile: ExecutionPolicy) {
  const resolved = resolveExecutionPolicy(profile);

  return {
    id: profile.id,
    name: resolved.name,
    instruction: resolved.systemInstruction,
    allowedTools: resolved.allowedTools,
    blockedTools: resolved.blockedTools,
    approvalRequiredTools: resolved.approvalRequiredTools,
    limits: {
      maxRuntimeMinutes: Math.round(resolved.maxRuntimeMs / 60000),
      maxSteps: resolved.maxSteps,
      maxToolCalls: resolved.maxToolCalls,
    },
    safety: {
      collapseThinkingByDefault: resolved.collapseThinkingByDefault,
      structuredOutput: resolved.structuredOutput,
      defaultLocale: resolved.defaultLocale,
      promptScan: resolved.promptScan,
      outputScan: resolved.outputScan,
    },
  };
}
