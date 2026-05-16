import { addMinutes } from "date-fns";
import { randomUUID } from "node:crypto";
import {
  execute,
  queryAll,
  queryOne,
  type Agent,
  type AgentTeam,
  type AccessGrant,
  type DeveloperProfile,
  type EventLog,
  type ExecutionEnvironment,
  type ExecutionPolicy,
  type BusinessTeam,
  type ProviderProfile,
  type TaskRun,
  type TaskRunIntervention,
  type TaskRunNode,
  type TaskRunPlan,
  type RepositoryProfile,
  type RuntimeEndpoint,
  type ScheduleTemplate,
  type TaskTemplate,
  type ServiceCatalogListing,
  type WebhookEndpoint,
  type TenantSpace,
} from "@/server/db";
import { buildAccessGrantSummary, evaluateAccessGrantAccess } from "@/server/access-grant-core";
import { buildExecutionBoard, summarizeNodeState } from "@/server/executor-core";
import {
  buildExecutionPolicySummary,
  composeExecutionPolicy,
  evaluateExecutionPolicyToolPolicy,
} from "@/server/execution-policy-core";
import { buildInvocationPlan } from "@/server/invocation-core";
import { discoverConfiguredRuntimes } from "@/server/opencode-adapter";
import { buildTaskRunPriorityAssessment, listDueSchedules, listScheduleAssessments } from "@/server/scheduler-core";
import { groupEventsByFoldGroup } from "@/server/trace-core";
import { buildTenantSpaceSummary, buildBusinessTeamSummary } from "@/server/tenant-space-core";
import { buildAgentTeamSummary, buildServiceCatalogEntry } from "@/server/registry-core";
import { buildProviderSelection } from "@/server/provider-core";
import { summarizeTaskRunPlan, buildTeamPlanningMode } from "@/server/planner-core";
import { buildRuntimeSummary } from "@/server/runtime-core";
import {
  buildEnvironmentSummary,
  buildTaskExecutionDashboard,
} from "@/server/environment-core";

export function listTenantSpaces() {
  return queryAll<TenantSpace>("SELECT * FROM tenant_spaces ORDER BY name ASC");
}

export function listBusinessTeams() {
  return queryAll<BusinessTeam>("SELECT * FROM business_teams ORDER BY name ASC");
}

export function listExecutionPolicies() {
  return queryAll<ExecutionPolicy>("SELECT * FROM execution_policies ORDER BY name ASC");
}

export function listAgentTeams() {
  return queryAll<AgentTeam>("SELECT * FROM agent_teams ORDER BY name ASC");
}

export function listAgents() {
  return queryAll<Agent>("SELECT * FROM agents ORDER BY name ASC");
}

export function updateAgentDefinition(
  agentId: string,
  input: Partial<{
    name: string;
    role: string;
    personaPrompt: string;
    model: string;
    toolBindings: string[];
    memoryScope: string;
    status: string;
  }>,
) {
  const current = queryOne<Agent>("SELECT * FROM agents WHERE id = ?", agentId);
  if (!current) throw new Error("Agent 不存在。");

  execute(
    "UPDATE agents SET name = ?, role = ?, persona_prompt = ?, model = ?, tool_bindings_json = ?, memory_scope = ?, status = ? WHERE id = ?",
    input.name ?? current.name,
    input.role ?? current.role,
    input.personaPrompt ?? current.personaPrompt,
    input.model ?? current.model,
    JSON.stringify(input.toolBindings ?? (JSON.parse(current.toolBindingsJson) as string[])),
    input.memoryScope ?? current.memoryScope,
    input.status ?? current.status,
    agentId,
  );

  return queryOne<Agent>("SELECT * FROM agents WHERE id = ?", agentId);
}

export function listProviders() {
  return queryAll<ProviderProfile>("SELECT * FROM provider_profiles ORDER BY name ASC");
}

export function listRuntimeEndpoints() {
  return queryAll<RuntimeEndpoint>("SELECT * FROM runtime_endpoints ORDER BY name ASC");
}

export function listAccessGrants() {
  return queryAll<AccessGrant>("SELECT * FROM access_grants ORDER BY created_at DESC");
}

export function listServiceCatalogListings() {
  return queryAll<ServiceCatalogListing>("SELECT * FROM service_catalog_listings ORDER BY created_at DESC");
}

export function listScheduleTemplates() {
  return queryAll<ScheduleTemplate>("SELECT * FROM schedule_templates ORDER BY created_at DESC");
}

export function listTaskTemplates() {
  return queryAll<TaskTemplate>("SELECT * FROM task_templates ORDER BY created_at DESC");
}

export function listTaskRuns() {
  return queryAll<TaskRun>("SELECT * FROM task_runs ORDER BY created_at DESC");
}

export function listRepositories() {
  return queryAll<RepositoryProfile>("SELECT * FROM repository_profiles ORDER BY activity_score DESC, name ASC");
}

export function listDevelopers() {
  return queryAll<DeveloperProfile>("SELECT * FROM developer_profiles ORDER BY last_active_at DESC");
}

export function listExecutionEnvironments() {
  return queryAll<ExecutionEnvironment>(
    "SELECT * FROM execution_environments ORDER BY status ASC, name ASC",
  );
}

export function upsertExecutionEnvironment(
  input: Pick<
    ExecutionEnvironment,
    | "id"
    | "businessTeamId"
    | "name"
    | "repositoryProvider"
    | "repositoryName"
    | "repositoryUrl"
    | "defaultBranch"
    | "executorRef"
    | "privateKeyRef"
    | "workingDirectory"
    | "visibility"
    | "status"
  > & {
    sandboxProfile?: Record<string, unknown>;
    memoryLayerRefs?: string[];
  },
) {
  execute(
    "INSERT OR REPLACE INTO execution_environments (id, business_team_id, name, repository_provider, repository_name, repository_url, default_branch, executor_ref, private_key_ref, working_directory, sandbox_profile_json, memory_layer_refs_json, visibility, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    input.id,
    input.businessTeamId,
    input.name,
    input.repositoryProvider,
    input.repositoryName,
    input.repositoryUrl,
    input.defaultBranch,
    input.executorRef,
    input.privateKeyRef,
    input.workingDirectory,
    JSON.stringify(input.sandboxProfile ?? {}),
    JSON.stringify(input.memoryLayerRefs ?? []),
    input.visibility,
    input.status,
    new Date().toISOString(),
  );

  return queryOne<ExecutionEnvironment>("SELECT * FROM execution_environments WHERE id = ?", input.id);
}

export function listWebhooks() {
  return queryAll<WebhookEndpoint>("SELECT * FROM webhook_endpoints ORDER BY name ASC");
}

export function getTaskRunDetail(taskRunId: string) {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", taskRunId);

  if (!taskRun) return null;

  const tenantSpace = queryOne<TenantSpace>("SELECT * FROM tenant_spaces WHERE id = ?", taskRun.tenantSpaceId);
  const businessTeam = queryOne<BusinessTeam>("SELECT * FROM business_teams WHERE id = ?", taskRun.businessTeamId);
  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", taskRun.teamId);
  const accessGrant = taskRun.accessGrantId
    ? queryOne<AccessGrant>("SELECT * FROM access_grants WHERE id = ?", taskRun.accessGrantId)
    : null;
  const plan = queryOne<TaskRunPlan>("SELECT * FROM task_run_plans WHERE task_run_id = ?", taskRun.id);
  const nodes = queryAll<TaskRunNode>("SELECT * FROM task_run_nodes WHERE task_run_id = ? ORDER BY node_key ASC", taskRun.id);
  const interventions = queryAll<TaskRunIntervention>(
    "SELECT * FROM task_run_interventions WHERE task_run_id = ? ORDER BY requested_at DESC",
    taskRun.id,
  );
  const events = queryAll<EventLog>(
    "SELECT * FROM event_logs WHERE task_run_id = ? ORDER BY seq ASC",
    taskRun.id,
  );
  const agents = listAgents();
  const providers = listProviders();
  const runtimes = listRuntimeEndpoints();
  const executionPolicies = listExecutionPolicies();

  const teamExecutionPolicy = team?.defaultExecutionPolicyId
    ? executionPolicies.find((item) => item.id === team.defaultExecutionPolicyId) ?? null
    : null;
  const leader = team?.leaderAgentId
    ? agents.find((agent) => agent.id === team.leaderAgentId) ?? null
    : null;
  const featuredAgent =
    leader ?? agents.find((agent) => agent.teamId === team?.id) ?? null;
  const runtime =
    runtimes.find((item) => item.businessTeamId === taskRun.businessTeamId) ??
    runtimes.find((item) => item.tenantSpaceId === taskRun.tenantSpaceId) ??
    null;
  const providerSelection =
    tenantSpace && businessTeam && featuredAgent
      ? buildProviderSelection({
          tenantSpace,
          businessTeam,
          agent: featuredAgent,
          providers,
        })
      : { provider: null, rationale: ["当前无法给出 Provider 选择结果。"] };

  return {
    taskRun,
    tenantSpace,
    businessTeam,
    team,
    accessGrant: accessGrant ? buildAccessGrantSummary(accessGrant) : null,
    plan: plan && team
      ? summarizeTaskRunPlan(
          plan,
          nodes,
          agents.filter((agent) => agent.teamId === team.id),
        )
      : null,
    nodes: nodes.map((node) => ({
      ...summarizeNodeState(node),
      agentName: agents.find((agent) => agent.id === node.agentId)?.name ?? "未知 Agent",
    })),
    executionBoard: buildExecutionBoard(nodes),
    interventions,
    groupedEvents: groupEventsByFoldGroup(events),
    executionInsights: getTaskRunExecutionBoard(taskRun.id),
    dependencyGraph: getTaskRunDependencyGraph(taskRun.id),
    costBreakdown: getTaskRunCostBreakdown(taskRun.id),
    policyHits: getTaskRunPolicyHits(taskRun.id),
    executionPolicy: teamExecutionPolicy ? buildExecutionPolicySummary(teamExecutionPolicy) : null,
    invocationStages:
      tenantSpace && businessTeam && team && featuredAgent && teamExecutionPolicy
        ? buildInvocationPlan({
            tenantSpace,
            businessTeam,
            team,
            agent: featuredAgent,
            executionPolicy: teamExecutionPolicy,
            runtime,
            provider: providerSelection.provider,
            accessGrant,
          })
        : [],
    providerRationale: providerSelection.rationale,
  };
}

export function getDashboardSnapshot() {
  const tenant_spaces = listTenantSpaces();
  const business_teams = listBusinessTeams();
  const teams = listAgentTeams();
  const agents = listAgents();
  const task_runs = listTaskRuns();
  const schedules = listScheduleTemplates();
  const listings = listServiceCatalogListings();
  const access_grants = listAccessGrants();
  const providers = listProviders();
  const runtimes = listRuntimeEndpoints();
  const repositories = listRepositories();
  const developers = listDevelopers();
  const environments = listExecutionEnvironments();
  const executionPolicies = listExecutionPolicies();

  const runningTaskRuns = task_runs.filter((taskRun) => taskRun.status === "running");
  const awaitingTaskRuns = task_runs.filter((taskRun) => taskRun.status === "awaiting");
  const completedTaskRuns = task_runs.filter((taskRun) => taskRun.status === "completed");

  const tenantSpaceSummaries = tenant_spaces.map((tenantSpace) => buildTenantSpaceSummary(tenantSpace, business_teams));
  const businessTeamSummaries = business_teams.map((businessTeam) => buildBusinessTeamSummary(businessTeam));
  const teamSummaries = teams.map((team) => buildAgentTeamSummary(team, agents));
  const serviceCatalogResumes = listings.map((listing) => {
    const team = teams.find((item) => item.id === listing.teamId);
    return {
      ...buildServiceCatalogEntry(listing),
      teamName: team?.name ?? "未知 Agent 团队",
    };
  });

  const scheduleAssessments = listScheduleAssessments(schedules);
  const dueSchedules = listDueSchedules(schedules);
  const taskRunPriorityBoard = task_runs
    .map((taskRun) => buildTaskRunPriorityAssessment(taskRun))
    .sort((left, right) => right.effectivePriority - left.effectivePriority);

  const featuredTaskRun = runningTaskRuns[0] ?? awaitingTaskRuns[0] ?? task_runs[0] ?? null;
  const featuredTeam = featuredTaskRun
    ? teams.find((team) => team.id === featuredTaskRun.teamId) ?? null
    : null;
  const featuredTenantSpace = featuredTaskRun
    ? tenant_spaces.find((tenantSpace) => tenantSpace.id === featuredTaskRun.tenantSpaceId) ?? null
    : null;
  const featuredBusinessTeam = featuredTaskRun
    ? business_teams.find((businessTeam) => businessTeam.id === featuredTaskRun.businessTeamId) ?? null
    : null;
  const featuredExecutionPolicy = featuredTeam?.defaultExecutionPolicyId
    ? executionPolicies.find((executionPolicy) => executionPolicy.id === featuredTeam.defaultExecutionPolicyId) ?? null
    : null;
  const featuredAgent =
    (featuredTeam?.leaderAgentId
      ? agents.find((agent) => agent.id === featuredTeam.leaderAgentId)
      : null) ??
    agents.find((agent) => agent.teamId === featuredTeam?.id) ??
    null;
  const providerSelection =
    featuredTenantSpace && featuredBusinessTeam && featuredAgent
      ? buildProviderSelection({
          tenantSpace: featuredTenantSpace,
          businessTeam: featuredBusinessTeam,
          agent: featuredAgent,
          providers,
        })
      : { provider: null, rationale: ["当前没有可展示的 Provider 选择结果。"] };
  const featuredRuntime =
    featuredTaskRun
      ? runtimes.find((runtime) => runtime.businessTeamId === featuredTaskRun.businessTeamId) ?? null
      : null;

  return {
    metrics: [
      {
        label: "运行中的任务",
        value: String(runningTaskRuns.length),
        detail: "这些任务正由进程内执行槽位接手运行。",
      },
      {
        label: "等待人工处理",
        value: String(awaitingTaskRuns.length),
        detail: "这些任务命中了运行约束人工门禁，正在等待介入。",
      },
      {
        label: "公开 Agent 团队",
        value: String(teams.filter((team) => team.visibility === "public").length),
        detail: "这些 Agent 团队可以在服务目录上架，并被其他业务团队招募。",
      },
      {
        label: "生效中的跨团队授权",
        value: String(access_grants.filter((accessGrant) => accessGrant.status === "active").length),
        detail: "跨业务团队的服务访问只能通过这些授权合法发生。",
      },
    ],
    tenantSpaceSummaries,
    businessTeamSummaries,
    teamSummaries,
    task_runs,
    serviceCatalogResumes,
    access_grants: access_grants.map((accessGrant) => ({
      ...buildAccessGrantSummary(accessGrant),
      providerTeamName: teams.find((team) => team.id === accessGrant.providerTeamId)?.name ?? "未知 Agent 团队",
      consumerBusinessTeamName:
        business_teams.find((businessTeam) => businessTeam.id === accessGrant.consumerBusinessTeamId)?.name ?? "未知业务团队",
    })),
    runtimes: runtimes.map((runtime) => buildRuntimeSummary(runtime)),
    repositories,
    developers,
    executionEnvironments: environments.map((environment) =>
      buildEnvironmentSummary(environment, business_teams),
    ),
    taskExecutionDashboard: buildTaskExecutionDashboard({
      task_runs,
      schedules,
      teams,
      business_teams,
    }),
    scheduleAssessments,
    dueScheduleCount: dueSchedules.length,
    taskRunPriorityBoard,
    featuredInvocation:
      featuredTenantSpace && featuredBusinessTeam && featuredTeam && featuredAgent && featuredExecutionPolicy
        ? buildInvocationPlan({
            tenantSpace: featuredTenantSpace,
            businessTeam: featuredBusinessTeam,
            team: featuredTeam,
            agent: featuredAgent,
            executionPolicy: featuredExecutionPolicy,
            runtime: featuredRuntime,
            provider: providerSelection.provider,
            accessGrant:
              featuredTaskRun?.accessGrantId
                ? access_grants.find((accessGrant) => accessGrant.id === featuredTaskRun.accessGrantId) ?? null
                : null,
          })
        : [],
    featuredProviderRationale: providerSelection.rationale,
    featuredPlanningMode: featuredTeam ? buildTeamPlanningMode(featuredTeam) : null,
    upcomingWindow: addMinutes(new Date(), 60).toISOString(),
    completedTaskRunCount: completedTaskRuns.length,
  };
}

export function getWallboardSnapshot() {
  const task_runs = listTaskRuns();
  const teams = listAgentTeams();
  const agents = listAgents();
  const repositories = listRepositories();
  const developers = listDevelopers();
  const business_teams = listBusinessTeams();
  const runtimes = listRuntimeEndpoints();
  const schedules = listScheduleTemplates();

  return {
    activeTaskRuns: task_runs.filter((taskRun) => ["running", "awaiting"].includes(taskRun.status)),
    topTeams: teams.slice(0, 3).map((team) => buildAgentTeamSummary(team, agents)),
    topRepositories: repositories.slice(0, 3),
    topDevelopers: developers.slice(0, 3),
    business_teams: business_teams.map((businessTeam) => buildBusinessTeamSummary(businessTeam)),
    runtimes: runtimes.map((runtime) => buildRuntimeSummary(runtime)),
    taskExecutionDashboard: buildTaskExecutionDashboard({
      task_runs,
      schedules,
      teams,
      business_teams,
    }),
  };
}

type TaskRunNodeSpec = {
  nodeKey: string;
  agentId: string;
  dependsOn?: string[];
  input?: Record<string, unknown>;
};

type SubmitTaskRunInput = {
  teamId: string;
  sourceType: TaskRun["sourceType"];
  sourceRef?: string | null;
  requestedBy: string;
  priority?: number;
  accessGrantId?: string | null;
  environmentId?: string | null;
  plannerMode?: string;
  summary?: string;
  inputPayload: Record<string, unknown>;
  nodes?: TaskRunNodeSpec[];
};

function nowIso() {
  return new Date().toISOString();
}

function getTaskRunNodes(taskRunId: string) {
  return queryAll<TaskRunNode>("SELECT * FROM task_run_nodes WHERE task_run_id = ? ORDER BY node_key ASC", taskRunId);
}

function getNextEventSeq(taskRunId: string) {
  const row = queryOne<{ maxSeq: number | null }>(
    "SELECT MAX(seq) as maxSeq FROM event_logs WHERE task_run_id = ?",
    taskRunId,
  );
  return (row?.maxSeq ?? 0) + 1;
}

function appendTaskRunEvent(args: {
  traceId: string;
  taskRunId: string;
  nodeId?: string | null;
  phase: string;
  foldGroup: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}) {
  execute(
    "INSERT INTO event_logs (id, trace_id, task_run_id, node_id, seq, phase, fold_group, title, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    randomUUID(),
    args.traceId,
    args.taskRunId,
    args.nodeId ?? null,
    getNextEventSeq(args.taskRunId),
    args.phase,
    args.foldGroup,
    args.title,
    args.content,
    JSON.stringify(args.metadata ?? {}),
    nowIso(),
  );
}

function synthesizeTeamNodes(team: AgentTeam) {
  const teamAgents = listAgents().filter((agent) => agent.teamId === team.id);
  const leader = team.leaderAgentId
    ? teamAgents.find((agent) => agent.id === team.leaderAgentId) ?? null
    : null;
  const specialist =
    teamAgents.find((agent) => agent.role.toLowerCase() === "specialist") ??
    teamAgents[0] ??
    null;
  const executor =
    teamAgents.find((agent) => agent.role.toLowerCase() === "executor") ??
    specialist;
  const reviewer =
    teamAgents.find((agent) => agent.role.toLowerCase() === "reviewer") ??
    teamAgents[teamAgents.length - 1] ??
    null;

  if (!leader && !specialist && !reviewer) return [];

  if (team.workflowType === "single") {
    const singleAgent = leader ?? specialist ?? reviewer;
    if (!singleAgent) return [];
    return [
      {
        nodeKey: "single",
        agentId: singleAgent.id,
        dependsOn: [],
        input: { action: "analyze", tool: "memory.read" },
      },
    ] satisfies TaskRunNodeSpec[];
  }

  const defaultLeader = leader ?? specialist ?? reviewer;
  const defaultSpecialist = executor ?? specialist ?? leader ?? reviewer;
  const defaultReviewer = reviewer ?? leader ?? specialist;
  if (!defaultLeader || !defaultSpecialist || !defaultReviewer) return [];

  return [
    {
      nodeKey: "plan",
      agentId: defaultLeader.id,
      dependsOn: [],
      input: { action: "plan", tool: "memory.read" },
    },
    {
      nodeKey: "execute",
      agentId: defaultSpecialist.id,
      dependsOn: ["plan"],
      input: { action: "execute", tool: "repo.read" },
    },
    {
      nodeKey: "review",
      agentId: defaultReviewer.id,
      dependsOn: ["execute"],
      input: { action: "review", tool: "repo.write" },
    },
  ] satisfies TaskRunNodeSpec[];
}

function loadComposedExecutionPolicyForTaskRun(taskRun: TaskRun) {
  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", taskRun.teamId);
  const profiles = listExecutionPolicies();
  if (!team) return null;

  return composeExecutionPolicy({
    profiles,
    tenantSpaceId: taskRun.tenantSpaceId,
    businessTeamId: taskRun.businessTeamId,
    teamId: team.id,
  });
}

function resolveTaskRunStatusFromNodes(nodes: TaskRunNode[]) {
  if (nodes.every((node) => node.status === "completed")) return "completed";
  if (nodes.some((node) => node.status === "awaiting")) return "awaiting";
  if (nodes.some((node) => node.status === "failed")) return "failed";
  if (nodes.some((node) => node.status === "running")) return "running";
  return "running";
}

function classifyFailure(args: {
  reason: string;
  policyViolation?: boolean;
  accessGrantViolation?: boolean;
  timeout?: boolean;
}) {
  if (args.policyViolation) return "policy_violation";
  if (args.accessGrantViolation) return "access_grant_violation";
  if (args.timeout) return "timeout";
  if (args.reason.toLowerCase().includes("budget")) return "budget_exceeded";
  return "runtime_error";
}

const COST_PER_COMPLETED_NODE_USD = 0.5;
const BASE_ESTIMATED_NODE_COST_USD = 0.25;
const BASE_ACTUAL_NODE_COST_USD = 0.3;
const PER_ATTEMPT_NODE_COST_USD = 0.2;

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function submitTaskRun(input: SubmitTaskRunInput) {
  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", input.teamId);
  if (!team) {
    throw new Error("代理团队不存在。");
  }

  const businessTeam = queryOne<BusinessTeam>("SELECT * FROM business_teams WHERE id = ?", team.businessTeamId);
  if (!businessTeam) {
    throw new Error("业务团队不存在。");
  }

  const tenantSpace = queryOne<TenantSpace>("SELECT * FROM tenant_spaces WHERE id = ?", businessTeam.tenantSpaceId);
  if (!tenantSpace) {
    throw new Error("租户空间不存在。");
  }

  const taskRunId = randomUUID();
  const traceId = randomUUID();
  const planId = randomUUID();
  const createdAt = nowIso();
  const nodeSpecs = input.nodes?.length ? input.nodes : synthesizeTeamNodes(team);
  const inputPayload = {
    ...input.inputPayload,
    environmentId:
      input.environmentId ??
      (typeof input.inputPayload.environmentId === "string"
        ? input.inputPayload.environmentId
        : null),
  };
  const dagNodes = nodeSpecs.map((node) => ({ id: node.nodeKey, agent: node.agentId }));
  const dagEdges = nodeSpecs.flatMap((node) =>
    (node.dependsOn ?? []).map((dependency) => [dependency, node.nodeKey]),
  );

  execute(
    "INSERT INTO task_runs (id, tenant_space_id, business_team_id, team_id, access_grant_id, source_type, source_ref, status, priority, input_payload_json, output_payload_json, cost_estimate, cost_actual, trace_id, requested_by, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    taskRunId,
    tenantSpace.id,
    businessTeam.id,
    team.id,
    input.accessGrantId ?? null,
    input.sourceType,
    input.sourceRef ?? null,
    "running",
    input.priority ?? 50,
    JSON.stringify(inputPayload),
    null,
    0,
    0,
    traceId,
    input.requestedBy,
    createdAt,
    null,
  );

  execute(
    "INSERT INTO task_run_plans (id, task_run_id, planner_mode, dag_json, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    planId,
    taskRunId,
    input.plannerMode ?? (team.workflowType === "dag" ? "leader_agent" : "rule"),
    JSON.stringify({ nodes: dagNodes, edges: dagEdges }),
    input.summary ?? "任务已提交并生成执行图。",
    createdAt,
  );

  for (const node of nodeSpecs) {
    execute(
      "INSERT INTO task_run_nodes (id, task_run_id, plan_id, node_key, agent_id, depends_on_json, input_json, output_json, status, attempt_count, max_attempts, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      randomUUID(),
      taskRunId,
      planId,
      node.nodeKey,
      node.agentId,
      JSON.stringify(node.dependsOn ?? []),
      JSON.stringify(node.input ?? {}),
      null,
      "submitted",
      0,
      3,
      null,
      null,
    );
  }

  appendTaskRunEvent({
    traceId,
    taskRunId,
    phase: "planning",
    foldGroup: "Planning",
    title: "任务已提交",
    content: `任务已进入 ${team.name} 的执行队列。`,
    metadata: {
      workflowType: team.workflowType,
      plannerMode: input.plannerMode ?? "rule",
      nodeCount: nodeSpecs.length,
    },
  });

  return getTaskRunDetail(taskRunId);
}

export function executeTaskRunTick(taskRunId: string, requestedBy = "system") {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", taskRunId);
  if (!taskRun) throw new Error("任务不存在。");

  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", taskRun.teamId);
  const nodes = getTaskRunNodes(taskRunId);
  if (!team || nodes.length === 0) return getTaskRunDetail(taskRunId);

  const composedExecutionPolicy = loadComposedExecutionPolicyForTaskRun(taskRun);
  const accessGrant = taskRun.accessGrantId
    ? queryOne<AccessGrant>("SELECT * FROM access_grants WHERE id = ?", taskRun.accessGrantId)
    : null;

  for (const node of nodes) {
    if (node.status !== "submitted") continue;
    const dependencies = JSON.parse(node.dependsOnJson) as string[];
    const dependencyNodes = nodes.filter((candidate) => dependencies.includes(candidate.nodeKey));
    const ready = dependencyNodes.length === dependencies.length && dependencyNodes.every((candidate) => candidate.status === "completed");
    if (ready) {
      execute("UPDATE task_run_nodes SET status = ? WHERE id = ?", "ready", node.id);
      appendTaskRunEvent({
        traceId: taskRun.traceId,
        taskRunId: taskRun.id,
        nodeId: node.id,
        phase: "planning",
        foldGroup: "Planning",
        title: "Node unlocked",
        content: `节点 ${node.nodeKey} 依赖满足，进入可执行状态。`,
      });
    }
  }

  const refreshedNodes = getTaskRunNodes(taskRunId);
  const runnable = refreshedNodes.find((node) => node.status === "ready");
  if (!runnable) {
    execute("UPDATE task_runs SET status = ? WHERE id = ?", resolveTaskRunStatusFromNodes(refreshedNodes), taskRun.id);
    return getTaskRunDetail(taskRunId);
  }

  execute(
    "UPDATE task_run_nodes SET status = ?, started_at = ?, attempt_count = attempt_count + 1 WHERE id = ?",
    "running",
    nowIso(),
    runnable.id,
  );

  appendTaskRunEvent({
    traceId: taskRun.traceId,
    taskRunId: taskRun.id,
    nodeId: runnable.id,
    phase: "thinking",
    foldGroup: "Analysis",
    title: "Node started",
    content: `节点 ${runnable.nodeKey} 开始执行，发起人：${requestedBy}。`,
  });

  const nodeInput = JSON.parse(runnable.inputJson) as { action?: string; tool?: string };
  const simulatedDurationMs = Number(
    (nodeInput as { simulatedDurationMs?: unknown }).simulatedDurationMs ?? 0,
  );
  const timeoutReached = simulatedDurationMs > team.timeoutMs;
  const action = nodeInput.action ?? "execute";
  const tool = nodeInput.tool ?? "memory.read";

  const accessGrantDecision = evaluateAccessGrantAccess({
    accessGrant,
    isCrossBusinessTeamCall: Boolean(accessGrant),
    action,
    tool,
  });
  if (!accessGrantDecision.allowed) {
    const failureClass = classifyFailure({
      reason: accessGrantDecision.reason,
      accessGrantViolation: true,
    });
    execute(
      "UPDATE task_run_nodes SET status = ?, output_json = ?, completed_at = ? WHERE id = ?",
      "failed",
      JSON.stringify({ failureClass, reason: accessGrantDecision.reason }),
      nowIso(),
      runnable.id,
    );
    execute("UPDATE task_runs SET status = ? WHERE id = ?", "failed", taskRun.id);
    appendTaskRunEvent({
      traceId: taskRun.traceId,
      taskRunId: taskRun.id,
      nodeId: runnable.id,
      phase: "access_grant_violation",
      foldGroup: "Human Actions",
      title: "跨团队授权阻断",
      content: accessGrantDecision.reason,
      metadata: { failureClass, violation: accessGrantDecision.violation },
    });
    return getTaskRunDetail(taskRunId);
  }

  const executionPolicyDecision = composedExecutionPolicy
    ? evaluateExecutionPolicyToolPolicy(composedExecutionPolicy.resolved, tool)
    : {
        allowed: true,
        requiresApproval: false,
        reason: "未配置运行约束，默认放行。",
        policyHit: "allow" as const,
      };

  if (!executionPolicyDecision.allowed) {
    const failureClass = classifyFailure({
      reason: executionPolicyDecision.reason,
      policyViolation: true,
    });
    execute(
      "UPDATE task_run_nodes SET status = ?, output_json = ?, completed_at = ? WHERE id = ?",
      "failed",
      JSON.stringify({ failureClass, reason: executionPolicyDecision.reason }),
      nowIso(),
      runnable.id,
    );
    execute("UPDATE task_runs SET status = ? WHERE id = ?", "failed", taskRun.id);
    appendTaskRunEvent({
      traceId: taskRun.traceId,
      taskRunId: taskRun.id,
      nodeId: runnable.id,
      phase: "policy_violation",
      foldGroup: "Human Actions",
      title: "运行约束阻断",
      content: executionPolicyDecision.reason,
      metadata: { failureClass, policyHit: executionPolicyDecision.policyHit },
    });
    return getTaskRunDetail(taskRunId);
  }

  if (executionPolicyDecision.requiresApproval) {
    execute("UPDATE task_run_nodes SET status = ? WHERE id = ?", "awaiting", runnable.id);
    execute("UPDATE task_runs SET status = ? WHERE id = ?", "awaiting", taskRun.id);
    execute(
      "INSERT INTO task_run_interventions (id, task_run_id, node_id, kind, status, requested_action, resolution_note, requested_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      randomUUID(),
      taskRun.id,
      runnable.id,
      "approval",
      "pending",
      `Approve tool ${tool} for node ${runnable.nodeKey}`,
      null,
      nowIso(),
      null,
    );
    appendTaskRunEvent({
      traceId: taskRun.traceId,
      taskRunId: taskRun.id,
      nodeId: runnable.id,
      phase: "approval_required",
      foldGroup: "Human Actions",
      title: "Approval required",
      content: executionPolicyDecision.reason,
      metadata: { tool, policyHit: executionPolicyDecision.policyHit },
    });
    return getTaskRunDetail(taskRunId);
  }

  if (timeoutReached) {
    const failureClass = classifyFailure({
      reason: "节点执行超时",
      timeout: true,
    });
    execute(
      "UPDATE task_run_nodes SET status = ?, output_json = ?, completed_at = ? WHERE id = ?",
      "failed",
      JSON.stringify({ failureClass, reason: "节点执行超时" }),
      nowIso(),
      runnable.id,
    );
    execute("UPDATE task_runs SET status = ? WHERE id = ?", "failed", taskRun.id);
    appendTaskRunEvent({
      traceId: taskRun.traceId,
      taskRunId: taskRun.id,
      nodeId: runnable.id,
      phase: "timeout",
      foldGroup: "Analysis",
      title: "Node timeout",
      content: `节点 ${runnable.nodeKey} 执行超时。`,
      metadata: { failureClass },
    });
    return getTaskRunDetail(taskRunId);
  }

  execute(
    "UPDATE task_run_nodes SET status = ?, output_json = ?, completed_at = ? WHERE id = ?",
    "completed",
    JSON.stringify({
      result: "ok",
      action,
      tool,
      executedBy: requestedBy,
      completedAt: nowIso(),
    }),
    nowIso(),
    runnable.id,
  );

  appendTaskRunEvent({
    traceId: taskRun.traceId,
    taskRunId: taskRun.id,
    nodeId: runnable.id,
    phase: "tool_result",
    foldGroup: "Synthesis",
    title: "Node completed",
    content: `节点 ${runnable.nodeKey} 已完成，工具 ${tool} 执行成功。`,
  });

  const completedNodes = getTaskRunNodes(taskRun.id);
  const taskRunStatus = resolveTaskRunStatusFromNodes(completedNodes);
  execute(
    "UPDATE task_runs SET status = ?, completed_at = ?, cost_actual = ? WHERE id = ?",
    taskRunStatus,
    taskRunStatus === "completed" ? nowIso() : null,
    roundCurrency(
      completedNodes.filter((node) => node.status === "completed").length *
        COST_PER_COMPLETED_NODE_USD,
    ),
    taskRun.id,
  );

  return getTaskRunDetail(taskRunId);
}

export function retryTaskRunNode(args: { taskRunId: string; nodeId: string; requestedBy: string }) {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", args.taskRunId);
  const node = queryOne<TaskRunNode>("SELECT * FROM task_run_nodes WHERE id = ? AND task_run_id = ?", args.nodeId, args.taskRunId);
  if (!taskRun || !node) {
    throw new Error("任务或节点不存在。");
  }

  if (node.attemptCount >= node.maxAttempts) {
    throw new Error("已达到最大重试次数。");
  }

  execute(
    "UPDATE task_run_nodes SET status = ?, output_json = ?, started_at = ?, completed_at = ? WHERE id = ?",
    "ready",
    null,
    null,
    null,
    node.id,
  );
  execute("UPDATE task_runs SET status = ? WHERE id = ?", "running", taskRun.id);

  appendTaskRunEvent({
    traceId: taskRun.traceId,
    taskRunId: taskRun.id,
    nodeId: node.id,
    phase: "planning",
    foldGroup: "Planning",
    title: "Node retried",
    content: `${args.requestedBy} 触发节点 ${node.nodeKey} 重试。`,
  });

  return getTaskRunDetail(args.taskRunId);
}

export function resolveTaskRunIntervention(args: {
  interventionId: string;
  decision: "approved" | "rejected";
  resolutionNote?: string;
  resolvedBy: string;
}) {
  const intervention = queryOne<TaskRunIntervention>(
    "SELECT * FROM task_run_interventions WHERE id = ?",
    args.interventionId,
  );
  if (!intervention) throw new Error("人工干预单不存在。");

  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", intervention.taskRunId);
  if (!taskRun) throw new Error("任务不存在。");

  execute(
    "UPDATE task_run_interventions SET status = ?, resolution_note = ?, resolved_at = ? WHERE id = ?",
    args.decision,
    args.resolutionNote ?? null,
    nowIso(),
    intervention.id,
  );

  if (intervention.nodeId) {
    execute(
      "UPDATE task_run_nodes SET status = ? WHERE id = ?",
      args.decision === "approved" ? "ready" : "failed",
      intervention.nodeId,
    );
  }

  execute("UPDATE task_runs SET status = ? WHERE id = ?", args.decision === "approved" ? "running" : "failed", taskRun.id);

  appendTaskRunEvent({
    traceId: taskRun.traceId,
    taskRunId: taskRun.id,
    nodeId: intervention.nodeId,
    phase: "approval_result",
    foldGroup: "Human Actions",
    title: "Intervention resolved",
    content: `${args.resolvedBy} 将干预单 ${intervention.id} 标记为 ${args.decision}。`,
    metadata: { resolutionNote: args.resolutionNote ?? null },
  });

  return getTaskRunDetail(taskRun.id);
}

export function resumeTaskRun(taskRunId: string, requestedBy: string) {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", taskRunId);
  if (!taskRun) throw new Error("任务不存在。");

  execute("UPDATE task_run_nodes SET status = ? WHERE task_run_id = ? AND status = ?", "ready", taskRunId, "awaiting");
  execute("UPDATE task_runs SET status = ? WHERE id = ?", "running", taskRunId);

  appendTaskRunEvent({
    traceId: taskRun.traceId,
    taskRunId,
    phase: "approval_result",
    foldGroup: "Human Actions",
    title: "任务已恢复",
    content: `${requestedBy} 恢复了任务执行。`,
  });

  return getTaskRunDetail(taskRunId);
}

export function getTaskRunExecutionBoard(taskRunId: string) {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", taskRunId);
  if (!taskRun) return null;
  const nodes = getTaskRunNodes(taskRunId);

  const readyByDependency = nodes.map((node) => {
    const deps = JSON.parse(node.dependsOnJson) as string[];
    const dependencyNodes = nodes.filter((candidate) => deps.includes(candidate.nodeKey));
    const dependenciesReady =
      deps.length === 0 ||
      (dependencyNodes.length === deps.length &&
        dependencyNodes.every((candidate) => candidate.status === "completed"));
    return {
      nodeId: node.id,
      nodeKey: node.nodeKey,
      status: node.status,
      dependenciesReady,
      dependencies: deps,
    };
  });

  const total = nodes.length;
  const completedCount = nodes.filter((node) => node.status === "completed").length;
  const failedCount = nodes.filter((node) => node.status === "failed").length;
  const awaitingCount = nodes.filter((node) => node.status === "awaiting").length;
  const retryableCount = nodes.filter((node) => node.status === "failed" && node.attemptCount < node.maxAttempts).length;
  const throughput = total === 0 ? 0 : completedCount / total;
  const failureRate = total === 0 ? 0 : failedCount / total;
  const humanInterventionRate = total === 0 ? 0 : awaitingCount / total;
  const retryRecoveryPotential = failedCount === 0 ? 0 : retryableCount / failedCount;

  return {
    taskRunId,
    taskRunStatus: taskRun.status,
    board: buildExecutionBoard(nodes),
    readiness: readyByDependency,
    metrics: {
      throughput: Number(throughput.toFixed(2)),
      failureRate: Number(failureRate.toFixed(2)),
      humanInterventionRate: Number(humanInterventionRate.toFixed(2)),
      retryRecoveryPotential: Number(retryRecoveryPotential.toFixed(2)),
    },
  };
}

export function getTaskRunDependencyGraph(taskRunId: string) {
  const plan = queryOne<TaskRunPlan>("SELECT * FROM task_run_plans WHERE task_run_id = ?", taskRunId);
  const nodes = getTaskRunNodes(taskRunId);
  if (!plan) return null;
  const dag = JSON.parse(plan.dagJson) as {
    nodes?: Array<{ id: string; agent: string }>;
    edges?: string[][];
  };
  return {
    taskRunId,
    plannerMode: plan.plannerMode,
    summary: plan.summary,
    nodes: nodes.map((node) => ({
      id: node.id,
      nodeKey: node.nodeKey,
      agentId: node.agentId,
      status: node.status,
      dependsOn: JSON.parse(node.dependsOnJson) as string[],
    })),
    edges: dag.edges ?? [],
  };
}

export function getTaskRunCostBreakdown(taskRunId: string) {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", taskRunId);
  if (!taskRun) return null;
  const nodes = getTaskRunNodes(taskRunId);
  const nodeCosts = nodes.map((node) => ({
    nodeId: node.id,
    nodeKey: node.nodeKey,
    status: node.status,
    attemptCount: node.attemptCount,
    estimatedUsd: roundCurrency(
      BASE_ESTIMATED_NODE_COST_USD + node.attemptCount * PER_ATTEMPT_NODE_COST_USD,
    ),
    actualUsd:
      node.status === "completed"
        ? roundCurrency(BASE_ACTUAL_NODE_COST_USD + node.attemptCount * PER_ATTEMPT_NODE_COST_USD)
        : 0,
  }));
  const estimatedUsd = roundCurrency(
    nodeCosts.reduce((sum, node) => sum + node.estimatedUsd, 0),
  );
  const actualUsd = roundCurrency(nodeCosts.reduce((sum, node) => sum + node.actualUsd, 0));

  return {
    taskRunId,
    status: taskRun.status,
    estimateFromTaskRun: taskRun.costEstimate,
    actualFromTaskRun: taskRun.costActual,
    estimatedUsd,
    actualUsd,
    nodeCosts,
  };
}

export function getTaskRunPolicyHits(taskRunId: string) {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", taskRunId);
  if (!taskRun) return null;
  const events = queryAll<EventLog>(
    "SELECT * FROM event_logs WHERE task_run_id = ? ORDER BY seq ASC",
    taskRunId,
  );
  const policyPhases = [
    "approval_required",
    "policy_violation",
    "access_grant_violation",
    "approval_result",
    "timeout",
  ];

  const hits = events
    .filter((event) => policyPhases.includes(event.phase))
    .map((event) => ({
      seq: event.seq,
      phase: event.phase,
      title: event.title,
      content: event.content,
      createdAt: event.createdAt,
      metadata: JSON.parse(event.metadataJson) as Record<string, unknown>,
    }));

  return {
    taskRunId,
    hitCount: hits.length,
    hits,
  };
}

export async function refreshRuntimeCatalogs() {
  const runtimes = listRuntimeEndpoints();
  const discoveries = await discoverConfiguredRuntimes(runtimes);

  for (const discovery of discoveries) {
    const current = runtimes.find((runtime) => runtime.baseUrl === discovery.baseUrl);

    if (current) {
      execute(
        "UPDATE runtime_endpoints SET health_status = ?, agent_catalog_json = ?, provider_catalog_json = ?, last_discovered_at = ? WHERE id = ?",
        discovery.status,
        JSON.stringify(discovery.agents),
        JSON.stringify(discovery.providers),
        new Date().toISOString(),
        current.id,
      );
    }
  }

  return discoveries;
}
