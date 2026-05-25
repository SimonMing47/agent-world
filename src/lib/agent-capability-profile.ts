export type AgentCapabilityKey =
  | "permission"
  | "toolUse"
  | "safety"
  | "coding"
  | "review"
  | "memory"
  | "collaboration";

export type AgentCapabilityScore = {
  key: AgentCapabilityKey;
  label: string;
  value: number;
};

export type AgentCapabilityProfile = {
  scores: AgentCapabilityScore[];
  rationale?: string[];
};

export const agentCapabilityDimensions: Array<{ key: AgentCapabilityKey; label: string }> = [
  { key: "permission", label: "权限" },
  { key: "toolUse", label: "工具" },
  { key: "safety", label: "安全" },
  { key: "coding", label: "编码" },
  { key: "review", label: "审核" },
  { key: "memory", label: "记忆" },
  { key: "collaboration", label: "协作" },
];

export const agentCapabilityWeapons: Record<AgentCapabilityKey, { name: string; shortName: string }> = {
  permission: { name: "权限权杖", shortName: "权杖" },
  toolUse: { name: "工具扳手", shortName: "扳手" },
  safety: { name: "安全盾牌", shortName: "盾牌" },
  coding: { name: "代码刃", shortName: "代码刃" },
  review: { name: "审核透镜", shortName: "透镜" },
  memory: { name: "记忆卷轴", shortName: "卷轴" },
  collaboration: { name: "协作旗帜", shortName: "旗帜" },
};

function clampScore(value: unknown, fallback: number) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function hashSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function includesAny(source: string, keywords: string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

function addScore(scores: Record<AgentCapabilityKey, number>, key: AgentCapabilityKey, value: number) {
  scores[key] = Math.max(0, Math.min(100, scores[key] + value));
}

export function defaultAgentCapabilityProfile(seedValue = "agent"): AgentCapabilityProfile {
  const seed = hashSeed(seedValue || "agent");
  return {
    scores: agentCapabilityDimensions.map((dimension, index) => ({
      ...dimension,
      value: 46 + ((seed >> (index % 8)) + index * 9) % 39,
    })),
  };
}

export function parseAgentCapabilityProfile(raw: string | null | undefined, seedValue?: string): AgentCapabilityProfile {
  const fallback = defaultAgentCapabilityProfile(seedValue);
  if (!raw?.trim()) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<AgentCapabilityProfile> & {
      scores?: Array<Partial<AgentCapabilityScore>>;
    };
    const parsedByKey = new Map((parsed.scores ?? []).map((score) => [score.key, score]));

    return {
      scores: fallback.scores.map((score) => {
        const parsedScore = parsedByKey.get(score.key);
        return {
          ...score,
          value: clampScore(parsedScore?.value, score.value),
        };
      }),
      rationale: Array.isArray(parsed.rationale) ? parsed.rationale.map(String).slice(0, 4) : fallback.rationale,
    };
  } catch {
    return fallback;
  }
}

export function serializeAgentCapabilityProfile(profile: AgentCapabilityProfile) {
  return JSON.stringify(
    {
      scores: agentCapabilityDimensions.map((dimension) => {
        const current = profile.scores.find((score) => score.key === dimension.key);
        return {
          ...dimension,
          value: clampScore(current?.value, 50),
        };
      }),
      rationale: profile.rationale ?? [],
    },
    null,
    2,
  );
}

export function getDominantAgentCapability(profile: AgentCapabilityProfile) {
  return profile.scores.reduce(
    (dominant, score) => (score.value > dominant.value ? score : dominant),
    profile.scores[0] ?? defaultAgentCapabilityProfile().scores[0],
  );
}

export function getAgentCapabilityWeapon(profile: AgentCapabilityProfile) {
  const dominant = getDominantAgentCapability(profile);
  return {
    capability: dominant,
    weapon: agentCapabilityWeapons[dominant.key],
  };
}

export function deriveAgentCapabilityProfile(input: {
  name?: string;
  role?: string;
  description?: string;
  systemPrompt?: string;
  toolBindings?: string[];
  harnessConfigJson?: string;
  permissionPolicyJson?: string;
  memoryScope?: string;
  tags?: string[];
  visibility?: string;
  status?: string;
}): AgentCapabilityProfile {
  const text = [
    input.name,
    input.role,
    input.description,
    input.systemPrompt,
    input.memoryScope,
    input.visibility,
    input.status,
    ...(input.tags ?? []),
    ...(input.toolBindings ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const scores: Record<AgentCapabilityKey, number> = {
    permission: 42,
    toolUse: 42,
    safety: 42,
    coding: 42,
    review: 42,
    memory: 42,
    collaboration: 42,
  };
  const rationale: string[] = [];

  if (includesAny(text, ["manager", "manage", "管理", "主管", "负责人", "leader", "lead", "调度", "orchestrat", "协调", "审批"])) {
    addScore(scores, "permission", 50);
    addScore(scores, "collaboration", 12);
    addScore(scores, "safety", 12);
    rationale.push("角色体现管理、调度或审批职责，提升权限与协作能力。");
  }
  if (includesAny(text, ["executor", "execute", "执行", "worker", "runner", "implement", "落实", "操作", "交付"])) {
    addScore(scores, "toolUse", 32);
    addScore(scores, "coding", 18);
    addScore(scores, "collaboration", 8);
    rationale.push("角色体现执行者职责，提升工具使用与交付能力。");
  }
  if (includesAny(text, ["code", "coding", "developer", "engineer", "repo", "diff", "typescript", "实现", "编码", "代码", "工程", "仓库"])) {
    addScore(scores, "coding", 32);
    addScore(scores, "toolUse", 12);
    rationale.push("提示词或工具指向代码/工程工作，提升编码能力。");
  }
  if (includesAny(text, ["architecture", "architect", "boundary", "module", "data flow", "架构", "边界", "模块", "数据流", "调度/调用"])) {
    addScore(scores, "review", 24);
    addScore(scores, "coding", 18);
    rationale.push("定义包含架构、边界或数据流职责，提升架构审查能力。");
  }
  if (includesAny(text, ["review", "audit", "inspect", "qa", "审核", "审查", "检查", "验收", "评审"])) {
    addScore(scores, "review", 34);
    addScore(scores, "safety", 14);
    rationale.push("定义包含审核、检查或验收职责，提升审核能力。");
  }
  if (includesAny(text, ["security", "safe", "risk", "guard", "policy", "合规", "安全", "风险", "权限", "策略", "治理"])) {
    addScore(scores, "safety", 34);
    addScore(scores, "permission", 12);
    rationale.push("定义包含安全、风险或治理约束，提升安全能力。");
  }
  if (includesAny(text, ["memory", "knowledge", "rag", "recall", "知识", "记忆", "检索", "沉淀", "上下文"])) {
    addScore(scores, "memory", 34);
    addScore(scores, "toolUse", 8);
    rationale.push("定义包含知识、记忆或检索职责，提升记忆能力。");
  }
  if (includesAny(text, ["team", "collaborat", "handoff", "沟通", "协作", "团队", "分工", "对齐", "交接"])) {
    addScore(scores, "collaboration", 30);
    rationale.push("定义包含团队协作或交接职责，提升协作能力。");
  }

  const toolCount = input.toolBindings?.length ?? 0;
  if (toolCount > 0) {
    addScore(scores, "toolUse", Math.min(24, toolCount * 4));
    rationale.push(`绑定 ${toolCount} 个工具，提升工具使用能力。`);
  }

  try {
    const permissionPolicy = JSON.parse(input.permissionPolicyJson || "{}") as {
      repositoryAccess?: string;
      memoryAccess?: string;
      secretAccess?: string;
      allowedToolNames?: string[];
      deniedToolNames?: string[];
    };
    if (permissionPolicy.repositoryAccess === "read_only") addScore(scores, "safety", 8);
    if (permissionPolicy.memoryAccess === "team_shared" || permissionPolicy.memoryAccess === "global") addScore(scores, "memory", 10);
    if (permissionPolicy.secretAccess === "runtime_bound_only" || permissionPolicy.secretAccess === "none") addScore(scores, "safety", 8);
    if ((permissionPolicy.allowedToolNames?.length ?? 0) > 0) addScore(scores, "toolUse", Math.min(18, (permissionPolicy.allowedToolNames?.length ?? 0) * 3));
    if ((permissionPolicy.deniedToolNames?.length ?? 0) > 0) addScore(scores, "safety", 6);
  } catch {
    // Ignore malformed policy drafts while the user is editing.
  }

  try {
    const harness = JSON.parse(input.harnessConfigJson || "{}") as {
      approvalMode?: string;
      humanIntervention?: string;
      thinkingLevel?: string;
      maxToolCalls?: number;
    };
    if (harness.approvalMode === "manual" || harness.approvalMode === "ask") {
      addScore(scores, "permission", 12);
      addScore(scores, "safety", 8);
    }
    if (harness.humanIntervention === "steer") addScore(scores, "collaboration", 10);
    if (harness.thinkingLevel === "high") {
      addScore(scores, "review", 8);
      addScore(scores, "safety", 6);
    }
    if ((harness.maxToolCalls ?? 0) >= 8) addScore(scores, "toolUse", 10);
  } catch {
    // Ignore malformed harness drafts while the user is editing.
  }

  if (input.memoryScope === "team_shared" || input.memoryScope === "global") addScore(scores, "memory", 12);

  return {
    scores: agentCapabilityDimensions.map((dimension) => ({
      ...dimension,
      value: clampScore(scores[dimension.key], 42),
    })),
    rationale: rationale.length ? rationale.slice(0, 4) : ["根据角色、提示词、工具、权限和记忆配置自动生成。"],
  };
}
