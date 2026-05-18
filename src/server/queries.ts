import { addMinutes } from "date-fns";
import { randomUUID } from "node:crypto";
import {
  execute,
  queryAll,
  queryOne,
  type Agent,
  type AgentDefinition,
  type AgentDefinitionShare,
  type AgentTeam,
  type AgentTeamMember,
  type AgentTeamShare,
  type AccessGrant,
  type DeveloperProfile,
  type EventLog,
  type ExecutionEnvironment,
  type ExecutionPolicy,
  type EnvironmentSnapshot,
  type Finding,
  type BusinessTeam,
  type ProviderAdapterDefinition,
  type ProviderProfile,
  type ProviderRuntimeBinding,
  type TaskBlueprint,
  type TaskEvent,
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
import { discoverConfiguredRuntimes } from "@/server/runtime-adapter-core";
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
import { buildNodeSpecsFromRunPlan } from "@/server/agent-orchestration-core";
import { buildEnvironmentSnapshotPayload } from "@/server/environment-snapshot-core";
import {
  buildFindingDashboard,
  buildFindingFingerprint,
  summarizeFinding,
} from "@/server/finding-core";
import {
  buildTaskRunKnowledgeRetrieval,
  resolveTaskKnowledgeContext,
} from "@/server/knowledge-core";
import { publishTaskRunOutputs } from "@/server/output-publisher-core";
import {
  buildTaskBlueprintDetail,
  buildTaskBlueprintSummary,
  buildTaskRunKernelView,
  normalizeTriggerType,
  renderTemplateValue,
} from "@/server/task-blueprint-core";
import { buildEffectivePermissionPreview } from "@/server/permission-core";
import { getLanguagePackSetting } from "@/server/language-pack-store";
import { uiText } from "@/lib/language-pack";

export function listTenantSpaces() {
  return queryAll<TenantSpace>("SELECT * FROM tenant_spaces WHERE status <> 'deleted' ORDER BY name ASC");
}

export function listBusinessTeams() {
  return queryAll<BusinessTeam>("SELECT * FROM business_teams WHERE status <> 'deleted' ORDER BY name ASC");
}

export function listExecutionPolicies() {
  return queryAll<ExecutionPolicy>("SELECT * FROM execution_policies ORDER BY name ASC");
}

export function listAgentTeams() {
  return queryAll<AgentTeam>("SELECT * FROM agent_teams ORDER BY updated_at DESC, name ASC");
}

export function listAgents() {
  const mapped = queryAll<Agent>(
    `
      SELECT
        agent_team_members.id,
        agent_team_members.team_id,
        agent_definitions.slug,
        agent_definitions.name,
        agent_team_members.member_role AS role,
        CASE
          WHEN TRIM(agent_team_members.work_instruction) <> '' THEN agent_team_members.work_instruction
          ELSE agent_definitions.system_prompt
        END AS persona_prompt,
        agent_definitions.model,
        8 AS short_term_window,
        json_object(
          'memberRole', agent_team_members.member_role,
          'agentDefinitionId', agent_team_members.agent_definition_id,
          'memoryScope', agent_definitions.memory_scope
        ) AS rag_config_json,
        agent_definitions.tool_bindings_json,
        agent_definitions.memory_scope,
        agent_definitions.permission_policy_json AS safety_policy_json,
        agent_team_members.status,
        agent_team_members.created_at
      FROM agent_team_members
      JOIN agent_definitions ON agent_definitions.id = agent_team_members.agent_definition_id
      WHERE agent_definitions.status <> 'deleted'
      ORDER BY agent_team_members.team_id ASC, agent_team_members.position ASC, agent_team_members.created_at ASC
    `,
  );

  if (mapped.length > 0) return mapped;
  return queryAll<Agent>("SELECT * FROM agents ORDER BY name ASC");
}

export function listAgentTeamMembers(teamId?: string) {
  return teamId
    ? queryAll<AgentTeamMember>(
        "SELECT * FROM agent_team_members WHERE team_id = ? ORDER BY position ASC, created_at ASC",
        teamId,
      )
    : queryAll<AgentTeamMember>(
        "SELECT * FROM agent_team_members ORDER BY team_id ASC, position ASC, created_at ASC",
      );
}

export function listAgentTeamShares(teamId?: string) {
  return teamId
    ? queryAll<AgentTeamShare>(
        "SELECT * FROM agent_team_shares WHERE agent_team_id = ? ORDER BY created_at ASC",
        teamId,
      )
    : queryAll<AgentTeamShare>("SELECT * FROM agent_team_shares ORDER BY created_at ASC");
}

export function listAgentTeamMemberProfiles(teamId?: string) {
  return queryAll<
    AgentTeamMember &
      Pick<
        AgentDefinition,
        | "name"
        | "slug"
        | "role"
        | "description"
        | "systemPrompt"
        | "model"
        | "toolBindingsJson"
        | "memoryScope"
        | "visibility"
        | "defaultProviderProfileId"
        | "defaultRuntimeBindingId"
        | "harnessConfigJson"
        | "permissionPolicyJson"
      >
  >(
    `
      SELECT
        agent_team_members.*,
        agent_definitions.slug,
        agent_definitions.name,
        agent_definitions.role,
        agent_definitions.description,
        agent_definitions.system_prompt,
        agent_definitions.model,
        agent_definitions.tool_bindings_json,
        agent_definitions.memory_scope,
        agent_definitions.visibility,
        agent_definitions.default_provider_profile_id,
        agent_definitions.default_runtime_binding_id,
        agent_definitions.harness_config_json,
        agent_definitions.permission_policy_json
      FROM agent_team_members
      JOIN agent_definitions ON agent_definitions.id = agent_team_members.agent_definition_id
      WHERE agent_definitions.status <> 'deleted'
      ${teamId ? "AND agent_team_members.team_id = ?" : ""}
      ORDER BY agent_team_members.team_id ASC, agent_team_members.position ASC, agent_team_members.created_at ASC
    `,
    ...(teamId ? [teamId] : []),
  );
}

export function listAgentDefinitions() {
  return queryAll<AgentDefinition>(
    "SELECT * FROM agent_definitions WHERE status <> 'deleted' ORDER BY updated_at DESC, name ASC",
  );
}

export function listAgentDefinitionShares(agentDefinitionId?: string) {
  return agentDefinitionId
    ? queryAll<AgentDefinitionShare>(
        "SELECT * FROM agent_definition_shares WHERE agent_definition_id = ? ORDER BY created_at ASC",
        agentDefinitionId,
      )
    : queryAll<AgentDefinitionShare>(
        "SELECT * FROM agent_definition_shares ORDER BY created_at ASC",
      );
}

export function getAgentDefinition(id: string) {
  const definition = queryOne<AgentDefinition>(
    "SELECT * FROM agent_definitions WHERE id = ?",
    id,
  );
  if (!definition) return null;

  return {
    definition,
    shares: listAgentDefinitionShares(id),
  };
}

export function getAgentTeam(id: string) {
  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", id);
  if (!team) return null;

  return {
    team,
    members: listAgentTeamMemberProfiles(id),
    shares: listAgentTeamShares(id),
  };
}

export function upsertAgentDefinition(
  input: Pick<
    AgentDefinition,
    | "id"
    | "tenantSpaceId"
    | "ownerBusinessTeamId"
    | "ownerUserId"
    | "sourceAgentId"
    | "slug"
    | "name"
    | "role"
    | "description"
    | "systemPrompt"
    | "model"
    | "defaultProviderProfileId"
    | "defaultRuntimeBindingId"
    | "toolBindingsJson"
    | "harnessConfigJson"
    | "permissionPolicyJson"
    | "memoryScope"
    | "tagsJson"
    | "visibility"
    | "status"
    | "validationStatus"
    | "lastValidatedAt"
    | "lastValidationSummary"
  >,
  shareBusinessTeamIds: string[],
) {
	const current = queryOne<AgentDefinition>(
	  "SELECT * FROM agent_definitions WHERE id = ?",
	  input.id,
	);
	const ownerBusinessTeam = input.ownerBusinessTeamId
	  ? queryOne<BusinessTeam>("SELECT * FROM business_teams WHERE id = ?", input.ownerBusinessTeamId)
	  : null;
	const tenantSpaceId = input.tenantSpaceId || current?.tenantSpaceId || ownerBusinessTeam?.tenantSpaceId || "";
	const createdAt = current?.createdAt ?? new Date().toISOString();
	const updatedAt = new Date().toISOString();

  execute(
    "INSERT OR REPLACE INTO agent_definitions (id, tenant_space_id, owner_business_team_id, owner_user_id, source_agent_id, slug, name, role, description, system_prompt, model, default_provider_profile_id, default_runtime_binding_id, tool_bindings_json, harness_config_json, permission_policy_json, memory_scope, tags_json, visibility, status, validation_status, last_validated_at, last_validation_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    input.id,
	    tenantSpaceId,
    input.ownerBusinessTeamId ?? null,
    input.ownerUserId,
    input.sourceAgentId ?? null,
    input.slug,
    input.name,
    input.role,
    input.description,
    input.systemPrompt,
    input.model,
    input.defaultProviderProfileId ?? null,
    input.defaultRuntimeBindingId ?? null,
    input.toolBindingsJson,
    input.harnessConfigJson,
    input.permissionPolicyJson,
    input.memoryScope,
    input.tagsJson,
    input.visibility,
    input.status,
    input.validationStatus,
    input.lastValidatedAt ?? null,
    input.lastValidationSummary ?? null,
    createdAt,
    updatedAt,
  );

  execute("DELETE FROM agent_definition_shares WHERE agent_definition_id = ?", input.id);
  const seenTeamIds = new Set<string>();
  shareBusinessTeamIds
    .map((teamId) => teamId.trim())
    .filter(Boolean)
    .forEach((teamId) => {
      if (seenTeamIds.has(teamId)) return;
      seenTeamIds.add(teamId);
      execute(
        "INSERT INTO agent_definition_shares (id, agent_definition_id, business_team_id, access_level, created_at) VALUES (?, ?, ?, ?, ?)",
        randomUUID(),
        input.id,
        teamId,
        "viewer",
        updatedAt,
      );
    });

  return getAgentDefinition(input.id);
}

export function upsertAgentTeam(
  input: Pick<
    AgentTeam,
    | "id"
    | "businessTeamId"
    | "slug"
    | "name"
    | "description"
    | "leaderAgentId"
    | "workflowType"
    | "orchestrationPrompt"
    | "workflowDefinitionJson"
    | "inputSchemaJson"
    | "outputSchemaJson"
    | "maxConcurrency"
    | "timeoutMs"
    | "successRateThreshold"
    | "pricingModelJson"
    | "visibility"
    | "defaultExecutionPolicyId"
  >,
  members: Array<
    Pick<AgentTeamMember, "id" | "agentDefinitionId" | "memberRole" | "workInstruction" | "position" | "status">
  >,
  shares: Array<Pick<AgentTeamShare, "businessTeamId" | "accessLevel">>,
) {
  const current = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", input.id);
  const createdAt = current?.createdAt ?? new Date().toISOString();
  const updatedAt = new Date().toISOString();

  execute(
    "INSERT OR REPLACE INTO agent_teams (id, business_team_id, slug, name, description, leader_agent_id, workflow_type, orchestration_prompt, workflow_definition_json, input_schema_json, output_schema_json, max_concurrency, timeout_ms, success_rate_threshold, pricing_model_json, visibility, default_execution_policy_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    input.id,
    input.businessTeamId,
    input.slug,
    input.name,
    input.description,
    input.leaderAgentId ?? null,
    input.workflowType,
    input.orchestrationPrompt,
    input.workflowDefinitionJson,
    input.inputSchemaJson,
    input.outputSchemaJson,
    input.maxConcurrency,
    input.timeoutMs,
    input.successRateThreshold,
    input.pricingModelJson,
    input.visibility,
    input.defaultExecutionPolicyId ?? null,
    createdAt,
    updatedAt,
  );

  execute("DELETE FROM agent_team_members WHERE team_id = ?", input.id);
  const seenMemberIds = new Set<string>();
  members
    .slice()
    .sort((left, right) => left.position - right.position)
    .forEach((member, index) => {
      const memberId = member.id?.trim() || randomUUID();
      if (seenMemberIds.has(memberId)) return;
      seenMemberIds.add(memberId);
      execute(
        "INSERT INTO agent_team_members (id, team_id, agent_definition_id, member_role, work_instruction, position, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        memberId,
        input.id,
        member.agentDefinitionId,
        member.memberRole,
        member.workInstruction,
        index,
        member.status,
        createdAt,
        updatedAt,
      );
    });

  execute("DELETE FROM agent_team_shares WHERE agent_team_id = ?", input.id);
  const seenShareKeys = new Set<string>();
  shares.forEach((share) => {
    const teamId = share.businessTeamId.trim();
    if (!teamId) return;
    const accessLevel = share.accessLevel?.trim() || "viewer";
    const key = `${teamId}:${accessLevel}`;
    if (seenShareKeys.has(key)) return;
    seenShareKeys.add(key);
    execute(
      "INSERT INTO agent_team_shares (id, agent_team_id, business_team_id, access_level, created_at) VALUES (?, ?, ?, ?, ?)",
      randomUUID(),
      input.id,
      teamId,
      accessLevel,
      updatedAt,
    );
  });

  return getAgentTeam(input.id);
}

export function listProviders() {
  return queryAll<ProviderProfile>("SELECT * FROM provider_profiles ORDER BY name ASC");
}

export function listProviderRuntimeBindings() {
  return queryAll<ProviderRuntimeBinding>(
    "SELECT * FROM provider_runtime_bindings ORDER BY is_enabled DESC, name ASC",
  );
}

export function deleteProviderRuntimeBinding(id: string) {
  execute("DELETE FROM provider_runtime_bindings WHERE id = ?", id);
  return { ok: true };
}

export function listRuntimeEndpoints() {
  return queryAll<RuntimeEndpoint>("SELECT * FROM runtime_endpoints ORDER BY name ASC");
}

export function listAccessGrants() {
  return queryAll<AccessGrant>("SELECT * FROM access_grants WHERE status <> 'deleted' ORDER BY created_at DESC");
}

export function listServiceCatalogListings() {
  return queryAll<ServiceCatalogListing>(
    "SELECT * FROM service_catalog_listings WHERE status <> 'deleted' ORDER BY created_at DESC",
  );
}

function estimateNextCronRunAt(expression: unknown, now = new Date()) {
  if (typeof expression !== "string" || !expression.trim()) return addMinutes(now, 60).toISOString();
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return addMinutes(now, 60).toISOString();
  const [minutePart, hourPart] = parts;
  const intervalMatch = minutePart.match(/^\*\/(\d+)$/);
  if (intervalMatch) {
    return addMinutes(now, Math.max(1, Number(intervalMatch[1]))).toISOString();
  }
  const minute = Number(minutePart);
  const hour = Number(hourPart);
  if (Number.isInteger(minute) && Number.isInteger(hour) && minute >= 0 && minute < 60 && hour >= 0 && hour < 24) {
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }
  return addMinutes(now, 60).toISOString();
}

export function listScheduleTemplates() {
  return listTaskBlueprints().map((blueprint) => {
    const trigger = parseJsonRecord(blueprint.triggerJson);
    const triggerType = normalizeTriggerType(trigger.type);
    const nextRunAt =
      triggerType === "schedule"
        ? typeof trigger.nextRunAt === "string"
          ? trigger.nextRunAt
          : estimateNextCronRunAt(trigger.expression)
        : null;
    return {
      id: `blueprint:${blueprint.id}:trigger`,
      businessTeamId: blueprint.ownerBusinessTeamId,
      teamId: blueprint.teamId,
      name: uiText("ui.server.taskBlueprint.triggerName", undefined, { name: blueprint.name }),
      scheduleKind: triggerType === "schedule" ? "cron" : triggerType,
      cadence:
        typeof trigger.expression === "string"
          ? trigger.expression
          : typeof trigger.event === "string"
            ? `Webhook: ${trigger.event}`
            : triggerType,
      nextRunAt,
      inputPayloadJson: JSON.stringify({
        taskBlueprintId: blueprint.id,
        trigger,
        source: "task_blueprint",
      }),
      isEnabled: blueprint.status === "active" ? 1 : 0,
      createdAt: blueprint.createdAt,
    } satisfies ScheduleTemplate;
  });
}

export function listTaskTemplates() {
  return listTaskBlueprints().map((blueprint) => {
    const trigger = parseJsonRecord(blueprint.triggerJson);
    const runPlan = parseJsonRecord(blueprint.agentTeamRunPlanJson);
    const memoryPolicy = parseJsonRecord(blueprint.memoryPolicyJson);
    const outputPolicy = parseJsonRecord(blueprint.outputPolicyJson);
    const publishers = Array.isArray(outputPolicy.publishers)
      ? outputPolicy.publishers
      : [];
    const firstPublisher =
      publishers.find((publisher) => publisher && typeof publisher === "object") as
        | { pluginId?: string; type?: string }
        | undefined;
    return {
      id: `blueprint:${blueprint.id}`,
      name: blueprint.name,
      caseKey: blueprint.category,
      pluginId:
        firstPublisher?.pluginId ??
        (typeof trigger.connector === "string" ? trigger.connector : null),
      teamId: blueprint.teamId,
      environmentId: blueprint.environmentId,
      plannerMode: typeof runPlan.strategy === "string" ? runPlan.strategy : "task_blueprint",
      summary: uiText("ui.server.taskBlueprint.compatibilitySummary", undefined, { name: blueprint.name }),
      inputSchemaJson: blueprint.inputSchemaJson,
      defaultInputJson: JSON.stringify({
        taskBlueprintId: blueprint.id,
        category: blueprint.category,
      }),
      memoryLayersJson: JSON.stringify(
        Array.isArray(memoryPolicy.requiredSpaces) ? memoryPolicy.requiredSpaces : [],
      ),
      outputTargetsJson: JSON.stringify(
        publishers.map((publisher) =>
          publisher && typeof publisher === "object" && "type" in publisher
            ? String((publisher as { type?: unknown }).type)
            : "unknown",
        ),
      ),
      nodesJson: blueprint.agentTeamRunPlanJson,
      webhookParserRef:
        typeof trigger.webhookParserRef === "string" ? trigger.webhookParserRef : null,
      visibility: blueprint.visibility,
      createdAt: blueprint.createdAt,
    } satisfies TaskTemplate;
  });
}

export function listTaskBlueprints() {
  return queryAll<TaskBlueprint>("SELECT * FROM task_blueprints WHERE status <> 'deleted' ORDER BY category ASC, name ASC");
}

export function listTaskRuns() {
  return queryAll<TaskRun>("SELECT * FROM task_runs ORDER BY created_at DESC");
}

export function listTaskEvents(taskRunId?: string) {
  return taskRunId
    ? queryAll<TaskEvent>("SELECT * FROM task_events WHERE task_run_id = ? ORDER BY event_time ASC", taskRunId)
    : queryAll<TaskEvent>("SELECT * FROM task_events ORDER BY event_time DESC");
}

export function listFindings() {
  return queryAll<Finding>("SELECT * FROM findings WHERE status <> 'deleted' ORDER BY created_at DESC");
}

export function listProviderAdapterDefinitions() {
  return queryAll<ProviderAdapterDefinition>(
    "SELECT * FROM provider_adapter_definitions ORDER BY lifecycle ASC, name ASC",
  );
}

export function listRepositories() {
  return queryAll<RepositoryProfile>("SELECT * FROM repository_profiles ORDER BY activity_index DESC, name ASC");
}

export function listDevelopers() {
  return queryAll<DeveloperProfile>("SELECT * FROM developer_profiles ORDER BY last_active_at DESC");
}

export function listExecutionEnvironments() {
  return queryAll<ExecutionEnvironment>(
    "SELECT * FROM execution_environments WHERE status <> 'deleted' ORDER BY status ASC, name ASC",
  );
}

export function deleteExecutionEnvironment(id: string) {
  execute("UPDATE execution_environments SET status = 'deleted' WHERE id = ?", id);
  return { ok: true };
}

export function getTaskBlueprintEditorOptions() {
  const businessTeams = listBusinessTeams();
  const agentTeams = listAgentTeams();
  const agentTeamMembers = listAgentTeamMemberProfiles();
  const environments = listExecutionEnvironments();
  const providerAdapters = listProviderAdapterDefinitions();

  return {
    businessTeams: businessTeams.map((team) => ({ id: team.id, name: team.name })),
    agentTeams: agentTeams.map((team) => ({
      id: team.id,
      name: team.name,
      workflowType: team.workflowType,
      leaderAgentId: team.leaderAgentId,
      orchestrationPrompt: team.orchestrationPrompt,
      workflowDefinitionJson: team.workflowDefinitionJson,
      members: agentTeamMembers
        .filter((member) => member.teamId === team.id)
        .map((member) => ({
          id: member.id,
          name: member.name,
          role: member.role,
          memberRole: member.memberRole,
          workInstruction: member.workInstruction,
        })),
    })),
    environments: environments.map((environment) => ({
      id: environment.id,
      name: environment.name,
      repositoryProvider: environment.repositoryProvider,
      repositoryName: environment.repositoryName,
      workingDirectory: environment.workingDirectory,
      sandboxProfileJson: environment.sandboxProfileJson,
    })),
    providerAdapters: providerAdapters.map((adapter) => ({
      id: adapter.id,
      name: adapter.name,
    })),
  };
}

export function upsertProviderProfile(
  input: Pick<
    ProviderProfile,
    | "id"
    | "tenantSpaceId"
    | "name"
    | "baseUrl"
    | "apiStyle"
    | "defaultModel"
    | "modelsJson"
    | "apiKeyRef"
    | "configJson"
    | "isEnabled"
  >,
) {
  const current = queryOne<ProviderProfile>("SELECT * FROM provider_profiles WHERE id = ?", input.id);
  const createdAt = current?.createdAt ?? new Date().toISOString();
  execute(
    "INSERT OR REPLACE INTO provider_profiles (id, tenant_space_id, name, base_url, api_style, default_model, models_json, api_key_ref, config_json, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    input.id,
    input.tenantSpaceId,
    input.name,
    input.baseUrl,
    input.apiStyle,
    input.defaultModel,
    input.modelsJson,
    input.apiKeyRef,
    input.configJson,
    input.isEnabled,
    createdAt,
    new Date().toISOString(),
  );

  return queryOne<ProviderProfile>("SELECT * FROM provider_profiles WHERE id = ?", input.id);
}

export function upsertProviderRuntimeBinding(
  input: Pick<
    ProviderRuntimeBinding,
    | "id"
    | "tenantSpaceId"
    | "businessTeamId"
    | "adapterDefinitionId"
    | "name"
    | "runtimeKind"
    | "baseUrl"
    | "command"
    | "workspaceRoot"
    | "defaultProviderProfileId"
    | "apiKeyRef"
    | "configJson"
    | "isEnabled"
  >,
) {
  const current = queryOne<ProviderRuntimeBinding>(
    "SELECT * FROM provider_runtime_bindings WHERE id = ?",
    input.id,
  );
  const createdAt = current?.createdAt ?? new Date().toISOString();
  execute(
    "INSERT OR REPLACE INTO provider_runtime_bindings (id, tenant_space_id, business_team_id, adapter_definition_id, name, runtime_kind, base_url, command, workspace_root, default_provider_profile_id, api_key_ref, config_json, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    input.id,
    input.tenantSpaceId,
    input.businessTeamId ?? null,
    input.adapterDefinitionId,
    input.name,
    input.runtimeKind,
    input.baseUrl,
    input.command,
    input.workspaceRoot,
    input.defaultProviderProfileId ?? null,
    input.apiKeyRef,
    input.configJson,
    input.isEnabled,
    createdAt,
    new Date().toISOString(),
  );

  return queryOne<ProviderRuntimeBinding>(
    "SELECT * FROM provider_runtime_bindings WHERE id = ?",
    input.id,
  );
}

export function getTaskBlueprintsSnapshot() {
  const blueprints = listTaskBlueprints();
  const businessTeams = listBusinessTeams();
  const teams = listAgentTeams();
  const environments = listExecutionEnvironments();
  const providerAdapters = listProviderAdapterDefinitions();
  const taskRuns = listTaskRuns();
  const findings = listFindings();

  return {
    blueprints: blueprints.map((blueprint) =>
      buildTaskBlueprintSummary({
        blueprint,
        businessTeams,
        teams,
        environments,
        providerAdapters,
        taskRuns,
        findings,
      }),
    ),
    providerAdapters,
    findingDashboard: buildFindingDashboard({
      findings,
      taskRuns,
      businessTeams,
    }),
  };
}

export function getSettingsSnapshot() {
  const tenantSpaces = listTenantSpaces();
  const businessTeams = listBusinessTeams();
  const agentTeams = listAgentTeams();
  const providers = listProviders();
  const providerRuntimeBindings = listProviderRuntimeBindings();
  const providerAdapters = listProviderAdapterDefinitions();
  const environments = listExecutionEnvironments();
  const webhooks = listWebhooks();
  const taskBlueprints = listTaskBlueprints();

  return {
    tenantSpaces,
    businessTeams,
    agentTeams,
    providers,
    providerRuntimeBindings,
    providerAdapters,
    environments,
    webhooks,
    taskBlueprints,
    languagePackSetting: getLanguagePackSetting(),
    metrics: {
      providerProfileCount: providers.length,
      enabledProviderProfileCount: providers.filter((provider) => provider.isEnabled).length,
      runtimeBindingCount: providerRuntimeBindings.length,
      enabledRuntimeBindingCount: providerRuntimeBindings.filter((binding) => binding.isEnabled).length,
      blueprintCount: taskBlueprints.length,
      enabledBlueprintCount: taskBlueprints.filter((blueprint) => blueprint.status === "active").length,
    },
  };
}

export function getTaskBlueprintDetail(blueprintId: string) {
  const blueprint = queryOne<TaskBlueprint>("SELECT * FROM task_blueprints WHERE id = ?", blueprintId);
  if (!blueprint) return null;

  return {
    ...buildTaskBlueprintDetail({
    blueprint,
    businessTeams: listBusinessTeams(),
    teams: listAgentTeams(),
    agents: listAgents(),
    environments: listExecutionEnvironments(),
    providerAdapters: listProviderAdapterDefinitions(),
    taskRuns: listTaskRuns(),
    findings: listFindings(),
    }),
    options: getTaskBlueprintEditorOptions(),
  };
}

export function upsertTaskBlueprint(
  input: Pick<
    TaskBlueprint,
    | "id"
    | "name"
    | "category"
    | "visibility"
    | "ownerBusinessTeamId"
    | "teamId"
    | "environmentId"
    | "providerAdapterId"
    | "version"
    | "status"
    | "triggerJson"
    | "inputSchemaJson"
    | "environmentSelectorJson"
    | "agentTeamRunPlanJson"
    | "memoryPolicyJson"
    | "providerPolicyJson"
    | "permissionPolicyJson"
    | "resultSchemaJson"
    | "outputPolicyJson"
    | "dashboardPolicyJson"
    | "executionPolicyJson"
    | "archivePolicyJson"
  >,
) {
  const current = queryOne<TaskBlueprint>("SELECT * FROM task_blueprints WHERE id = ?", input.id);
  const createdAt = current?.createdAt ?? new Date().toISOString();
  const executionPolicyJson = buildTaskBlueprintExecutionPolicyJson(
    input.executionPolicyJson,
    input.agentTeamRunPlanJson,
  );
  execute(
    "INSERT OR REPLACE INTO task_blueprints (id, name, category, visibility, owner_business_team_id, team_id, environment_id, provider_adapter_id, version, status, trigger_json, input_schema_json, environment_selector_json, agent_team_run_plan_json, memory_policy_json, provider_policy_json, permission_policy_json, result_schema_json, output_policy_json, dashboard_policy_json, execution_policy_json, archive_policy_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    input.id,
    input.name,
    input.category,
    input.visibility,
    input.ownerBusinessTeamId,
    input.teamId,
    input.environmentId ?? null,
    input.providerAdapterId,
    input.version,
    input.status,
    input.triggerJson,
    input.inputSchemaJson,
    input.environmentSelectorJson,
    input.agentTeamRunPlanJson,
    input.memoryPolicyJson,
    input.providerPolicyJson,
    input.permissionPolicyJson,
    input.resultSchemaJson,
    input.outputPolicyJson,
    input.dashboardPolicyJson,
    executionPolicyJson,
    input.archivePolicyJson,
    createdAt,
    new Date().toISOString(),
  );

  ensureWebhookEndpointForTaskBlueprint(input);

  return queryOne<TaskBlueprint>("SELECT * FROM task_blueprints WHERE id = ?", input.id);
}

function buildTaskBlueprintExecutionPolicyJson(policyJson: string, runPlanJson: string) {
  const policy = parseJsonRecord(policyJson);
  const runPlan = parseJsonRecord(runPlanJson);
  const blocks = Array.isArray(runPlan.blocks)
    ? runPlan.blocks.filter((block): block is Record<string, unknown> => Boolean(block && typeof block === "object"))
    : [];
  const workers = Array.isArray(runPlan.workers)
    ? runPlan.workers.filter((worker): worker is Record<string, unknown> => Boolean(worker && typeof worker === "object"))
    : [];
  const toolPolicy =
    policy.toolPolicy && typeof policy.toolPolicy === "object" && !Array.isArray(policy.toolPolicy)
      ? (policy.toolPolicy as Record<string, unknown>)
      : {};
  const allowedTools = dedupeStrings([
    ...parseStringArray(policy.allowedTools),
    ...parseStringArray(policy.tools),
    ...parseStringArray(toolPolicy.allowed),
    ...blocks.map((block) => (typeof block.tool === "string" ? block.tool : "")).filter(Boolean),
    ...workers.map((worker) => (typeof worker.tool === "string" ? worker.tool : "")).filter(Boolean),
  ]);

  return JSON.stringify(
    {
      ...policy,
      allowedTools,
    },
    null,
    2,
  );
}

function ensureWebhookEndpointForTaskBlueprint(
  input: Pick<
    TaskBlueprint,
    | "id"
    | "name"
    | "ownerBusinessTeamId"
    | "teamId"
    | "status"
    | "triggerJson"
    | "inputSchemaJson"
  >,
) {
  const trigger = parseJsonRecord(input.triggerJson);
  if (normalizeTriggerType(trigger.type) !== "webhook") return;
  const pathKey = typeof trigger.webhookPathKey === "string" ? trigger.webhookPathKey.trim() : "";
  if (!pathKey) return;
  const existing = getWebhookEndpointByPathKey(pathKey);
  const secretHint =
    typeof trigger.secretRef === "string"
      ? trigger.secretRef
      : typeof trigger.webhookSecretRef === "string"
        ? trigger.webhookSecretRef
        : "";
  upsertWebhookEndpoint({
    id: existing?.id ?? `webhook:${pathKey}`,
    businessTeamId: input.ownerBusinessTeamId,
    teamId: input.teamId,
    name: `${input.name} Webhook`,
    pathKey,
    method: "POST",
    requestSchemaJson: input.inputSchemaJson,
    secretHint,
    isEnabled: input.status === "archived" ? 0 : 1,
  });
}

export function getTaskBlueprintPermissionPreview(blueprintId: string) {
  const blueprint = queryOne<TaskBlueprint>("SELECT * FROM task_blueprints WHERE id = ?", blueprintId);
  if (!blueprint) return null;
  return buildEffectivePermissionPreview(blueprint.permissionPolicyJson);
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

export function deleteWebhookEndpoint(id: string) {
  execute("DELETE FROM webhook_endpoints WHERE id = ?", id);
  return { ok: true };
}

export function getWebhookEndpointByPathKey(pathKey: string) {
  return queryOne<WebhookEndpoint>(
    "SELECT * FROM webhook_endpoints WHERE path_key = ? ORDER BY name ASC LIMIT 1",
    pathKey,
  );
}

export function upsertWebhookEndpoint(
  input: Pick<
    WebhookEndpoint,
    | "id"
    | "businessTeamId"
    | "teamId"
    | "name"
    | "pathKey"
    | "method"
    | "requestSchemaJson"
    | "secretHint"
    | "isEnabled"
  >,
) {
  execute(
    "INSERT OR REPLACE INTO webhook_endpoints (id, business_team_id, team_id, name, path_key, method, request_schema_json, secret_hint, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    input.id,
    input.businessTeamId,
    input.teamId,
    input.name,
    input.pathKey,
    input.method,
    input.requestSchemaJson,
    input.secretHint,
    input.isEnabled,
  );

  return queryOne<WebhookEndpoint>("SELECT * FROM webhook_endpoints WHERE id = ?", input.id);
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
  const blueprint = taskRun.blueprintId
    ? queryOne<TaskBlueprint>("SELECT * FROM task_blueprints WHERE id = ?", taskRun.blueprintId)
    : null;
  const taskEvents = listTaskEvents(taskRun.id);
  const environmentSnapshot = taskRun.environmentSnapshotId
    ? queryOne<EnvironmentSnapshot>("SELECT * FROM environment_snapshots WHERE id = ?", taskRun.environmentSnapshotId)
    : null;
  const findings = queryAll<Finding>(
    "SELECT * FROM findings WHERE task_run_id = ? AND status <> 'deleted' ORDER BY created_at DESC",
    taskRun.id,
  );
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
      : { provider: null, rationale: [uiText("ui.generated.c6355a4d7af")] };

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
      agentName: agents.find((agent) => agent.id === node.agentId)?.name ?? uiText("ui.generated.c566f9749da"),
    })),
    executionBoard: buildExecutionBoard(nodes),
    interventions,
    groupedEvents: groupEventsByFoldGroup(events),
    kernel: buildTaskRunKernelView({
      taskRun,
      blueprint,
      taskEvents,
      environmentSnapshot,
      findings,
      agents: team ? agents.filter((agent) => agent.teamId === team.id) : agents,
    }),
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
  const blueprints = listTaskBlueprints();
  const providerAdapters = listProviderAdapterDefinitions();
  const findings = listFindings();

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
      teamName: team?.name ?? uiText("ui.generated.c603903ef14"),
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
      : { provider: null, rationale: [uiText("ui.generated.c0d7a8fc402")] };
  const featuredRuntime =
    featuredTaskRun
      ? runtimes.find((runtime) => runtime.businessTeamId === featuredTaskRun.businessTeamId) ?? null
      : null;

  return {
    metrics: [
      {
        label: uiText("ui.generated.c40532103db"),
        value: String(runningTaskRuns.length),
        detail: uiText("ui.generated.c517bd12ff1"),
      },
      {
        label: uiText("ui.generated.c047d2ebeac"),
        value: String(awaitingTaskRuns.length),
        detail: uiText("ui.generated.cb085a576d2"),
      },
      {
        label: uiText("ui.generated.cba7e0dd246"),
        value: String(teams.filter((team) => team.visibility === "public").length),
        detail: uiText("ui.generated.cc0cefb8d0d"),
      },
      {
        label: uiText("ui.generated.c9aaefc9ea1"),
        value: String(access_grants.filter((accessGrant) => accessGrant.status === "active").length),
        detail: uiText("ui.generated.c7ac0354c34"),
      },
    ],
    tenantSpaceSummaries,
    businessTeamSummaries,
    teamSummaries,
    taskBlueprints: blueprints.map((blueprint) =>
      buildTaskBlueprintSummary({
        blueprint,
        businessTeams: business_teams,
        teams,
        environments,
        providerAdapters,
        taskRuns: task_runs,
        findings,
      }),
    ),
    task_runs,
    findingDashboard: buildFindingDashboard({
      findings,
      taskRuns: task_runs,
      businessTeams: business_teams,
    }),
    findings: findings.slice(0, 8).map(summarizeFinding),
    serviceCatalogResumes,
    access_grants: access_grants.map((accessGrant) => ({
      ...buildAccessGrantSummary(accessGrant),
      providerTeamName: teams.find((team) => team.id === accessGrant.providerTeamId)?.name ?? uiText("ui.generated.c603903ef14"),
      consumerBusinessTeamName:
        business_teams.find((businessTeam) => businessTeam.id === accessGrant.consumerBusinessTeamId)?.name ?? uiText("ui.generated.c7ae513bf4d"),
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
  const findings = listFindings();

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
    findingDashboard: buildFindingDashboard({
      findings,
      taskRuns: task_runs,
      businessTeams: business_teams,
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
  blueprintId?: string | null;
  blueprintVersion?: number;
  idempotencyKey?: string | null;
  parentTaskRunId?: string | null;
  runState?: string;
  sourceType: TaskRun["sourceType"];
  sourceRef?: string | null;
  requestedBy: string;
  priority?: number;
  accessGrantId?: string | null;
  environmentId?: string | null;
  plannerMode?: string;
  summary?: string;
  inputPayload: Record<string, unknown>;
  permissionSnapshot?: Record<string, unknown>;
  agentTeamRunPlan?: Record<string, unknown>;
  executionPolicySnapshot?: Record<string, unknown>;
  environmentSnapshot?: {
    templateId?: string | null;
    environmentId?: string | null;
    payload: Record<string, unknown>;
  } | null;
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
  visibility?: TaskEvent["visibility"];
  parentEventId?: string | null;
}) {
  const eventId = randomUUID();
  const createdAt = nowIso();

  execute(
    "INSERT INTO event_logs (id, trace_id, task_run_id, node_id, seq, phase, fold_group, title, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    eventId,
    args.traceId,
    args.taskRunId,
    args.nodeId ?? null,
    getNextEventSeq(args.taskRunId),
    args.phase,
    args.foldGroup,
    args.title,
    args.content,
    JSON.stringify(args.metadata ?? {}),
    createdAt,
  );
  execute(
    "INSERT INTO task_events (id, task_run_id, agent_run_id, event_type, event_time, visibility, payload_json, raw_payload_ref, parent_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    eventId,
    args.taskRunId,
    args.nodeId ?? null,
    args.phase,
    createdAt,
    args.visibility ?? "team_only",
    JSON.stringify({
      title: args.title,
      content: args.content,
      foldGroup: args.foldGroup,
      metadata: args.metadata ?? {},
    }),
    null,
    args.parentEventId ?? null,
  );
}

function ensureTaskRunSummaryFinding(args: {
  taskRun: TaskRun;
  blueprint: TaskBlueprint | null;
}) {
  const existing = queryOne<Finding>(
    "SELECT * FROM findings WHERE task_run_id = ? AND status <> 'deleted' LIMIT 1",
    args.taskRun.id,
  );
  if (existing) return;

  const category = args.blueprint?.category ?? "execution";
  const fingerprint = buildFindingFingerprint({
    repoId: args.taskRun.sourceRef ?? args.taskRun.id,
    category,
    rule: "task-run-summary",
    normalizedCode: args.taskRun.id,
  });
  const now = nowIso();
  execute(
    "INSERT INTO findings (id, task_run_id, source_agent, category, severity, confidence, title, description, evidence_json, recommendation, skill_refs_json, fingerprint, status, publication_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    randomUUID(),
    args.taskRun.id,
    "system",
    category,
    "info",
    1,
    uiText("ui.generated.ca3a70dcdff"),
    uiText("ui.server.taskBlueprint.completedSummary", undefined, { name: args.blueprint?.name ?? uiText("ui.generated.c3172b317f9") }),
    JSON.stringify({
      taskRunId: args.taskRun.id,
      sourceType: args.taskRun.sourceType,
      sourceRef: args.taskRun.sourceRef,
    }),
    uiText("ui.generated.cf9afad7f97"),
    JSON.stringify([]),
    fingerprint,
    "open",
    JSON.stringify({ channels: [] }),
    now,
    now,
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
  const inspector =
    teamAgents.find((agent) => agent.role.toLowerCase() === "inspector") ??
    teamAgents[teamAgents.length - 1] ??
    null;

  if (!leader && !specialist && !inspector) return [];

  if (team.workflowType === "single") {
    const singleAgent = leader ?? specialist ?? inspector;
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

  const defaultLeader = leader ?? specialist ?? inspector;
  const defaultSpecialist = executor ?? specialist ?? leader ?? inspector;
  const defaultInspector = inspector ?? leader ?? specialist;
  if (!defaultLeader || !defaultSpecialist || !defaultInspector) return [];

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
      nodeKey: "finalize",
      agentId: defaultInspector.id,
      dependsOn: ["execute"],
      input: { action: "finalize", tool: "repo.write" },
    },
  ] satisfies TaskRunNodeSpec[];
}

function loadComposedExecutionPolicyForTaskRun(taskRun: TaskRun) {
  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", taskRun.teamId);
  const profiles = listExecutionPolicies();
  if (!team) return null;

  const composed = composeExecutionPolicy({
    profiles,
    tenantSpaceId: taskRun.tenantSpaceId,
    businessTeamId: taskRun.businessTeamId,
    teamId: team.id,
  });
  const taskRunToolPolicy = deriveToolPolicyFromTaskRunSnapshot(taskRun);

  if (
    taskRunToolPolicy.allowedTools.length === 0 &&
    taskRunToolPolicy.blockedTools.length === 0 &&
    taskRunToolPolicy.approvalRequiredTools.length === 0
  ) {
    return composed;
  }

  const blockedTools = dedupeStrings([
    ...composed.resolved.blockedTools,
    ...taskRunToolPolicy.blockedTools,
  ]);

  return {
    ...composed,
    resolved: {
      ...composed.resolved,
      allowedTools:
        taskRunToolPolicy.allowedTools.length > 0
          ? taskRunToolPolicy.allowedTools
          : composed.resolved.allowedTools,
      blockedTools,
      approvalRequiredTools: dedupeStrings([
        ...composed.resolved.approvalRequiredTools,
        ...taskRunToolPolicy.approvalRequiredTools,
      ]).filter((tool) => !blockedTools.includes(tool)),
    },
  };
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

function parseJsonRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function dedupeStrings(values: string[]) {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

function normalizeToolResource(resource: unknown) {
  if (typeof resource !== "string") return null;
  if (!resource.startsWith("tool.")) return null;
  return resource.slice("tool.".length);
}

function deriveToolPolicyFromTaskRunSnapshot(taskRun: TaskRun) {
  const permissionSnapshot = parseJsonRecord(taskRun.permissionSnapshotJson);
  const executionPolicySnapshot = parseJsonRecord(taskRun.executionPolicyJson);
  const executionToolPolicy =
    executionPolicySnapshot.toolPolicy &&
    typeof executionPolicySnapshot.toolPolicy === "object" &&
    !Array.isArray(executionPolicySnapshot.toolPolicy)
      ? (executionPolicySnapshot.toolPolicy as Record<string, unknown>)
      : {};
  const rules = Array.isArray(permissionSnapshot.rules) ? permissionSnapshot.rules : [];
  const allowedTools = [
    ...parseStringArray(executionPolicySnapshot.allowedTools),
    ...parseStringArray(executionToolPolicy.allowed),
    ...parseStringArray(executionPolicySnapshot.tools),
  ];
  const blockedTools = [
    ...parseStringArray(executionPolicySnapshot.blockedTools),
    ...parseStringArray(executionToolPolicy.blocked),
  ];
  const approvalRequiredTools = [
    ...parseStringArray(executionPolicySnapshot.approvalRequiredTools),
    ...parseStringArray(executionToolPolicy.approvalRequired),
  ];

  for (const rule of rules) {
    if (!rule || typeof rule !== "object") continue;
    const typedRule = rule as { effect?: unknown; resource?: unknown };
    const toolName = normalizeToolResource(typedRule.resource);
    if (!toolName) continue;
    if (typedRule.effect === "allow") allowedTools.push(toolName);
    if (typedRule.effect === "deny") blockedTools.push(toolName);
    if (typedRule.effect === "ask") approvalRequiredTools.push(toolName);
  }

  return {
    allowedTools: dedupeStrings(allowedTools),
    blockedTools: dedupeStrings(blockedTools),
    approvalRequiredTools: dedupeStrings(approvalRequiredTools),
  };
}

export function submitTaskRun(input: SubmitTaskRunInput) {
  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", input.teamId);
  if (!team) {
    throw new Error(uiText("ui.generated.c7f1a712e10"));
  }

  if (input.blueprintId && input.idempotencyKey) {
    const existing = queryOne<TaskRun>(
      "SELECT * FROM task_runs WHERE blueprint_id = ? AND idempotency_key = ?",
      input.blueprintId,
      input.idempotencyKey,
    );
    if (existing) return getTaskRunDetail(existing.id);
  }

  const businessTeam = queryOne<BusinessTeam>("SELECT * FROM business_teams WHERE id = ?", team.businessTeamId);
  if (!businessTeam) {
    throw new Error(uiText("ui.generated.c5720b81904"));
  }

  const tenantSpace = queryOne<TenantSpace>("SELECT * FROM tenant_spaces WHERE id = ?", businessTeam.tenantSpaceId);
  if (!tenantSpace) {
    throw new Error(uiText("ui.generated.c56f9b31da8"));
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
  const environmentSnapshot = input.environmentSnapshot
    ? {
        ...input.environmentSnapshot,
        payload: {
          ...input.environmentSnapshot.payload,
          taskRunId,
          workspace:
            typeof input.environmentSnapshot.payload.workspace === "object" &&
            input.environmentSnapshot.payload.workspace !== null
              ? {
                  ...(input.environmentSnapshot.payload.workspace as Record<string, unknown>),
                  id: `workspace:${taskRunId}`,
                }
              : { id: `workspace:${taskRunId}` },
        },
      }
    : null;

  execute(
    "INSERT INTO task_runs (id, tenant_space_id, business_team_id, team_id, blueprint_id, blueprint_version, idempotency_key, parent_task_run_id, run_state, environment_snapshot_id, permission_snapshot_json, agent_team_run_plan_json, execution_policy_json, access_grant_id, source_type, source_ref, status, priority, input_payload_json, output_payload_json, cost_estimate, cost_actual, trace_id, requested_by, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    taskRunId,
    tenantSpace.id,
    businessTeam.id,
    team.id,
    input.blueprintId ?? null,
    input.blueprintVersion ?? 0,
    input.idempotencyKey ?? null,
    input.parentTaskRunId ?? null,
    input.runState ?? "running",
    environmentSnapshot ? `${taskRunId}:environment` : null,
    JSON.stringify(input.permissionSnapshot ?? {}),
    JSON.stringify(input.agentTeamRunPlan ?? {}),
    JSON.stringify(input.executionPolicySnapshot ?? {}),
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

  if (environmentSnapshot) {
    execute(
      "INSERT INTO environment_snapshots (id, task_run_id, template_id, environment_id, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      `${taskRunId}:environment`,
      taskRunId,
      environmentSnapshot.templateId ?? null,
      environmentSnapshot.environmentId ?? null,
      JSON.stringify(environmentSnapshot.payload),
      createdAt,
    );
  }

  execute(
    "INSERT INTO task_run_plans (id, task_run_id, planner_mode, dag_json, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    planId,
    taskRunId,
    input.plannerMode ?? (team.workflowType === "dag" ? "leader_agent" : "rule"),
    JSON.stringify({ nodes: dagNodes, edges: dagEdges }),
    input.summary ?? uiText("ui.generated.cd9716b4169"),
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
    title: uiText("ui.generated.c7bdaa28ba6"),
    content: uiText("ui.server.taskBlueprint.queued", undefined, { teamName: team.name }),
    metadata: {
      blueprintId: input.blueprintId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      workflowType: team.workflowType,
      plannerMode: input.plannerMode ?? "rule",
      nodeCount: nodeSpecs.length,
    },
  });

  const knowledgeContext = environmentSnapshot?.payload
    ? (environmentSnapshot.payload as Record<string, unknown>).knowledgeContext
    : null;
  if (knowledgeContext) {
    const context = knowledgeContext as {
      loadRefs?: unknown[];
      archiveRefs?: unknown[];
      spaces?: unknown[];
    };
    appendTaskRunEvent({
      traceId,
      taskRunId,
      phase: "memory.context_resolved",
      foldGroup: "Planning",
      title: uiText("ui.generated.c01e20b4b22"),
      content: uiText("ui.generated.c331d71dd1b"),
      metadata: {
        loadRefCount: Array.isArray(context.loadRefs) ? context.loadRefs.length : 0,
        archiveRefCount: Array.isArray(context.archiveRefs) ? context.archiveRefs.length : 0,
        spaceCount: Array.isArray(context.spaces) ? context.spaces.length : 0,
      },
    });
  }

  return getTaskRunDetail(taskRunId);
}

export function submitTaskRunFromBlueprint(args: {
  blueprintId: string;
  requestedBy?: string;
  inputPayload?: Record<string, unknown>;
  sourceRef?: string | null;
  priority?: number;
  parentTaskRunId?: string | null;
}) {
  const blueprint = queryOne<TaskBlueprint>("SELECT * FROM task_blueprints WHERE id = ?", args.blueprintId);
  if (!blueprint) throw new Error(uiText("ui.generated.cd492e543a6"));
  if (blueprint.status !== "active") throw new Error(uiText("ui.generated.ce030c4c173"));

  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", blueprint.teamId);
  if (!team) throw new Error(uiText("ui.generated.ccd11f4dbde"));

  const agents = listAgents().filter((agent) => agent.teamId === team.id);
  const environment = blueprint.environmentId
    ? queryOne<ExecutionEnvironment>("SELECT * FROM execution_environments WHERE id = ?", blueprint.environmentId)
    : null;
  const trigger = parseJsonRecord(blueprint.triggerJson);
  const executionPolicy = parseJsonRecord(blueprint.executionPolicyJson);
  const inputPayload = {
    taskCategory: blueprint.category,
    taskBlueprintId: blueprint.id,
    run_date: new Date().toISOString().slice(0, 10),
	    branch: environment?.defaultBranch ?? "",
    ...args.inputPayload,
  };
  const idempotencyTemplate =
    typeof trigger.idempotencyKey === "string"
      ? trigger.idempotencyKey
      : typeof executionPolicy.idempotencyKey === "string"
        ? executionPolicy.idempotencyKey
        : "${task_blueprint_id}:${run_date}";
  const idempotencyKey = renderTemplateValue(idempotencyTemplate, {
    task_blueprint_id: blueprint.id,
    ...inputPayload,
  });
  const sourceType = normalizeTriggerType(trigger.type) as TaskRun["sourceType"];
  const baseEnvironmentSnapshotPayload = buildEnvironmentSnapshotPayload({
    taskRunId: "pending",
    blueprint,
    environment,
    inputPayload,
  });
  const knowledgeContext = resolveTaskKnowledgeContext({
    blueprint,
    team,
    environment,
    inputPayload,
  });
  const environmentSnapshotPayload = {
    ...baseEnvironmentSnapshotPayload,
    knowledgeContext,
  };
  const nodeSpecs = buildNodeSpecsFromRunPlan(blueprint.agentTeamRunPlanJson, agents);

  return submitTaskRun({
    teamId: blueprint.teamId,
    blueprintId: blueprint.id,
    blueprintVersion: blueprint.version,
    idempotencyKey,
    parentTaskRunId: args.parentTaskRunId ?? null,
    sourceType,
    sourceRef:
      args.sourceRef ??
      (sourceType === "webhook"
        ? String(trigger.event ?? trigger.webhookPathKey ?? "webhook")
        : String(trigger.expression ?? "manual")),
    requestedBy: args.requestedBy ?? "blueprint-console",
    priority: args.priority ?? 80,
    environmentId: blueprint.environmentId,
    plannerMode: parseJsonRecord(blueprint.agentTeamRunPlanJson).strategy === "leader_worker_parallel"
      ? "leader_agent"
      : "rule",
    summary: uiText("ui.server.taskBlueprint.runCreated", undefined, { name: blueprint.name }),
    inputPayload,
    permissionSnapshot: buildEffectivePermissionPreview(blueprint.permissionPolicyJson),
    agentTeamRunPlan: parseJsonRecord(blueprint.agentTeamRunPlanJson),
    executionPolicySnapshot: executionPolicy,
    environmentSnapshot: {
      templateId:
        typeof parseJsonRecord(blueprint.environmentSelectorJson).templateId === "string"
          ? String(parseJsonRecord(blueprint.environmentSelectorJson).templateId)
          : null,
      environmentId: blueprint.environmentId,
      payload: environmentSnapshotPayload,
    },
    nodes: nodeSpecs,
  });
}

function matchCronPart(part: string, value: number) {
  if (part === "*") return true;
  if (part.startsWith("*/")) {
    const interval = Number(part.slice(2));
    return Number.isInteger(interval) && interval > 0 && value % interval === 0;
  }
  return part
    .split(",")
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item))
    .includes(value);
}

function isCronBlueprintDue(expression: unknown, now = new Date()) {
  if (typeof expression !== "string" || !expression.trim()) return false;
  const [minutePart, hourPart, dayOfMonthPart, monthPart, dayOfWeekPart] = expression.trim().split(/\s+/);
  if (!minutePart || !hourPart || !dayOfMonthPart || !monthPart || !dayOfWeekPart) return false;
  return (
    matchCronPart(minutePart, now.getMinutes()) &&
    matchCronPart(hourPart, now.getHours()) &&
    matchCronPart(dayOfMonthPart, now.getDate()) &&
    matchCronPart(monthPart, now.getMonth() + 1) &&
    matchCronPart(dayOfWeekPart, now.getDay())
  );
}

export function submitDueTaskBlueprintSchedules(args: {
  now?: string;
  requestedBy?: string;
  inputPayload?: Record<string, unknown>;
} = {}) {
  const now = args.now ? new Date(args.now) : new Date();
  const results = listTaskBlueprints()
    .filter((blueprint) => blueprint.status === "active")
    .filter((blueprint) => {
      const trigger = parseJsonRecord(blueprint.triggerJson);
      return normalizeTriggerType(trigger.type) === "schedule" && isCronBlueprintDue(trigger.expression, now);
    })
    .map((blueprint) => {
      try {
        const detail = submitTaskRunFromBlueprint({
          blueprintId: blueprint.id,
          requestedBy: args.requestedBy ?? "scheduler",
          sourceRef: `cron:${now.toISOString().slice(0, 16)}`,
          priority: 72,
          inputPayload: {
            scheduler_now: now.toISOString(),
            ...args.inputPayload,
          },
        });
        return {
          ok: true,
          blueprintId: blueprint.id,
          taskRunId: detail?.taskRun.id ?? null,
          status: detail?.taskRun.status ?? "created",
        };
      } catch (error) {
        return {
          ok: false,
          blueprintId: blueprint.id,
          error: error instanceof Error ? error.message : "submit failed",
        };
      }
    });

  return {
    ok: results.every((result) => result.ok),
    now: now.toISOString(),
    submittedCount: results.filter((result) => result.ok).length,
    results,
  };
}

export async function executeTaskRunTick(taskRunId: string, requestedBy = "system") {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", taskRunId);
  if (!taskRun) throw new Error(uiText("ui.generated.c7faa8038d2"));

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
        content: uiText("ui.server.taskBlueprint.nodeRunnable", undefined, { nodeKey: node.nodeKey }),
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
    content: uiText("ui.server.taskBlueprint.nodeStarted", undefined, { nodeKey: runnable.nodeKey, requestedBy }),
  });

  const nodeInput = JSON.parse(runnable.inputJson) as {
    action?: string;
    tool?: string;
    assignment?: string;
    blockId?: string;
    blockType?: string;
    title?: string;
    targetAgentTeamId?: string;
    script?: string;
    url?: string;
    method?: string;
    connectorType?: string;
    publisherRef?: string;
    payloadTemplate?: string;
  };
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
      title: uiText("ui.generated.c2c74fb9c92"),
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
        reason: uiText("ui.generated.ca3d5b693a4"),
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
      title: uiText("ui.generated.c5e3c3be6fd"),
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

  if (tool === "memory.retrieve") {
    appendTaskRunEvent({
      traceId: taskRun.traceId,
      taskRunId: taskRun.id,
      nodeId: runnable.id,
      phase: "memory.read_requested",
      foldGroup: "Analysis",
      title: uiText("ui.generated.c7a9ef07556"),
      content: uiText("ui.generated.c38216bfaf2"),
    });
    const retrieval = await buildTaskRunKnowledgeRetrieval(taskRun);
    appendTaskRunEvent({
      traceId: taskRun.traceId,
      taskRunId: taskRun.id,
      nodeId: runnable.id,
      phase: retrieval.degraded ? "memory.degraded" : "memory.read_completed",
      foldGroup: "Analysis",
      title: retrieval.degraded ? uiText("ui.generated.c1691f223ab") : uiText("ui.generated.c0c29d5358e"),
      content: retrieval.degraded
        ? uiText("ui.generated.cb78ff98a2e")
        : uiText("ui.generated.c00fe24f8ff"),
      metadata: retrieval,
    });
  }

  const blockType = typeof nodeInput.blockType === "string" ? nodeInput.blockType : "";
  if (blockType === "agent_team") {
    appendTaskRunEvent({
      traceId: taskRun.traceId,
      taskRunId: taskRun.id,
      nodeId: runnable.id,
      phase: "agent_team_delegated",
      foldGroup: "Execution",
      title: uiText("ui.generated.c13242c2e9b"),
      content: uiText("ui.server.taskBlueprint.delegated", undefined, { nodeKey: runnable.nodeKey, teamId: nodeInput.targetAgentTeamId ?? uiText("ui.generated.cec90934f29") }),
      metadata: {
        targetAgentTeamId: nodeInput.targetAgentTeamId ?? null,
        assignment: nodeInput.assignment ?? null,
      },
    });
  }
  if (blockType === "script_hook") {
    appendTaskRunEvent({
      traceId: taskRun.traceId,
      taskRunId: taskRun.id,
      nodeId: runnable.id,
      phase: "command_executed",
      foldGroup: "Execution",
      title: uiText("ui.generated.c9d282026d5"),
      content: nodeInput.script ? uiText("ui.server.taskBlueprint.scriptCommand", undefined, { script: nodeInput.script }) : uiText("ui.generated.c38e659ee98"),
      metadata: {
        script: nodeInput.script ?? null,
        assignment: nodeInput.assignment ?? null,
      },
    });
  }
  if (blockType === "http_hook") {
    appendTaskRunEvent({
      traceId: taskRun.traceId,
      taskRunId: taskRun.id,
      nodeId: runnable.id,
      phase: "tool_call_finished",
      foldGroup: "Execution",
      title: uiText("ui.generated.c95d6117b03"),
      content: `${nodeInput.method ?? "POST"} ${nodeInput.url ?? uiText("ui.generated.c16a4d146d9")}`,
      metadata: {
        url: nodeInput.url ?? null,
        method: nodeInput.method ?? "POST",
        payloadTemplate: nodeInput.payloadTemplate ?? null,
      },
    });
  }
  if (blockType === "notification") {
    appendTaskRunEvent({
      traceId: taskRun.traceId,
      taskRunId: taskRun.id,
      nodeId: runnable.id,
      phase: "output_published",
      foldGroup: "Synthesis",
      title: uiText("ui.generated.c175cf061a6"),
      content: uiText("ui.server.taskBlueprint.notification", undefined, { connectorType: nodeInput.connectorType ?? uiText("ui.generated.c8c577dc72c"), publisherRef: nodeInput.publisherRef ?? uiText("ui.generated.ce83fc9345d") }),
      metadata: {
        connectorType: nodeInput.connectorType ?? null,
        publisherRef: nodeInput.publisherRef ?? null,
        payloadTemplate: nodeInput.payloadTemplate ?? null,
      },
    });
  }

  if (timeoutReached) {
    const failureClass = classifyFailure({
      reason: uiText("ui.generated.ca015a1489e"),
      timeout: true,
    });
    execute(
      "UPDATE task_run_nodes SET status = ?, output_json = ?, completed_at = ? WHERE id = ?",
      "failed",
      JSON.stringify({ failureClass, reason: uiText("ui.generated.ca015a1489e") }),
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
      content: uiText("ui.server.taskBlueprint.nodeTimeout", undefined, { nodeKey: runnable.nodeKey }),
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
    content: uiText("ui.server.taskBlueprint.nodeCompleted", undefined, { nodeKey: runnable.nodeKey, tool }),
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

  if (taskRunStatus === "completed") {
    const completedTaskRun =
      queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", taskRun.id) ?? taskRun;
    const blueprint = completedTaskRun.blueprintId
      ? queryOne<TaskBlueprint>(
          "SELECT * FROM task_blueprints WHERE id = ?",
          completedTaskRun.blueprintId,
        )
      : null;
    ensureTaskRunSummaryFinding({ taskRun: completedTaskRun, blueprint });
    const findings = queryAll<Finding>(
      "SELECT * FROM findings WHERE task_run_id = ? AND status <> 'deleted' ORDER BY created_at DESC",
      completedTaskRun.id,
    );
    const environmentSnapshot = completedTaskRun.environmentSnapshotId
      ? queryOne<EnvironmentSnapshot>(
          "SELECT * FROM environment_snapshots WHERE id = ?",
          completedTaskRun.environmentSnapshotId,
        )
      : null;
    appendTaskRunEvent({
      traceId: completedTaskRun.traceId,
      taskRunId: completedTaskRun.id,
      phase: "publishing_output",
      foldGroup: "Synthesis",
      title: uiText("ui.generated.c65a48b8c9d"),
      content: uiText("ui.generated.c155c71306b"),
      metadata: { blueprintId: blueprint?.id ?? null, findingCount: findings.length },
    });

    const publicationResults = await publishTaskRunOutputs({
      taskRun: completedTaskRun,
      blueprint,
      findings,
      environmentSnapshot,
    });
    const publishedChannels = publicationResults
      .filter((result) => result.status === "published" || result.status === "drafted")
      .map((result) => result.publisherType);
    for (const finding of findings) {
      execute(
        "UPDATE findings SET status = ?, publication_json = ?, updated_at = ? WHERE id = ?",
        publishedChannels.length > 0 ? "published" : finding.status,
        JSON.stringify({
          channels: publishedChannels,
          results: publicationResults,
        }),
        nowIso(),
        finding.id,
      );
    }
    execute(
      "UPDATE task_runs SET output_payload_json = ? WHERE id = ?",
      JSON.stringify({
        publicationResults,
        findingCount: findings.length,
      }),
      completedTaskRun.id,
    );
    for (const result of publicationResults) {
      appendTaskRunEvent({
        traceId: completedTaskRun.traceId,
        taskRunId: completedTaskRun.id,
        phase: result.status === "failed" ? "output_publish_failed" : "output_published",
        foldGroup: "Synthesis",
        title: `${result.publisherType} ${result.status}`,
        content: result.message,
        metadata: {
          pluginId: result.pluginId,
          payload: result.payload,
        },
      });
    }
  }

  return getTaskRunDetail(taskRunId);
}

export function retryTaskRunNode(args: { taskRunId: string; nodeId: string; requestedBy: string }) {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", args.taskRunId);
  const node = queryOne<TaskRunNode>("SELECT * FROM task_run_nodes WHERE id = ? AND task_run_id = ?", args.nodeId, args.taskRunId);
  if (!taskRun || !node) {
    throw new Error(uiText("ui.generated.c58c3165c3a"));
  }

  if (node.attemptCount >= node.maxAttempts) {
    throw new Error(uiText("ui.generated.c2e27e37410"));
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
    content: uiText("ui.server.taskBlueprint.retry", undefined, { requestedBy: args.requestedBy, nodeKey: node.nodeKey }),
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
  if (!intervention) throw new Error(uiText("ui.generated.cbd5c41d72b"));

  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", intervention.taskRunId);
  if (!taskRun) throw new Error(uiText("ui.generated.c7faa8038d2"));

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
    content: uiText("ui.server.taskBlueprint.interventionResolved", undefined, { resolvedBy: args.resolvedBy, interventionId: intervention.id, decision: args.decision }),
    metadata: { resolutionNote: args.resolutionNote ?? null },
  });

  return getTaskRunDetail(taskRun.id);
}

export function resumeTaskRun(taskRunId: string, requestedBy: string) {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", taskRunId);
  if (!taskRun) throw new Error(uiText("ui.generated.c7faa8038d2"));

  execute("UPDATE task_run_nodes SET status = ? WHERE task_run_id = ? AND status = ?", "ready", taskRunId, "awaiting");
  execute("UPDATE task_runs SET status = ? WHERE id = ?", "running", taskRunId);

  appendTaskRunEvent({
    traceId: taskRun.traceId,
    taskRunId,
    phase: "approval_result",
    foldGroup: "Human Actions",
    title: uiText("ui.generated.c5b1e85dd38"),
    content: uiText("ui.server.taskBlueprint.resumed", undefined, { requestedBy }),
  });

  return getTaskRunDetail(taskRunId);
}

export function getTaskRunExecutionBoard(taskRunId: string) {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", taskRunId);
  if (!taskRun) return null;
  const nodes = getTaskRunNodes(taskRunId);

  const dependencyStatus = nodes.map((node) => {
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
    dependencyStatus,
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
  const bindings = listProviderRuntimeBindings().filter((binding) => binding.baseUrl);
  const providers = listProviders();
  const agents = listAgents();
  const discoveries = await discoverConfiguredRuntimes({
    bindings,
    providers,
    agents,
  });

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
      continue;
    }

    const binding = bindings.find((item) => item.baseUrl === discovery.baseUrl);
    if (!binding) continue;

    execute(
      "INSERT INTO runtime_endpoints (id, tenant_space_id, business_team_id, name, base_url, runtime_kind, health_status, agent_catalog_json, provider_catalog_json, concurrency_limit, active_run_count, last_discovered_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      randomUUID(),
      binding.tenantSpaceId,
      binding.businessTeamId,
      binding.name,
      binding.baseUrl,
      binding.runtimeKind,
      discovery.status,
      JSON.stringify(discovery.agents),
      JSON.stringify(discovery.providers),
      1,
      0,
      new Date().toISOString(),
      new Date().toISOString(),
    );
  }

  return discoveries;
}
