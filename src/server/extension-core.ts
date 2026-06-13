import { inflateRawSync } from "node:zlib";
import {
  execute,
  queryAll,
  queryOne,
  type AgentTeam,
  type ImportedPluginManifest,
  type ImportedPluginContribution,
  type BusinessTeam,
  type ScheduleTemplate,
  type TaskTemplate,
} from "@/server/db";
import {
  getPluginSecurityModel,
  listPluginExtensionPoints,
  type PluginCapability,
  type PluginLifecycle,
  type PluginManifest,
} from "@/server/plugin-core";
import {
  getExecutablePluginRegistrySnapshot,
  listOfficialPluginManifests,
} from "@/server/plugin-sdk-core";
import { uiText } from "@/lib/language-pack";

type AgentWorldPluginPackageManifest = {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    id?: string;
    name?: string;
    version?: string;
    description?: string;
    vendor?: string;
  };
  spec?: {
    runtime?: {
      type?: string;
      kind?: string;
      entry?: string;
      activationEvents?: string[];
    };
    permissions?: {
      requested?: string[];
    };
    contributions?: {
      authAdapters?: Array<Record<string, unknown>>;
      providerAdapters?: Array<Record<string, unknown>>;
      repositoryConnectors?: Array<Record<string, unknown>>;
      webhookParsers?: Array<Record<string, unknown>>;
      outputPublishers?: Array<Record<string, unknown>>;
      toolBundles?: Array<Record<string, unknown>>;
      knowledgeSources?: Array<Record<string, unknown>>;
      knowledgeAssets?: Array<Record<string, unknown>>;
      skills?: Array<Record<string, unknown>>;
      taskBlueprints?: Array<Record<string, unknown>>;
      environmentTemplates?: Array<Record<string, unknown>>;
      navigationItems?: Array<Record<string, unknown>>;
      settingsPanels?: Array<Record<string, unknown>>;
      dashboardWidgets?: Array<Record<string, unknown>>;
      taskRunPanels?: Array<Record<string, unknown>>;
      agentDetailTabs?: Array<Record<string, unknown>>;
      codebaseEngines?: Array<Record<string, unknown>>;
      notificationChannels?: Array<Record<string, unknown>>;
      secretProviders?: Array<Record<string, unknown>>;
      workflowBlocks?: Array<Record<string, unknown>>;
      pages?: Array<Record<string, unknown>>;
      languagePacks?: Array<Record<string, unknown>>;
    };
    configSchema?: Record<string, unknown>;
  };
};

type ContributionBucket = keyof NonNullable<NonNullable<AgentWorldPluginPackageManifest["spec"]>["contributions"]>;

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
  pluginPackages?: AgentWorldPluginPackageManifest[];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyJson(value: unknown, fallback: unknown = {}) {
  try {
    return JSON.stringify(value ?? fallback, null, 2);
  } catch {
    return JSON.stringify(fallback, null, 2);
  }
}

const contributionKindByManifestKey = {
  authAdapters: "authAdapter",
  providerAdapters: "providerAdapter",
  repositoryConnectors: "repositoryConnector",
  webhookParsers: "webhookParser",
  outputPublishers: "outputPublisher",
  toolBundles: "toolBundle",
  knowledgeSources: "knowledgeSource",
  knowledgeAssets: "knowledgeAsset",
  skills: "skill",
  taskBlueprints: "taskBlueprint",
  environmentTemplates: "environmentTemplate",
  navigationItems: "navigationItem",
  settingsPanels: "settingsPanel",
  dashboardWidgets: "dashboardWidget",
  taskRunPanels: "taskRunPanel",
  agentDetailTabs: "agentDetailTab",
  codebaseEngines: "codebaseEngine",
  notificationChannels: "notificationChannel",
  secretProviders: "secretProvider",
  workflowBlocks: "workflowBlock",
  pages: "page",
  languagePacks: "languagePack",
} satisfies Partial<Record<ContributionBucket, string>>;

function contributionId(pluginId: string, contribution: Record<string, unknown>, fallback: string) {
  const rawId = contribution.id;
  return typeof rawId === "string" && rawId.trim() ? rawId.trim() : `${pluginId}.${fallback}`;
}

function firstContribution(
  manifest: AgentWorldPluginPackageManifest,
  key: ContributionBucket,
) {
  const entries = manifest.spec?.contributions?.[key];
  return Array.isArray(entries) ? entries.find(isRecord) ?? null : null;
}

function derivePluginCapability(manifest: AgentWorldPluginPackageManifest): PluginCapability {
  const contributions = manifest.spec?.contributions ?? {};
  if (Array.isArray(contributions.authAdapters) && contributions.authAdapters.length > 0) return "auth_sso";
  if (
    Array.isArray(contributions.repositoryConnectors) ||
    Array.isArray(contributions.webhookParsers) ||
    Array.isArray(contributions.outputPublishers)
  ) {
    return "code_repo";
  }
  if (Array.isArray(contributions.providerAdapters)) return "provider_adapter";
  if (Array.isArray(contributions.codebaseEngines)) return "codebase_engine";
  if (Array.isArray(contributions.notificationChannels)) return "notification_channel";
  if (Array.isArray(contributions.knowledgeSources)) return "knowledge_source";
  if (Array.isArray(contributions.knowledgeAssets) || Array.isArray(contributions.skills)) return "knowledge";
  if (Array.isArray(contributions.workflowBlocks)) return "workflow_block";
  if (Array.isArray(contributions.secretProviders)) return "secret_provider";
  return "tool";
}

function derivePluginMountPoint(pluginId: string, manifest: AgentWorldPluginPackageManifest) {
  const page = firstContribution(manifest, "pages");
  const route = page?.route;
  if (typeof route === "string" && route.startsWith(`/plugins/${pluginId}/`)) return route;

  const authAdapter = firstContribution(manifest, "authAdapters");
  if (authAdapter) {
    return `/api/auth/plugins/${encodeURIComponent(contributionId(pluginId, authAdapter, "sso"))}/start`;
  }

  return `/plugins/${pluginId}/admin`;
}

function derivePluginConfigSchema(manifest: AgentWorldPluginPackageManifest) {
  if (manifest.spec?.configSchema) return manifest.spec.configSchema;
  const authAdapter = firstContribution(manifest, "authAdapters");
  const authSchema = authAdapter?.configSchema;
  return isRecord(authSchema) ? authSchema : {};
}

function deriveRequiredSecretRefs(manifest: AgentWorldPluginPackageManifest) {
  const schema = derivePluginConfigSchema(manifest);
  const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
  return required.filter((key) => /(secret|token|credential|password|privateKey|private_key)/i.test(key));
}

function normalizePackageManifest(input: unknown): AgentWorldPluginPackageManifest {
  if (!isRecord(input)) throw new Error("plugin manifest must be an object");
  const manifest = input as AgentWorldPluginPackageManifest;
  if (manifest.kind !== "AgentWorldPlugin") {
    throw new Error("plugin manifest kind must be AgentWorldPlugin");
  }
  if (!manifest.metadata?.id || !manifest.metadata.name || !manifest.metadata.version) {
    throw new Error("plugin manifest metadata requires id, name and version");
  }
  return manifest;
}

function toCompatiblePluginManifest(
  manifest: AgentWorldPluginPackageManifest,
  source: string,
): PluginManifest {
  const id = manifest.metadata!.id!.trim();
  const runtime = manifest.spec?.runtime;
  return {
    id,
    name: manifest.metadata!.name!.trim(),
    version: manifest.metadata!.version!.trim(),
    capability: derivePluginCapability(manifest),
    lifecycle: "declared",
    mountPoint: derivePluginMountPoint(id, manifest),
    configSchema: stringifyJson(derivePluginConfigSchema(manifest)),
    requiredSecretRefs: deriveRequiredSecretRefs(manifest),
    permissions: manifest.spec?.permissions?.requested?.map(String) ?? [],
    healthCheck: `${runtime?.type ?? runtime?.kind ?? "declarative"}:${runtime?.entry ?? "agentworld.plugin.json"}:${source}`,
    extensionOnly: true,
  };
}

function importPluginContributionRows(
  manifest: AgentWorldPluginPackageManifest,
  source: string,
  createdAt: string,
) {
  const pluginId = manifest.metadata!.id!.trim();
  const imported: string[] = [];
  const contributions = manifest.spec?.contributions ?? {};

  execute("DELETE FROM plugin_contributions WHERE plugin_id = ?", pluginId);

  for (const [manifestKey, kind] of Object.entries(contributionKindByManifestKey)) {
    const entries = contributions[manifestKey as ContributionBucket];
    if (!Array.isArray(entries)) continue;
    entries.filter(isRecord).forEach((entry, index) => {
      const id = contributionId(pluginId, entry, `${manifestKey}.${index + 1}`);
      const rowId = `${pluginId}:${kind}:${id}`;
      execute(
        "INSERT OR REPLACE INTO plugin_contributions (id, plugin_id, contribution_id, kind, contribution_json, lifecycle, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rowId,
        pluginId,
        id,
        kind,
        stringifyJson(entry),
        "declared",
        source,
        createdAt,
        createdAt,
      );
      imported.push(`${kind}:${id}`);
    });
  }

  return imported;
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

export function listImportedPluginContributions(kind?: string) {
  const rows = kind
    ? queryAll<ImportedPluginContribution>(
        "SELECT * FROM plugin_contributions WHERE kind = ? ORDER BY plugin_id ASC, contribution_id ASC",
        kind,
      )
    : queryAll<ImportedPluginContribution>(
        "SELECT * FROM plugin_contributions ORDER BY plugin_id ASC, kind ASC, contribution_id ASC",
      );
  return rows.map((row) => ({
    ...row,
    contribution: parseJsonRecord(row.contributionJson),
  }));
}

export function listAllPluginManifests() {
  const imported = listImportedPluginManifests();
  const importedIds = new Set(imported.map((plugin) => plugin.id));
  return [
    ...imported,
    ...listOfficialPluginManifests().filter((plugin) => !importedIds.has(plugin.id)),
  ];
}

export function getExtensionRegistrySnapshot() {
  return {
    manifests: listAllPluginManifests(),
    contributions: listImportedPluginContributions(),
    extensionPoints: listPluginExtensionPoints(),
    runtimeRegistry: getExecutablePluginRegistrySnapshot(),
    securityModel: getPluginSecurityModel(),
  };
}

export function importPluginPackageManifest(
  input: unknown,
  options: { source?: string } = {},
) {
  const manifest = normalizePackageManifest(input);
  const source = options.source ?? manifest.metadata?.id ?? "plugin-package";
  const createdAt = nowIso();
  const plugin = toCompatiblePluginManifest(manifest, source);
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

  return {
    source,
    importedPlugins: [plugin.id],
    importedContributions: importPluginContributionRows(manifest, source, createdAt),
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
  const importedContributions: string[] = [];

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

  for (const pluginPackage of bundle.pluginPackages ?? []) {
    const result = importPluginPackageManifest(pluginPackage, { source });
    importedPlugins.push(...result.importedPlugins);
    importedContributions.push(...result.importedContributions);
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
      blueprint.providerAdapterId ?? "",
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
    importedContributions,
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

function isSafeZipPath(value: string) {
  if (!value || value.startsWith("/") || value.startsWith("\\")) return false;
  return !value.split(/[\\/]+/).some((part) => part === "..");
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  return -1;
}

function extractFileFromZip(buffer: Buffer, fileName: string) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) throw new Error("zip package is missing central directory");

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;
  let fallbackEntry: {
    name: string;
    method: number;
    compressedSize: number;
    localHeaderOffset: number;
  } | null = null;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("zip package has an invalid central directory");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (!isSafeZipPath(name)) throw new Error(`zip package contains unsafe path: ${name}`);
    const entry = { name, method, compressedSize, localHeaderOffset };
    if (name === fileName) fallbackEntry = entry;
    if (!fallbackEntry && name.endsWith(`/${fileName}`)) fallbackEntry = entry;
    offset += 46 + nameLength + extraLength + commentLength;
  }

  if (!fallbackEntry) throw new Error(`${fileName} not found in zip package`);
  const localOffset = fallbackEntry.localHeaderOffset;
  if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("zip package has an invalid local file header");
  const nameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const dataOffset = localOffset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataOffset, dataOffset + fallbackEntry.compressedSize);

  if (fallbackEntry.method === 0) return compressed.toString("utf8");
  if (fallbackEntry.method === 8) return inflateRawSync(compressed).toString("utf8");
  throw new Error(`zip compression method ${fallbackEntry.method} is not supported`);
}

export function readPluginPackageManifestFromBuffer(fileName: string, input: Buffer) {
  const lowerName = fileName.toLowerCase();
  const manifestText =
    lowerName.endsWith(".zip") || lowerName.endsWith(".awp")
      ? extractFileFromZip(input, "agentworld.plugin.json")
      : input.toString("utf8");
  return normalizePackageManifest(JSON.parse(manifestText) as unknown);
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
