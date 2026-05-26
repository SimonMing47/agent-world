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
  return defaultAgentCapabilityProfile(input.name || "agent");
}
