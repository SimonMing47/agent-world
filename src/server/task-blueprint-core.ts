import {
  type Agent,
  type AgentTeam,
  type BusinessTeam,
  type EnvironmentSnapshot,
  type ExecutionEnvironment,
  type Finding,
  type ProviderAdapterDefinition,
  type TaskBlueprint,
  type TaskEvent,
  type TaskRun,
} from "@/server/db";
import { summarizeAgentTeamRunPlan } from "@/server/agent-orchestration-core";
import { buildEffectivePermissionPreview } from "@/server/permission-core";
import { summarizeProviderAdapter } from "@/server/provider-core";
import { summarizeFinding } from "@/server/finding-core";

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
  environments: ExecutionEnvironment[];
  providerAdapters: ProviderAdapterDefinition[];
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
      "未知业务团队",
    agentTeamName:
      args.teams.find((team) => team.id === args.blueprint.teamId)?.name ?? "未知 Agent 团队",
    environmentName:
      args.environments.find((environment) => environment.id === args.blueprint.environmentId)?.name ??
      "未绑定环境",
    providerName:
      args.providerAdapters.find((adapter) => adapter.id === args.blueprint.providerAdapterId)?.name ??
      args.blueprint.providerAdapterId,
    trigger,
    memorySpaces: parseArray(JSON.stringify(memoryPolicy.requiredSpaces ?? [])),
    publishers: Array.isArray(outputPolicy.publishers) ? outputPolicy.publishers : [],
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
