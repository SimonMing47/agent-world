import { randomUUID } from "node:crypto";
import {
  execute,
  queryAll,
  queryOne,
  type AgentTeam,
  type ImportedPluginManifest,
  type Kingdom,
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

type ExtensionEnvironmentInput = {
  id: string;
  kingdomSlug?: string;
  kingdomId?: string;
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
  kingdomSlug?: string;
  kingdomId?: string;
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

export type AgentWorldExtensionBundle = {
  id?: string;
  name?: string;
  source?: string;
  plugins?: PluginManifest[];
  environments?: ExtensionEnvironmentInput[];
  taskTemplates?: ExtensionTaskTemplateInput[];
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

function resolveKingdomId(input: { kingdomId?: string; kingdomSlug?: string }) {
  if (input.kingdomId) return input.kingdomId;
  if (!input.kingdomSlug) throw new Error("kingdomId or kingdomSlug is required");
  const kingdom = queryOne<Kingdom>("SELECT * FROM kingdoms WHERE slug = ?", input.kingdomSlug);
  if (!kingdom) throw new Error(`kingdom not found: ${input.kingdomSlug}`);
  return kingdom.id;
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
  const importedTaskTemplates: string[] = [];
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
    const kingdomId = resolveKingdomId(environment);
    execute(
      "INSERT OR REPLACE INTO execution_environments (id, kingdom_id, name, repository_provider, repository_name, repository_url, default_branch, executor_ref, private_key_ref, working_directory, sandbox_profile_json, memory_layer_refs_json, visibility, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      environment.id,
      kingdomId,
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

  for (const template of bundle.scheduleTemplates ?? []) {
    const kingdomId = resolveKingdomId(template);
    const teamId = resolveTeamId(template);
    execute(
      "INSERT OR REPLACE INTO schedule_templates (id, kingdom_id, team_id, name, schedule_kind, cadence, next_run_at, input_payload_json, is_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      template.id,
      kingdomId,
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
    importedTaskTemplates,
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
        : "Webhook 已按任务模板转为可观测 Quest。"),
    nodes: taskTemplate ? parseJsonArray(taskTemplate.nodesJson) : [],
    defaultInput,
  };
}

export function buildExtensionImportExample() {
  return {
    id: "enterprise-git-review",
    source: "enterprise-git-plugin",
    plugins: [
      {
        id: "enterprise.repo.git",
        name: "Enterprise Git Connector",
        version: "1.0.0",
        capability: "code_repo",
        lifecycle: "declared",
        mountPoint: "execution-environment",
        configSchema: "{ baseUrl, privateKeyRef, diffApiPath, commentApiPath }",
        requiredSecretRefs: ["secret:enterprise-git-private-key", "secret:enterprise-git-token"],
        permissions: ["repo:read", "repo:mr:comment"],
        healthCheck: "connector self-check",
        extensionOnly: true,
      },
    ],
    environments: [
      {
        id: "env-enterprise-mr-review",
        kingdomSlug: "release-guild",
        name: "企业 Git MR 检视环境",
        repositoryProvider: "enterprise-git",
        repositoryName: "group/project",
        repositoryUrl: "ssh://git.example.com/group/project.git",
        defaultBranch: "main",
        executorRef: "svc-release-reviewer",
        privateKeyRef: "secret:release-guild/enterprise-git-private-key",
        workingDirectory: ".",
        sandboxProfile: { isolation: "future-sandbox", network: "egress-controlled" },
        memoryLayerRefs: ["repository/code-review", "global/code-review", "security"],
        visibility: "team",
      },
    ],
    taskTemplates: [
      {
        id: "task-template-enterprise-mr-review",
        teamSlug: "pr-vanguard",
        name: "企业 Git MR 分层检视",
        caseKey: "shield",
        pluginId: "enterprise.repo.git",
        environmentId: "env-enterprise-mr-review",
        plannerMode: "rule",
        summary: "企业 Git MR 通过导入模板进入神盾计划检视团队。",
        inputSchema: { type: "object", required: ["repository", "changeRequest", "diff"] },
        defaultInput: { taskCategory: "code_review" },
        memoryLayers: ["repository/code-review", "global/code-review", "security"],
        outputTargets: ["mr_comment", "quest_trace", "knowledge_archive"],
        webhookParserRef: "enterprise.repo.git.webhookParser",
        visibility: "team",
      },
    ],
    scheduleTemplates: [
      {
        id: `template-enterprise-mr-review-${randomUUID().slice(0, 8)}`,
        kingdomSlug: "release-guild",
        teamSlug: "pr-vanguard",
        name: "企业 Git MR webhook 检视",
        scheduleKind: "event",
        cadence: "Webhook: MR diff",
        inputPayload: {
          caseKey: "shield",
          taskTemplateId: "task-template-enterprise-mr-review",
          taskCategory: "code_review",
          webhookPathKey: "enterprise-mr",
          environmentId: "env-enterprise-mr-review",
          memoryLayers: ["repository/code-review", "global/code-review", "security"],
          repositoryPlugin: "enterprise.repo.git",
          output: ["mr_comment", "quest_trace", "knowledge_archive"],
        },
      },
    ],
  } satisfies AgentWorldExtensionBundle;
}
