import { randomUUID } from "node:crypto";
import {
  execute,
  queryAll,
  queryOne,
  type AgentTeam,
  type ImportedPluginManifest,
  type BusinessTeam,
  type ScheduleTemplate,
  type TaskTemplate,
} from "@/server/db";
import {
  getPluginSecurityModel,
  listBuiltinPluginManifests,
  listPluginExtensionPoints,
  type PluginCapability,
  type PluginLifecycle,
  type PluginManifest,
} from "@/server/plugin-core";
import { listOfficialPluginManifests } from "@/server/plugin-sdk-core";
import { uiText } from "@/lib/language-pack";

type ExtensionEnvironmentInput = {
  id: string;
  businessTeamSlug?: string;
  businessTeamId?: string;
  name: string;
  repositoryProvider: string;
  repositoryName: string;
  repositoryUrl: string;
  defaultBranch: string;
  executorRef: string;
  privateKeyRef: string;
  workingDirectory: string;
  sandboxProfile?: Record<string, unknown>;
  memoryLayerRefs?: string[];
  visibility?: string;
  status?: string;
};

type ExtensionScheduleTemplateInput = {
  id: string;
  businessTeamSlug?: string;
  businessTeamId?: string;
  teamSlug?: string;
  teamId?: string;
  name: string;
  scheduleKind: string;
  cadence: string;
  nextRunAt?: string | null;
  inputPayload?: Record<string, unknown>;
  isEnabled?: boolean;
};

type ExtensionTaskTemplateInput = {
  id: string;
  teamSlug?: string;
  teamId?: string;
  name: string;
  caseKey: string;
  pluginId?: string | null;
  environmentId?: string | null;
  plannerMode?: string;
  summary: string;
  inputSchema?: Record<string, unknown>;
  defaultInput?: Record<string, unknown>;
  memoryLayers?: string[];
  outputTargets?: string[];
  nodes?: Array<Record<string, unknown>>;
  webhookParserRef?: string | null;
  visibility?: string;
};

type ExtensionTaskBlueprintInput = {
  id: string;
  name: string;
  category: string;
  visibility?: string;
  ownerBusinessTeamSlug?: string;
  ownerBusinessTeamId?: string;
  teamSlug?: string;
  teamId?: string;
  environmentId?: string | null;
  providerAdapterId?: string;
  version?: number;
  status?: string;
  trigger: Record<string, unknown>;
  inputSchema: Record<string, unknown>;
  environmentSelector: Record<string, unknown>;
  agentTeamRunPlan: Record<string, unknown>;
  memoryPolicy: Record<string, unknown>;
  providerPolicy?: Record<string, unknown>;
  permissionPolicy: Record<string, unknown>;
  resultSchema?: Record<string, unknown>;
  outputPolicy: Record<string, unknown>;
  dashboardPolicy?: Record<string, unknown>;
  executionPolicy: Record<string, unknown>;
  archivePolicy?: Record<string, unknown>;
};

type ExtensionWebhookInput = {
  id?: string;
  businessTeamSlug?: string;
  businessTeamId?: string;
  teamSlug?: string;
  teamId?: string;
  name: string;
  pathKey: string;
  method?: string;
  requestSchema?: Record<string, unknown>;
  secretHint?: string;
  isEnabled?: boolean;
};

export type AgentWorldExtensionBundle = {
  id?: string;
  name?: string;
  source?: string;
  plugins?: PluginManifest[];
  environments?: ExtensionEnvironmentInput[];
  webhooks?: ExtensionWebhookInput[];
  taskTemplates?: ExtensionTaskTemplateInput[];
  taskBlueprints?: ExtensionTaskBlueprintInput[];
  scheduleTemplates?: ExtensionScheduleTemplateInput[];
};

function nowIso() {
  return new Date().toISOString();
}

function parseArray(value: string) {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function toManifest(row: ImportedPluginManifest): PluginManifest {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    capability: row.capability as PluginCapability,
    lifecycle: row.lifecycle as PluginLifecycle,
    mountPoint: row.mountPoint,
    configSchema: row.configSchema,
    requiredSecretRefs: parseArray(row.requiredSecretRefsJson),
    permissions: parseArray(row.permissionsJson),
    healthCheck: row.healthCheck,
    extensionOnly: Boolean(row.extensionOnly) as true,
  };
}

function resolveBusinessTeamId(input: { businessTeamId?: string; businessTeamSlug?: string }) {
  if (input.businessTeamId) return input.businessTeamId;
  if (!input.businessTeamSlug) throw new Error("businessTeamId or businessTeamSlug is required");
  const businessTeam = queryOne<BusinessTeam>("SELECT * FROM business_teams WHERE slug = ?", input.businessTeamSlug);
  if (!businessTeam) throw new Error(`businessTeam not found: ${input.businessTeamSlug}`);
  return businessTeam.id;
}

function resolveTeamId(input: { teamId?: string; teamSlug?: string }) {
  if (input.teamId) return input.teamId;
  if (!input.teamSlug) throw new Error("teamId or teamSlug is required");
  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE slug = ?", input.teamSlug);
  if (!team) throw new Error(`agent team not found: ${input.teamSlug}`);
  return team.id;
}

function validatePlugin(plugin: PluginManifest) {
  if (!plugin.extensionOnly) {
    throw new Error(`plugin ${plugin.id} must be extensionOnly`);
  }
  if (!plugin.id || !plugin.name || !plugin.capability || !plugin.mountPoint) {
    throw new Error("plugin manifest requires id, name, capability and mountPoint");
  }
}

export function listImportedPluginManifests() {
  return queryAll<ImportedPluginManifest>(
    "SELECT * FROM plugin_manifests ORDER BY source ASC, name ASC",
  ).map(toManifest);
}

export function listAllPluginManifests() {
  const imported = listImportedPluginManifests();
  const importedIds = new Set(imported.map((plugin) => plugin.id));
  return [
    ...listBuiltinPluginManifests().filter((plugin) => !importedIds.has(plugin.id)),
    ...listOfficialPluginManifests().filter((plugin) => !importedIds.has(plugin.id)),
    ...imported,
  ];
}

export function getExtensionRegistrySnapshot() {
  return {
    manifests: listAllPluginManifests(),
    extensionPoints: listPluginExtensionPoints(),
    securityModel: getPluginSecurityModel(),
  };
}

export function importExtensionBundle(bundle: AgentWorldExtensionBundle) {
  const source = bundle.source ?? bundle.id ?? bundle.name ?? "manual-import";
  const createdAt = nowIso();
  const importedPlugins: string[] = [];
  const importedEnvironments: string[] = [];
  const importedWebhooks: string[] = [];
  const importedTaskTemplates: string[] = [];
  const importedTaskBlueprints: string[] = [];
  const importedScheduleTemplates: string[] = [];

  for (const plugin of bundle.plugins ?? []) {
    validatePlugin(plugin);
    execute(
      "INSERT OR REPLACE INTO plugin_manifests (id, name, version, capability, lifecycle, mount_point, config_schema, required_secret_refs_json, permissions_json, health_check, extension_only, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      plugin.id,
      plugin.name,
      plugin.version,
      plugin.capability,
      plugin.lifecycle,
      plugin.mountPoint,
      plugin.configSchema,
      JSON.stringify(plugin.requiredSecretRefs),
      JSON.stringify(plugin.permissions),
      plugin.healthCheck,
      plugin.extensionOnly ? 1 : 0,
      source,
      createdAt,
    );
    importedPlugins.push(plugin.id);
  }

  for (const environment of bundle.environments ?? []) {
    const businessTeamId = resolveBusinessTeamId(environment);
    execute(
      "INSERT OR REPLACE INTO execution_environments (id, business_team_id, name, repository_provider, repository_name, repository_url, default_branch, executor_ref, private_key_ref, working_directory, sandbox_profile_json, memory_layer_refs_json, visibility, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      environment.id,
      businessTeamId,
      environment.name,
      environment.repositoryProvider,
      environment.repositoryName,
      environment.repositoryUrl,
      environment.defaultBranch,
      environment.executorRef,
      environment.privateKeyRef,
      environment.workingDirectory,
      JSON.stringify(environment.sandboxProfile ?? {}),
      JSON.stringify(environment.memoryLayerRefs ?? []),
      environment.visibility ?? "team",
      environment.status ?? "active",
      createdAt,
    );
    importedEnvironments.push(environment.id);
  }

  for (const webhook of bundle.webhooks ?? []) {
    const businessTeamId = resolveBusinessTeamId(webhook);
    const teamId = resolveTeamId(webhook);
    const webhookId = webhook.id ?? `webhook:${webhook.pathKey}`;
    execute(
      "INSERT OR REPLACE INTO webhook_endpoints (id, business_team_id, team_id, name, path_key, method, request_schema_json, secret_hint, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      webhookId,
      businessTeamId,
      teamId,
      webhook.name,
      webhook.pathKey,
      webhook.method ?? "POST",
      JSON.stringify(webhook.requestSchema ?? {}),
      webhook.secretHint ?? "",
      webhook.isEnabled === false ? 0 : 1,
    );
    importedWebhooks.push(webhookId);
  }

  for (const taskTemplate of bundle.taskTemplates ?? []) {
    const teamId = resolveTeamId(taskTemplate);
    execute(
      "INSERT OR REPLACE INTO task_templates (id, name, case_key, plugin_id, team_id, environment_id, planner_mode, summary, input_schema_json, default_input_json, memory_layers_json, output_targets_json, nodes_json, webhook_parser_ref, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      taskTemplate.id,
      taskTemplate.name,
      taskTemplate.caseKey,
      taskTemplate.pluginId ?? null,
      teamId,
      taskTemplate.environmentId ?? null,
      taskTemplate.plannerMode ?? "rule",
      taskTemplate.summary,
      JSON.stringify(taskTemplate.inputSchema ?? {}),
      JSON.stringify(taskTemplate.defaultInput ?? {}),
      JSON.stringify(taskTemplate.memoryLayers ?? []),
      JSON.stringify(taskTemplate.outputTargets ?? []),
      JSON.stringify(taskTemplate.nodes ?? []),
      taskTemplate.webhookParserRef ?? null,
      taskTemplate.visibility ?? "team",
      createdAt,
    );
    importedTaskTemplates.push(taskTemplate.id);
  }

  for (const blueprint of bundle.taskBlueprints ?? []) {
    const ownerBusinessTeamId = resolveBusinessTeamId({
      businessTeamId: blueprint.ownerBusinessTeamId,
      businessTeamSlug: blueprint.ownerBusinessTeamSlug,
    });
    const teamId = resolveTeamId(blueprint);
    execute(
      "INSERT OR REPLACE INTO task_blueprints (id, name, category, visibility, owner_business_team_id, team_id, environment_id, provider_adapter_id, version, status, trigger_json, input_schema_json, environment_selector_json, agent_team_run_plan_json, memory_policy_json, provider_policy_json, permission_policy_json, result_schema_json, output_policy_json, dashboard_policy_json, execution_policy_json, archive_policy_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      blueprint.id,
      blueprint.name,
      blueprint.category,
      blueprint.visibility ?? "team",
      ownerBusinessTeamId,
      teamId,
      blueprint.environmentId ?? null,
      blueprint.providerAdapterId ?? "agentworld-runtime-adapter",
      blueprint.version ?? 1,
      blueprint.status ?? "active",
      JSON.stringify(blueprint.trigger),
      JSON.stringify(blueprint.inputSchema),
      JSON.stringify(blueprint.environmentSelector),
      JSON.stringify(blueprint.agentTeamRunPlan),
      JSON.stringify(blueprint.memoryPolicy),
      JSON.stringify(blueprint.providerPolicy ?? {}),
      JSON.stringify(blueprint.permissionPolicy),
      JSON.stringify(blueprint.resultSchema ?? {}),
      JSON.stringify(blueprint.outputPolicy),
      JSON.stringify(blueprint.dashboardPolicy ?? {}),
      JSON.stringify(blueprint.executionPolicy),
      JSON.stringify(blueprint.archivePolicy ?? { keepDays: 365 }),
      createdAt,
      createdAt,
    );
    importedTaskBlueprints.push(blueprint.id);

    if (
      blueprint.trigger.type === "webhook" &&
      typeof blueprint.trigger.webhookPathKey === "string" &&
      !importedWebhooks.includes(`webhook:${blueprint.trigger.webhookPathKey}`)
    ) {
      const webhookId = `webhook:${blueprint.trigger.webhookPathKey}`;
      execute(
        "INSERT OR REPLACE INTO webhook_endpoints (id, business_team_id, team_id, name, path_key, method, request_schema_json, secret_hint, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        webhookId,
        ownerBusinessTeamId,
        teamId,
        `${blueprint.name} Webhook`,
        blueprint.trigger.webhookPathKey,
        "POST",
        JSON.stringify(blueprint.inputSchema ?? {}),
        typeof blueprint.trigger.webhookSecretRef === "string" ? blueprint.trigger.webhookSecretRef : "",
        1,
      );
      importedWebhooks.push(webhookId);
    }
  }

  for (const template of bundle.scheduleTemplates ?? []) {
    const businessTeamId = resolveBusinessTeamId(template);
    const teamId = resolveTeamId(template);
    execute(
      "INSERT OR REPLACE INTO schedule_templates (id, business_team_id, team_id, name, schedule_kind, cadence, next_run_at, input_payload_json, is_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      template.id,
      businessTeamId,
      teamId,
      template.name,
      template.scheduleKind,
      template.cadence,
      template.nextRunAt ?? null,
      JSON.stringify(template.inputPayload ?? {}),
      template.isEnabled === false ? 0 : 1,
      createdAt,
    );
    importedScheduleTemplates.push(template.id);
  }

  return {
    source,
    importedPlugins,
    importedEnvironments,
    importedWebhooks,
    importedTaskTemplates,
    importedTaskBlueprints,
    importedScheduleTemplates,
  };
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

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getWebhookScheduleTemplate(teamId: string, pathKey?: string) {
  const templates = queryAll<ScheduleTemplate>(
    "SELECT * FROM schedule_templates WHERE team_id = ? AND schedule_kind = ? AND is_enabled = 1 ORDER BY created_at DESC",
    teamId,
    "event",
  );

  if (!pathKey) return templates[0] ?? null;

  return (
    templates.find((template) => {
      const input = parseJsonRecord(template.inputPayloadJson);
      return input.webhookPathKey === pathKey || input.pathKey === pathKey;
    }) ??
    templates.find((template) => {
      const input = parseJsonRecord(template.inputPayloadJson);
      return !input.webhookPathKey && !input.pathKey;
    }) ??
    templates[0] ??
    null
  );
}

export function resolveWebhookTaskConfiguration(teamId: string, pathKey?: string) {
  const schedule = getWebhookScheduleTemplate(teamId, pathKey);
  const scheduleInput = schedule ? parseJsonRecord(schedule.inputPayloadJson) : {};
  const taskTemplateId =
    typeof scheduleInput.taskTemplateId === "string" ? scheduleInput.taskTemplateId : null;
  const taskTemplate = taskTemplateId
    ? queryOne<TaskTemplate>("SELECT * FROM task_templates WHERE id = ?", taskTemplateId)
    : typeof scheduleInput.caseKey === "string"
      ? queryOne<TaskTemplate>(
          "SELECT * FROM task_templates WHERE team_id = ? AND case_key = ? ORDER BY created_at DESC LIMIT 1",
          teamId,
          scheduleInput.caseKey,
        )
      : null;
  const defaultInput = taskTemplate ? parseJsonRecord(taskTemplate.defaultInputJson) : {};

  return {
    schedule,
    taskTemplate,
    caseKey:
      taskTemplate?.caseKey ??
      (typeof scheduleInput.caseKey === "string" ? scheduleInput.caseKey : "generic"),
    taskCategory:
      (typeof defaultInput.taskCategory === "string" ? defaultInput.taskCategory : null) ??
      (typeof scheduleInput.taskCategory === "string" ? scheduleInput.taskCategory : "webhook"),
    environmentId:
      taskTemplate?.environmentId ??
      (typeof scheduleInput.environmentId === "string" ? scheduleInput.environmentId : null),
    memoryLayers:
      taskTemplate
        ? parseJsonArray(taskTemplate.memoryLayersJson).map(String)
        : Array.isArray(scheduleInput.memoryLayers)
          ? scheduleInput.memoryLayers.map(String)
          : [],
    plannerMode: taskTemplate?.plannerMode ?? "rule",
    summary:
      taskTemplate?.summary ??
      (typeof scheduleInput.summary === "string"
        ? scheduleInput.summary
        : uiText("ui.generated.c677c9d2f08")),
    nodes: taskTemplate ? parseJsonArray(taskTemplate.nodesJson) : [],
    defaultInput,
  };
}

export function buildExtensionImportExample() {
  return {
    id: "codehub-review",
    source: "official.codehub",
    plugins: [
      {
        id: "official.codehub",
        name: "CodeHub Connector",
        version: "1.0.0",
        capability: "code_repo",
        lifecycle: "declared",
        mountPoint: "execution-environment",
        configSchema: "{ baseUrl, tokenRef, webhookSecretRef }",
        requiredSecretRefs: ["env:CODEHUB_TOKEN", "env:CODEHUB_WEBHOOK_SECRET"],
        permissions: ["repo:read", "repo:mr:comment"],
        healthCheck: "connector self-check",
        extensionOnly: true,
      },
    ],
    taskBlueprints: [
      {
        id: "codehub_mr_review",
        name: uiText("ui.generated.ca96d3de47c"),
        category: "code_review",
        visibility: "team",
        ownerBusinessTeamSlug: "release-team",
        teamSlug: "pr-vanguard",
        environmentId: "env-codehub-mr-review",
        providerAdapterId: "agentworld-runtime-adapter",
        trigger: {
          type: "webhook",
          connector: "official.codehub",
          webhookParserRef: "official.codehub.webhook.merge_request",
          event: "merge_request.updated",
          webhookPathKey: "codehub-mr",
          idempotencyKey: "${repo_id}:${mr_id}:${source_commit_sha}",
        },
        inputSchema: { type: "object", required: ["repo_id", "mr_id", "diff_ref"] },
        environmentSelector: {
          type: "repository_workspace",
          repoBinding: "${repo_id}",
          checkoutMode: "diff_context",
          privateKeyBinding: "codehub_repo_executor_key",
        },
        agentTeamRunPlan: {
          strategy: "leader_worker_parallel",
          leader: "agent-shield-review-leader",
          workers: [
            { agent: "agent-code-quality-reviewer", task: uiText("ui.generated.cf91b285b56") },
            { agent: "agent-security-reviewer", task: uiText("ui.generated.cbbce156290") },
          ],
          aggregation: {
            agent: "agent-shield-review-leader",
            method: "deduplicate_rank_and_publish",
          },
        },
        memoryPolicy: {
          requiredSpaces: ["viking://teams/security/code-review/", "viking://global/skills/code-review/"],
          archiveOutputTo: ["viking://teams/security/review-cases/"],
        },
        permissionPolicy: {
          defaultMode: "ask",
          rules: [
            { effect: "allow", resource: "tool.repo.diff.read", scope: "repository" },
            { effect: "allow", resource: "tool.repo.context.read", scope: "current_merge_request" },
            { effect: "allow", resource: "tool.memory.retrieve", scope: "declared_spaces" },
            { effect: "allow", resource: "tool.finding.create", scope: "task_run" },
            { effect: "allow", resource: "tool.finding.aggregate", scope: "task_run" },
            { effect: "allow", resource: "tool.mr.comment.write", scope: "current_merge_request" },
            { effect: "deny", resource: "tool.repo.force_push", scope: "*" },
            { effect: "deny", resource: "secret.read.raw_private_key", scope: "*" },
          ],
        },
        outputPolicy: {
          publishers: [
            { type: "merge_request_comment", pluginId: "official.codehub" },
            { type: "dashboard" },
          ],
        },
        executionPolicy: {
          timeoutMinutes: 30,
          retry: 1,
          concurrencyKey: "${repo_id}:${mr_id}",
        },
      },
    ],
    environments: [
      {
        id: "env-codehub-mr-review",
        businessTeamSlug: "release-team",
        name: uiText("ui.generated.cc4c2624540"),
        repositoryProvider: "codehub",
        repositoryName: "group/project",
        repositoryUrl: "ssh://codehub.example.com/group/project.git",
        defaultBranch: "main",
        executorRef: "svc-release-reviewer",
        privateKeyRef: "secret:release-team/codehub-private-key",
        workingDirectory: ".",
        sandboxProfile: { isolation: "future-sandbox", network: "egress-controlled" },
        memoryLayerRefs: ["repository/code-review", "global/code-review", "security"],
        visibility: "team",
      },
    ],
    webhooks: [
      {
        id: "webhook:codehub-mr",
        businessTeamSlug: "release-team",
        teamSlug: "pr-vanguard",
        name: "CodeHub MR Webhook",
        pathKey: "codehub-mr",
        method: "POST",
        requestSchema: { type: "object" },
        secretHint: "env:CODEHUB_WEBHOOK_SECRET",
        isEnabled: true,
      },
    ],
    taskTemplates: [
      {
        id: "task-template-codehub-mr-review",
        teamSlug: "pr-vanguard",
        name: uiText("ui.generated.c53ac66ae27"),
        caseKey: "shield",
        pluginId: "official.codehub",
        environmentId: "env-codehub-mr-review",
        plannerMode: "rule",
        summary: uiText("ui.generated.c921c067664"),
        inputSchema: { type: "object", required: ["repository", "changeRequest", "diff"] },
        defaultInput: { taskCategory: "code_review" },
        memoryLayers: ["repository/code-review", "global/code-review", "security"],
        outputTargets: ["mr_comment", "task_trace", "knowledge_archive"],
        webhookParserRef: "official.codehub.webhook.merge_request",
        visibility: "team",
      },
    ],
    scheduleTemplates: [
      {
        id: `template-codehub-mr-review-${randomUUID().slice(0, 8)}`,
        businessTeamSlug: "release-team",
        teamSlug: "pr-vanguard",
        name: uiText("ui.generated.c4f40ebdf40"),
        scheduleKind: "event",
        cadence: "Webhook: MR diff",
        inputPayload: {
          caseKey: "shield",
          taskTemplateId: "task-template-codehub-mr-review",
          taskCategory: "code_review",
          webhookPathKey: "codehub-mr",
          environmentId: "env-codehub-mr-review",
          memoryLayers: ["repository/code-review", "global/code-review", "security"],
          repositoryPlugin: "official.codehub",
          output: ["mr_comment", "task_trace", "knowledge_archive"],
        },
      },
    ],
  } satisfies AgentWorldExtensionBundle;
}
