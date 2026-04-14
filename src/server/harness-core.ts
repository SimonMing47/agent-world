import { type HarnessProfile } from "@/server/db";

export type ResolvedHarness = {
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

export function resolveHarnessProfile(profile: HarnessProfile): ResolvedHarness {
  const toolPolicy = JSON.parse(profile.toolPolicyJson) as {
    allowed?: string[];
    blocked?: string[];
    approvalRequired?: string[];
  };
  const budgetPolicy = JSON.parse(profile.budgetPolicyJson) as {
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
    maxRuntimeMs: budgetPolicy.maxRuntimeMs ?? 0,
    maxSteps: budgetPolicy.maxSteps ?? 0,
    maxToolCalls: budgetPolicy.maxToolCalls ?? 0,
    collapseThinkingByDefault: outputPolicy.collapseThinkingByDefault ?? true,
    structuredOutput: outputPolicy.structuredOutput ?? true,
    defaultLocale: outputPolicy.defaultLocale ?? "zh-CN",
    promptScan: securityPolicy.promptScan ?? true,
    outputScan: securityPolicy.outputScan ?? true,
  };
}

export function buildHarnessSummary(profile: HarnessProfile) {
  const resolved = resolveHarnessProfile(profile);

  return {
    id: profile.id,
    name: resolved.name,
    instruction: resolved.systemInstruction,
    allowedTools: resolved.allowedTools,
    blockedTools: resolved.blockedTools,
    approvalRequiredTools: resolved.approvalRequiredTools,
    budget: {
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
