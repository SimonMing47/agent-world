import {
  type AgentTeam,
  type ExecutionEnvironment,
  type BusinessTeam,
  type TaskRun,
  type ScheduleTemplate,
} from "@/server/db";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function buildEnvironmentSummary(environment: ExecutionEnvironment, business_teams: BusinessTeam[]) {
  return {
    id: environment.id,
    name: environment.name,
    businessTeamName:
      business_teams.find((businessTeam) => businessTeam.id === environment.businessTeamId)?.name ?? "未知业务团队",
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
  task_runs: TaskRun[];
  schedules: ScheduleTemplate[];
  teams: AgentTeam[];
  business_teams: BusinessTeam[];
}) {
  const sourceTypes = ["manual", "schedule", "webhook", "access_grant"];
  const templateKinds = ["manual", "cron", "event", "webhook"];
  const scheduleCategory = (template: ScheduleTemplate) =>
    template.scheduleKind === "cron"
      ? "schedule"
      : template.scheduleKind === "event"
        ? "webhook"
        : template.scheduleKind;
  const taskCategories = Array.from(
    new Set([
      ...args.task_runs.map((taskRun) => {
        const payload = parseJson<Record<string, unknown>>(taskRun.inputPayloadJson, {});
        return typeof payload.taskCategory === "string" ? payload.taskCategory : taskRun.sourceType;
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
      taskRunCount: args.task_runs.filter((taskRun) => taskRun.sourceType === sourceType).length,
      activeCount: args.task_runs.filter(
        (taskRun) => taskRun.sourceType === sourceType && ["running", "awaiting"].includes(taskRun.status),
      ).length,
    })),
    byBusinessTeam: args.business_teams.map((businessTeam) => ({
      businessTeamId: businessTeam.id,
      businessTeamName: businessTeam.name,
      taskRunCount: args.task_runs.filter((taskRun) => taskRun.businessTeamId === businessTeam.id).length,
      activeCount: args.task_runs.filter(
        (taskRun) => taskRun.businessTeamId === businessTeam.id && ["running", "awaiting"].includes(taskRun.status),
      ).length,
      teamCount: args.teams.filter((team) => team.businessTeamId === businessTeam.id).length,
    })),
    byTaskCategory: taskCategories.map((category) => ({
      category,
      taskRunCount: args.task_runs.filter((taskRun) => {
        const payload = parseJson<Record<string, unknown>>(taskRun.inputPayloadJson, {});
        const currentCategory =
          typeof payload.taskCategory === "string" ? payload.taskCategory : taskRun.sourceType;
        return currentCategory === category;
      }).length,
      activeCount: args.task_runs.filter((taskRun) => {
        const payload = parseJson<Record<string, unknown>>(taskRun.inputPayloadJson, {});
        const currentCategory =
          typeof payload.taskCategory === "string" ? payload.taskCategory : taskRun.sourceType;
        return currentCategory === category && ["running", "awaiting"].includes(taskRun.status);
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
