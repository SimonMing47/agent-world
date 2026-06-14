import {
  type Agent,
  type AgentTeam,
  type BusinessTeam,
  type CodebaseProfile,
  type EnvironmentSnapshot,
  type ExecutionEnvironment,
  type Finding,
  type ProviderAdapterDefinition,
  type TaskBlueprint,
  type TaskEvent,
  type TaskRun,
} from "@/server/db";
import { buildNodeSpecsFromRunPlan, summarizeAgentTeamRunPlan } from "@/server/agent-orchestration-core";
import { buildEffectivePermissionPreview } from "@/server/permission-core";
import { summarizeProviderAdapter } from "@/server/provider-core";
import { summarizeFinding } from "@/server/finding-core";
import { uiText } from "@/lib/language-pack";

function parseRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function countRunPlanBlocks(value: string) {
  const runPlan = parseRecord(value);
  const blocks = Array.isArray(runPlan.blocks) ? runPlan.blocks : [];
  const workers = Array.isArray(runPlan.workers) ? runPlan.workers : [];
  return blocks.length + workers.length;
}

function parseCodebaseScope(value: string) {
  const selector = parseRecord(value);
  const rawScope = selector.codebaseScope;
  if (!rawScope || typeof rawScope !== "object" || Array.isArray(rawScope)) {
    return { mode: "all", codebaseIds: [] as string[] };
  }
  const scope = rawScope as Record<string, unknown>;
  return {
    mode: scope.mode === "selected" ? "selected" : "all",
    codebaseIds: Array.isArray(scope.codebaseIds) ? scope.codebaseIds.map(String).filter(Boolean) : [],
  };
}

function readinessCheck(args: {
  id: string;
  status: "ok" | "warning" | "blocker";
  labelKey: string;
  detailKey: string;
}) {
  return args;
}

export function buildTaskBlueprintReadiness(args: {
  blueprint: TaskBlueprint;
  teams: AgentTeam[];
  agents?: Agent[];
  environments: ExecutionEnvironment[];
  providerAdapters: ProviderAdapterDefinition[];
  codebases?: CodebaseProfile[];
  taskRuns: TaskRun[];
}) {
  const trigger = parseRecord(args.blueprint.triggerJson);
  const inputSchema = parseRecord(args.blueprint.inputSchemaJson);
  const outputPolicy = parseRecord(args.blueprint.outputPolicyJson);
  const permissionPolicy = parseRecord(args.blueprint.permissionPolicyJson);
  const codebaseScope = parseCodebaseScope(args.blueprint.environmentSelectorJson);
  const team = args.teams.find((item) => item.id === args.blueprint.teamId) ?? null;
  const environment = args.environments.find((item) => item.id === args.blueprint.environmentId) ?? null;
  const provider = args.providerAdapters.find((item) => item.id === args.blueprint.providerAdapterId) ?? null;
  const publishers = Array.isArray(outputPolicy.publishers) ? outputPolicy.publishers : [];
  const permissionRules = Array.isArray(permissionPolicy.rules) ? permissionPolicy.rules : [];
  const findingFeedback =
    outputPolicy.findingFeedback && typeof outputPolicy.findingFeedback === "object" && !Array.isArray(outputPolicy.findingFeedback)
      ? (outputPolicy.findingFeedback as Record<string, unknown>)
      : {};
  const selectedCodebases = codebaseScope.codebaseIds.filter((id) =>
    (args.codebases ?? []).some((codebase) => codebase.id === id),
  );
  const runCount = args.taskRuns.filter((taskRun) => taskRun.blueprintId === args.blueprint.id).length;
  const runPlanBlockCount = countRunPlanBlocks(args.blueprint.agentTeamRunPlanJson);
  const scopedAgents = args.agents?.filter((agent) => agent.teamId === args.blueprint.teamId);
  const executableNodeCount = scopedAgents
    ? buildNodeSpecsFromRunPlan(args.blueprint.agentTeamRunPlanJson, scopedAgents).length
    : runPlanBlockCount;
  const runPlanReady = runPlanBlockCount > 0 && executableNodeCount > 0;

  const triggerReady =
    trigger.type === "webhook"
      ? Boolean(trigger.webhookPathKey || trigger.connector || trigger.event)
      : trigger.type === "cron"
        ? typeof trigger.expression === "string" && trigger.expression.trim().length > 0
        : true;
  const schemaReady = !("type" in inputSchema) || inputSchema.type === "object";
  const codebaseReady =
    codebaseScope.mode === "selected"
      ? codebaseScope.codebaseIds.length > 0 && selectedCodebases.length === codebaseScope.codebaseIds.length
      : true;

  const checks = [
    readinessCheck({
      id: "active",
      status: args.blueprint.status === "active" ? "ok" : "blocker",
      labelKey: "ui.taskBlueprintReadiness.checks.active.label",
      detailKey:
        args.blueprint.status === "active"
          ? "ui.taskBlueprintReadiness.checks.active.ok"
          : "ui.taskBlueprintReadiness.checks.active.blocker",
    }),
    readinessCheck({
      id: "team",
      status: team ? "ok" : "blocker",
      labelKey: "ui.taskBlueprintReadiness.checks.team.label",
      detailKey: team ? "ui.taskBlueprintReadiness.checks.team.ok" : "ui.taskBlueprintReadiness.checks.team.blocker",
    }),
    readinessCheck({
      id: "provider",
      status: provider || !args.blueprint.providerAdapterId ? "ok" : "warning",
      labelKey: "ui.taskBlueprintReadiness.checks.provider.label",
      detailKey:
        provider || !args.blueprint.providerAdapterId
          ? "ui.taskBlueprintReadiness.checks.provider.ok"
          : "ui.taskBlueprintReadiness.checks.provider.warning",
    }),
    readinessCheck({
      id: "trigger",
      status: triggerReady ? "ok" : "blocker",
      labelKey: "ui.taskBlueprintReadiness.checks.trigger.label",
      detailKey: triggerReady ? "ui.taskBlueprintReadiness.checks.trigger.ok" : "ui.taskBlueprintReadiness.checks.trigger.blocker",
    }),
    readinessCheck({
      id: "input_schema",
      status: schemaReady ? "ok" : "blocker",
      labelKey: "ui.taskBlueprintReadiness.checks.inputSchema.label",
      detailKey:
        schemaReady
          ? "ui.taskBlueprintReadiness.checks.inputSchema.ok"
          : "ui.taskBlueprintReadiness.checks.inputSchema.blocker",
    }),
    readinessCheck({
      id: "run_plan",
      status: runPlanReady ? "ok" : "blocker",
      labelKey: "ui.taskBlueprintReadiness.checks.runPlan.label",
      detailKey:
        runPlanReady
          ? "ui.taskBlueprintReadiness.checks.runPlan.ok"
          : "ui.taskBlueprintReadiness.checks.runPlan.blocker",
    }),
    readinessCheck({
      id: "environment",
      status: environment || codebaseScope.mode === "selected" ? "ok" : "warning",
      labelKey: "ui.taskBlueprintReadiness.checks.environment.label",
      detailKey:
        environment || codebaseScope.mode === "selected"
          ? "ui.taskBlueprintReadiness.checks.environment.ok"
          : "ui.taskBlueprintReadiness.checks.environment.warning",
    }),
    readinessCheck({
      id: "codebase_scope",
      status: codebaseReady ? "ok" : "blocker",
      labelKey: "ui.taskBlueprintReadiness.checks.codebaseScope.label",
      detailKey:
        codebaseReady
          ? "ui.taskBlueprintReadiness.checks.codebaseScope.ok"
          : "ui.taskBlueprintReadiness.checks.codebaseScope.blocker",
    }),
    readinessCheck({
      id: "permissions",
      status: permissionRules.length > 0 ? "ok" : "warning",
      labelKey: "ui.taskBlueprintReadiness.checks.permissions.label",
      detailKey:
        permissionRules.length > 0
          ? "ui.taskBlueprintReadiness.checks.permissions.ok"
          : "ui.taskBlueprintReadiness.checks.permissions.warning",
    }),
    readinessCheck({
      id: "output",
      status: publishers.length > 0 ? "ok" : "warning",
      labelKey: "ui.taskBlueprintReadiness.checks.output.label",
      detailKey:
        publishers.length > 0
          ? "ui.taskBlueprintReadiness.checks.output.ok"
          : "ui.taskBlueprintReadiness.checks.output.warning",
    }),
    readinessCheck({
      id: "feedback",
      status: findingFeedback.enabled === true ? "ok" : "warning",
      labelKey: "ui.taskBlueprintReadiness.checks.feedback.label",
      detailKey:
        findingFeedback.enabled === true
          ? "ui.taskBlueprintReadiness.checks.feedback.ok"
          : "ui.taskBlueprintReadiness.checks.feedback.warning",
    }),
    readinessCheck({
      id: "run_history",
      status: runCount > 0 ? "ok" : "warning",
      labelKey: "ui.taskBlueprintReadiness.checks.runHistory.label",
      detailKey:
        runCount > 0
          ? "ui.taskBlueprintReadiness.checks.runHistory.ok"
          : "ui.taskBlueprintReadiness.checks.runHistory.warning",
    }),
  ];
  const blockerCount = checks.filter((check) => check.status === "blocker").length;
  const warningCount = checks.filter((check) => check.status === "warning").length;
  const okCount = checks.filter((check) => check.status === "ok").length;

  return {
    status: blockerCount > 0 ? "blocked" : warningCount > 0 ? "needs_attention" : "ready",
    score: Math.round((okCount / checks.length) * 100),
    okCount,
    warningCount,
    blockerCount,
    checks,
  };
}

export type TaskBlueprintReadinessResult = ReturnType<typeof buildTaskBlueprintReadiness>;
export type TaskBlueprintReadinessCheck = TaskBlueprintReadinessResult["checks"][number];

export class TaskBlueprintReadinessError extends Error {
  readiness: TaskBlueprintReadinessResult;
  blockerChecks: TaskBlueprintReadinessCheck[];

  constructor(readiness: TaskBlueprintReadinessResult) {
    const blockerChecks = readiness.checks.filter((check) => check.status === "blocker");
    const labels = blockerChecks.map((check) => uiText(check.labelKey)).join(", ");
    super(
      uiText("ui.taskBlueprintReadiness.errors.submitBlocked", undefined, {
        checks: labels || uiText("ui.taskBlueprintReadiness.status.blocked"),
      }),
    );
    this.name = "TaskBlueprintReadinessError";
    this.readiness = readiness;
    this.blockerChecks = blockerChecks;
  }
}

export function assertTaskBlueprintReadiness(readiness: TaskBlueprintReadinessResult) {
  if (readiness.blockerCount > 0) {
    throw new TaskBlueprintReadinessError(readiness);
  }
}

export function renderTemplateValue(template: string, values: Record<string, unknown>) {
  return template.replace(/\$\{([^}]+)\}/g, (_, key: string) => {
    const value = values[key.trim()];
    return value === undefined || value === null ? "unknown" : String(value);
  });
}

export function normalizeTriggerType(type: unknown) {
  if (type === "cron") return "schedule";
  if (type === "webhook") return "webhook";
  if (type === "manual") return "manual";
  return "manual";
}

export function buildTaskBlueprintSummary(args: {
  blueprint: TaskBlueprint;
  businessTeams: BusinessTeam[];
  teams: AgentTeam[];
  agents?: Agent[];
  environments: ExecutionEnvironment[];
  providerAdapters: ProviderAdapterDefinition[];
  codebases?: CodebaseProfile[];
  taskRuns: TaskRun[];
  findings: Finding[];
}) {
  const trigger = parseRecord(args.blueprint.triggerJson);
  const outputPolicy = parseRecord(args.blueprint.outputPolicyJson);
  const memoryPolicy = parseRecord(args.blueprint.memoryPolicyJson);
  const runCount = args.taskRuns.filter((taskRun) => taskRun.blueprintId === args.blueprint.id).length;
  const taskRunIds = new Set(
    args.taskRuns.filter((taskRun) => taskRun.blueprintId === args.blueprint.id).map((taskRun) => taskRun.id),
  );
  const scopedFindings = args.findings.filter((finding) => taskRunIds.has(finding.taskRunId));

  return {
    id: args.blueprint.id,
    name: args.blueprint.name,
    category: args.blueprint.category,
    visibility: args.blueprint.visibility,
    status: args.blueprint.status,
    version: args.blueprint.version,
    businessTeamName:
      args.businessTeams.find((team) => team.id === args.blueprint.ownerBusinessTeamId)?.name ??
      uiText("ui.generated.c7ae513bf4d"),
    agentTeamName:
      args.teams.find((team) => team.id === args.blueprint.teamId)?.name ?? uiText("ui.generated.c603903ef14"),
    environmentName:
      args.environments.find((environment) => environment.id === args.blueprint.environmentId)?.name ??
      uiText("ui.generated.c304b35fa0b"),
    providerName:
      args.providerAdapters.find((adapter) => adapter.id === args.blueprint.providerAdapterId)?.name ??
      args.blueprint.providerAdapterId,
    trigger,
    memorySpaces: parseArray(JSON.stringify(memoryPolicy.requiredSpaces ?? [])),
    publishers: Array.isArray(outputPolicy.publishers) ? outputPolicy.publishers : [],
    readiness: buildTaskBlueprintReadiness({
      blueprint: args.blueprint,
      teams: args.teams,
      agents: args.agents,
      environments: args.environments,
      providerAdapters: args.providerAdapters,
      codebases: args.codebases,
      taskRuns: args.taskRuns,
    }),
    runCount,
    findingCount: scopedFindings.length,
    criticalOrHighFindingCount: scopedFindings.filter((finding) =>
      ["critical", "high"].includes(finding.severity),
    ).length,
  };
}

export function buildTaskBlueprintDetail(args: {
  blueprint: TaskBlueprint;
  businessTeams: BusinessTeam[];
  teams: AgentTeam[];
  agents: Agent[];
  environments: ExecutionEnvironment[];
  providerAdapters: ProviderAdapterDefinition[];
  codebases?: CodebaseProfile[];
  taskRuns: TaskRun[];
  findings: Finding[];
}) {
  const team = args.teams.find((item) => item.id === args.blueprint.teamId) ?? null;
  const agents = args.agents.filter((agent) => agent.teamId === args.blueprint.teamId);
  const providerAdapter =
    args.providerAdapters.find((adapter) => adapter.id === args.blueprint.providerAdapterId) ?? null;
  const taskRunIds = new Set(
    args.taskRuns.filter((taskRun) => taskRun.blueprintId === args.blueprint.id).map((taskRun) => taskRun.id),
  );

  return {
    ...buildTaskBlueprintSummary(args),
    blueprint: args.blueprint,
    options: {
      businessTeams: args.businessTeams.map((team) => ({ id: team.id, name: team.name })),
      agentTeams: args.teams.map((team) => ({ id: team.id, name: team.name })),
      environments: args.environments.map((environment) => ({ id: environment.id, name: environment.name })),
      providerAdapters: args.providerAdapters.map((adapter) => ({
        id: adapter.id,
        name: adapter.name,
      })),
    },
    trigger: parseRecord(args.blueprint.triggerJson),
    inputSchema: parseRecord(args.blueprint.inputSchemaJson),
    environmentSelector: parseRecord(args.blueprint.environmentSelectorJson),
    runPlan: summarizeAgentTeamRunPlan(args.blueprint.agentTeamRunPlanJson, agents, team),
    memoryPolicy: parseRecord(args.blueprint.memoryPolicyJson),
    providerPolicy: parseRecord(args.blueprint.providerPolicyJson),
    permissionPreview: buildEffectivePermissionPreview(args.blueprint.permissionPolicyJson),
    resultSchema: parseRecord(args.blueprint.resultSchemaJson),
    outputPolicy: parseRecord(args.blueprint.outputPolicyJson),
    dashboardPolicy: parseRecord(args.blueprint.dashboardPolicyJson),
    executionPolicy: parseRecord(args.blueprint.executionPolicyJson),
    archivePolicy: parseRecord(args.blueprint.archivePolicyJson),
    providerAdapter: providerAdapter ? summarizeProviderAdapter(providerAdapter) : null,
    recentRuns: args.taskRuns
      .filter((taskRun) => taskRun.blueprintId === args.blueprint.id)
      .slice(0, 8),
    findings: args.findings
      .filter((finding) => taskRunIds.has(finding.taskRunId))
      .slice(0, 8)
      .map(summarizeFinding),
  };
}

export function buildTaskRunKernelView(args: {
  taskRun: TaskRun;
  blueprint: TaskBlueprint | null;
  taskEvents: TaskEvent[];
  environmentSnapshot: EnvironmentSnapshot | null;
  findings: Finding[];
  agents: Agent[];
}) {
  return {
    blueprint: args.blueprint
      ? {
          id: args.blueprint.id,
          name: args.blueprint.name,
          category: args.blueprint.category,
          version: args.blueprint.version,
          trigger: parseRecord(args.blueprint.triggerJson),
        }
      : null,
    runState: args.taskRun.runState,
    idempotencyKey: args.taskRun.idempotencyKey,
    permissionSnapshot: parseRecord(args.taskRun.permissionSnapshotJson),
    agentTeamRunPlan:
      args.blueprint && args.taskRun.agentTeamRunPlanJson !== "{}"
        ? summarizeAgentTeamRunPlan(args.taskRun.agentTeamRunPlanJson, args.agents)
        : null,
    environmentSnapshot: args.environmentSnapshot
      ? parseRecord(args.environmentSnapshot.snapshotJson)
      : null,
    events: args.taskEvents.map((event) => ({
      ...event,
      payload: parseRecord(event.payloadJson),
    })),
    findings: args.findings.map(summarizeFinding),
  };
}
