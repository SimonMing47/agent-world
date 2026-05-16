const defaultTerminology = {
  productName: "AgentWorld",
  tenantSpace: "租户空间",
  tenantBoundary: "租户边界",
  businessTeam: "业务团队",
  agentTeam: "Agent 团队",
  task: "任务",
  serviceDirectory: "服务目录",
  accessPolicy: "跨团队授权",
  executionPolicy: "运行约束",
  runtime: "执行运行时",
  trace: "执行追踪",
} as const;

export type TerminologyKey = keyof typeof defaultTerminology;

function readTerminologyOverrides() {
  const raw =
    process.env.NEXT_PUBLIC_AGENTWORLD_TERMINOLOGY_JSON ??
    process.env.AGENTWORLD_TERMINOLOGY_JSON;

  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([key, value]) => key in defaultTerminology && typeof value === "string",
      ),
    ) as Partial<Record<TerminologyKey, string>>;
  } catch {
    return {};
  }
}

export const terminology = {
  ...defaultTerminology,
  ...readTerminologyOverrides(),
};

export function term(key: TerminologyKey) {
  return terminology[key];
}
