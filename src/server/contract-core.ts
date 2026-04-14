import { type Contract } from "@/server/db";

export function buildContractSummary(contract: Contract) {
  const pricing = JSON.parse(contract.pricingModelJson) as {
    baseUsd?: number;
    tokenMultiplier?: number;
    platformFeePct?: number;
  };
  const scope = JSON.parse(contract.accessScopeJson) as {
    actions?: string[];
    tools?: string[];
  };
  const sla = JSON.parse(contract.slaJson) as {
    responseSeconds?: number;
    successRateFloor?: number;
  };

  return {
    id: contract.id,
    status: contract.status,
    serviceAccountRef: contract.serviceAccountRef,
    pricing,
    scope,
    sla,
  };
}

export type ContractAccessDecision = {
  allowed: boolean;
  reason: string;
  violation:
    | "missing_contract"
    | "inactive_contract"
    | "action_not_allowed"
    | "tool_not_allowed"
    | null;
};

export function evaluateContractAccess(args: {
  contract: Contract | null;
  isCrossKingdomCall: boolean;
  action: string;
  tool: string;
}) {
  if (!args.isCrossKingdomCall) {
    return {
      allowed: true,
      reason: "同 Kingdom 调用，无需跨边界 Contract。",
      violation: null,
    } satisfies ContractAccessDecision;
  }

  if (!args.contract) {
    return {
      allowed: false,
      reason: "跨 Kingdom 调用缺少 Contract。",
      violation: "missing_contract",
    } satisfies ContractAccessDecision;
  }

  if (args.contract.status !== "active") {
    return {
      allowed: false,
      reason: `Contract 状态为 ${args.contract.status}，不可执行跨边界动作。`,
      violation: "inactive_contract",
    } satisfies ContractAccessDecision;
  }

  const scope = JSON.parse(args.contract.accessScopeJson) as {
    actions?: string[];
    tools?: string[];
  };
  const actionScope = scope.actions ?? [];
  const toolScope = scope.tools ?? [];

  if (actionScope.length > 0 && !actionScope.includes(args.action)) {
    return {
      allowed: false,
      reason: `动作 ${args.action} 不在 Contract action scope 中。`,
      violation: "action_not_allowed",
    } satisfies ContractAccessDecision;
  }

  if (toolScope.length > 0 && !toolScope.includes(args.tool)) {
    return {
      allowed: false,
      reason: `工具 ${args.tool} 不在 Contract tool scope 中。`,
      violation: "tool_not_allowed",
    } satisfies ContractAccessDecision;
  }

  return {
    allowed: true,
    reason: "Contract scope 校验通过。",
    violation: null,
  } satisfies ContractAccessDecision;
}
