import { type AccessGrant } from "@/server/db";

export function buildAccessGrantSummary(accessGrant: AccessGrant) {
  const pricing = JSON.parse(accessGrant.pricingModelJson) as {
    baseUsd?: number;
    tokenMultiplier?: number;
    platformFeePct?: number;
  };
  const scope = JSON.parse(accessGrant.accessScopeJson) as {
    actions?: string[];
    tools?: string[];
  };
  const sla = JSON.parse(accessGrant.slaJson) as {
    responseSeconds?: number;
    successRateFloor?: number;
  };

  return {
    id: accessGrant.id,
    status: accessGrant.status,
    serviceAccountRef: accessGrant.serviceAccountRef,
    pricing,
    scope,
    sla,
  };
}

export type AccessGrantDecision = {
  allowed: boolean;
  reason: string;
  violation:
    | "missing_access_grant"
    | "inactive_access_grant"
    | "action_not_allowed"
    | "tool_not_allowed"
    | null;
};

export function evaluateAccessGrantAccess(args: {
  accessGrant: AccessGrant | null;
  isCrossBusinessTeamCall: boolean;
  action: string;
  tool: string;
}) {
  if (!args.isCrossBusinessTeamCall) {
    return {
      allowed: true,
      reason: "同业务团队调用，无需跨团队授权。",
      violation: null,
    } satisfies AccessGrantDecision;
  }

  if (!args.accessGrant) {
    return {
      allowed: false,
      reason: "跨业务团队调用缺少跨团队授权。",
      violation: "missing_access_grant",
    } satisfies AccessGrantDecision;
  }

  if (args.accessGrant.status !== "active") {
    return {
      allowed: false,
      reason: `跨团队授权状态为 ${args.accessGrant.status}，不可执行跨团队动作。`,
      violation: "inactive_access_grant",
    } satisfies AccessGrantDecision;
  }

  const scope = JSON.parse(args.accessGrant.accessScopeJson) as {
    actions?: string[];
    tools?: string[];
  };
  const actionScope = scope.actions ?? [];
  const toolScope = scope.tools ?? [];

  if (actionScope.length > 0 && !actionScope.includes(args.action)) {
    return {
      allowed: false,
      reason: `动作 ${args.action} 不在跨团队授权动作范围中。`,
      violation: "action_not_allowed",
    } satisfies AccessGrantDecision;
  }

  if (toolScope.length > 0 && !toolScope.includes(args.tool)) {
    return {
      allowed: false,
      reason: `工具 ${args.tool} 不在跨团队授权工具范围中。`,
      violation: "tool_not_allowed",
    } satisfies AccessGrantDecision;
  }

  return {
    allowed: true,
    reason: "跨团队授权范围校验通过。",
    violation: null,
  } satisfies AccessGrantDecision;
}
