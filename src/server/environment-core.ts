import {
  type AgentTeam,
  type ExecutionEnvironment,
  type Kingdom,
  type Quest,
  type ScheduleTemplate,
} from "@/server/db";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function buildEnvironmentSummary(environment: ExecutionEnvironment, kingdoms: Kingdom[]) {
  return {
    id: environment.id,
    name: environment.name,
    kingdomName:
      kingdoms.find((kingdom) => kingdom.id === environment.kingdomId)?.name ?? "未知 Kingdom",
    repository: {
      provider: environment.repositoryProvider,
      name: environment.repositoryName,
      url: environment.repositoryUrl,
      branch: environment.defaultBranch,
      workingDirectory: environment.workingDirectory,
    },
    executorRef: environment.executorRef,
    privateKeyRef: environment.privateKeyRef,
    sandbox: parseJson<Record<string, unknown>>(environment.sandboxProfileJson, {}),
    memoryLayers: parseJson<string[]>(environment.memoryLayerRefsJson, []),
    visibility: environment.visibility,
    status: environment.status,
  };
}

export function buildTaskExecutionDashboard(args: {
  quests: Quest[];
  schedules: ScheduleTemplate[];
  teams: AgentTeam[];
  kingdoms: Kingdom[];
}) {
  const sourceTypes = ["manual", "schedule", "webhook", "contract"];
  const templateKinds = ["manual", "cron", "event", "webhook"];
  const scheduleCategory = (template: ScheduleTemplate) =>
    template.scheduleKind === "cron"
      ? "schedule"
      : template.scheduleKind === "event"
        ? "webhook"
        : template.scheduleKind;
  const taskCategories = Array.from(
    new Set([
      ...args.quests.map((quest) => {
        const payload = parseJson<Record<string, unknown>>(quest.inputPayloadJson, {});
        return typeof payload.taskCategory === "string" ? payload.taskCategory : quest.sourceType;
      }),
      ...args.schedules.map((template) => {
        const payload = parseJson<Record<string, unknown>>(template.inputPayloadJson, {});
        return typeof payload.taskCategory === "string" ? payload.taskCategory : scheduleCategory(template);
      }),
    ]),
  );

  return {
    bySourceType: sourceTypes.map((sourceType) => ({
      sourceType,
      questCount: args.quests.filter((quest) => quest.sourceType === sourceType).length,
      activeCount: args.quests.filter(
        (quest) => quest.sourceType === sourceType && ["running", "awaiting"].includes(quest.status),
      ).length,
    })),
    byKingdom: args.kingdoms.map((kingdom) => ({
      kingdomId: kingdom.id,
      kingdomName: kingdom.name,
      questCount: args.quests.filter((quest) => quest.kingdomId === kingdom.id).length,
      activeCount: args.quests.filter(
        (quest) => quest.kingdomId === kingdom.id && ["running", "awaiting"].includes(quest.status),
      ).length,
      teamCount: args.teams.filter((team) => team.kingdomId === kingdom.id).length,
    })),
    byTaskCategory: taskCategories.map((category) => ({
      category,
      questCount: args.quests.filter((quest) => {
        const payload = parseJson<Record<string, unknown>>(quest.inputPayloadJson, {});
        const currentCategory =
          typeof payload.taskCategory === "string" ? payload.taskCategory : quest.sourceType;
        return currentCategory === category;
      }).length,
      activeCount: args.quests.filter((quest) => {
        const payload = parseJson<Record<string, unknown>>(quest.inputPayloadJson, {});
        const currentCategory =
          typeof payload.taskCategory === "string" ? payload.taskCategory : quest.sourceType;
        return currentCategory === category && ["running", "awaiting"].includes(quest.status);
      }).length,
    })),
    templatesByKind: templateKinds.map((kind) => ({
      kind,
      enabledCount: args.schedules.filter(
        (template) =>
          template.isEnabled &&
          (template.scheduleKind === kind ||
            (kind === "webhook" && template.scheduleKind === "event")),
      ).length,
    })),
  };
}
