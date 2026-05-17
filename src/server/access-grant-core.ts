import { type AccessGrant } from "@/server/db";
import { uiText } from "@/lib/language-pack";

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
      reason: uiText("ui.generated.cce1d28ac02"),
      violation: null,
    } satisfies AccessGrantDecision;
  }

  if (!args.accessGrant) {
    return {
      allowed: false,
      reason: uiText("ui.generated.c5bb755df3c"),
      violation: "missing_access_grant",
    } satisfies AccessGrantDecision;
  }

  if (args.accessGrant.status !== "active") {
    return {
      allowed: false,
      reason: uiText("ui.server.accessGrant.statusBlocked", undefined, { status: args.accessGrant.status }),
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
      reason: uiText("ui.server.accessGrant.actionOutOfScope", undefined, { action: args.action }),
      violation: "action_not_allowed",
    } satisfies AccessGrantDecision;
  }

  if (toolScope.length > 0 && !toolScope.includes(args.tool)) {
    return {
      allowed: false,
      reason: uiText("ui.server.accessGrant.toolOutOfScope", undefined, { tool: args.tool }),
      violation: "tool_not_allowed",
    } satisfies AccessGrantDecision;
  }

  return {
    allowed: true,
    reason: uiText("ui.generated.ceac61f9ed6"),
    violation: null,
  } satisfies AccessGrantDecision;
}
