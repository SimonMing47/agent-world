export type PermissionEffect = "allow" | "ask" | "deny";

export type PermissionRule = {
  effect: PermissionEffect;
  resource: string;
  scope: string;
  reason?: string;
};

export type PermissionPolicy = {
  defaultMode: PermissionEffect;
  rules: PermissionRule[];
};

const precedence: Record<PermissionEffect, number> = {
  deny: 3,
  ask: 2,
  allow: 1,
};

function parsePolicy(value: string): PermissionPolicy {
  try {
    const parsed = JSON.parse(value) as {
      defaultMode?: PermissionEffect;
      rules?: PermissionRule[];
    };
    return {
      defaultMode: parsed.defaultMode ?? "ask",
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    };
  } catch {
    return { defaultMode: "ask", rules: [] };
  }
}

function matches(rule: PermissionRule, resource: string, scope?: string) {
  const resourceMatches =
    rule.resource === resource ||
    rule.resource === "*" ||
    (rule.resource.endsWith(".*") && resource.startsWith(rule.resource.slice(0, -1)));
  const scopeMatches = !scope || rule.scope === scope || rule.scope === "*";
  return resourceMatches && scopeMatches;
}

export function evaluatePermissionPolicy(
  policyValue: string,
  resource: string,
  scope?: string,
) {
  const policy = parsePolicy(policyValue);
  const candidates = policy.rules.filter((rule) => matches(rule, resource, scope));
  const selected =
    candidates.sort((left, right) => precedence[right.effect] - precedence[left.effect])[0] ??
    ({
      effect: policy.defaultMode,
      resource,
      scope: scope ?? "*",
      reason: "未命中显式规则，使用默认模式。",
    } satisfies PermissionRule);

  return {
    effect: selected.effect,
    allowed: selected.effect !== "deny",
    requiresApproval: selected.effect === "ask",
    rule: selected,
  };
}

export function buildEffectivePermissionPreview(policyValue: string) {
  const policy = parsePolicy(policyValue);
  const sortedRules = [...policy.rules].sort(
    (left, right) =>
      precedence[right.effect] - precedence[left.effect] ||
      left.resource.localeCompare(right.resource),
  );

  return {
    defaultMode: policy.defaultMode,
    precedence: ["deny", "ask", "allow"] as const,
    rules: sortedRules,
    counts: {
      allow: sortedRules.filter((rule) => rule.effect === "allow").length,
      ask: sortedRules.filter((rule) => rule.effect === "ask").length,
      deny: sortedRules.filter((rule) => rule.effect === "deny").length,
    },
    riskNotes: [
      "deny 优先于 ask，ask 优先于 allow。",
      "Secret 明文读取不通过 Prompt 控制，必须由权限系统硬阻断。",
      "输出通道按作用域授权，外部收件人和跨仓库写入默认进入 ask 或 deny。",
    ],
  };
}
