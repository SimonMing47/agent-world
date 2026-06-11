import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync as DatabaseSyncType, SQLInputValue } from "node:sqlite";
import { LEGACY_KNOWLEDGE_URI_SCHEME, NATIVE_KNOWLEDGE_URI_SCHEME } from "@/lib/knowledge-uri";
import { type KnowledgeCategory } from "@/lib/knowledge-categories";
import { schemaSql } from "@/server/db-schema";

type Row = Record<string, unknown>;
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");

function toCamelCaseKey(key: string) {
  return key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function camelizeRow<T extends Row>(row: Row | null | undefined) {
  if (!row) return null;

  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [toCamelCaseKey(key), value]),
  );

  return normalized as T;
}

export type TenantSpace = {
  id: string;
  slug: string;
  name: string;
  ownerUserId: string;
  status: string;
  quotaLimitJson: string;
  modelWhitelistJson: string;
  globalGuardrailsJson: string;
  defaultExecutionPolicyId: string | null;
  createdAt: string;
};

export type BusinessTeam = {
  id: string;
  tenantSpaceId: string;
  parentBusinessTeamId: string | null;
  slug: string;
  name: string;
  description: string;
  ownerUserId: string;
  status: string;
  balance: number;
  creditLimit: number;
  privateToolRefsJson: string;
  privateMemoryNamespace: string;
  policyJson: string;
  createdAt: string;
};

export type TeamMember = {
  id: string;
  tenantSpaceId: string;
  businessTeamId: string;
  employeeNo: string;
  name: string;
  email: string;
  role: string;
  title: string;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthProviderConfig = {
  id: string;
  tenantSpaceId: string | null;
  name: string;
  adapterKey: string;
  status: string;
  issuerUrl: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  jwksUrl: string;
  clientId: string;
  clientSecretRef: string;
  scopesJson: string;
  mappingJson: string;
  configJson: string;
  createdAt: string;
  updatedAt: string;
};

export type IdentityUser = {
  id: string;
  tenantSpaceId: string | null;
  authProviderConfigId: string | null;
  externalUserId: string;
  employeeNo: string;
  email: string;
  name: string;
  avatarUrl: string;
  title: string;
  status: string;
  isSystemAdmin: number;
  primaryBusinessTeamId: string | null;
  profileJson: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
};

export type LocalAuthCredential = {
  id: string;
  userId: string;
  username: string;
  passwordHash: string;
  forcePasswordChange: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastPasswordChangeAt: string | null;
};

export type IdentityUserBusinessTeamMembership = {
  id: string;
  userId: string;
  businessTeamId: string;
  membershipSource: string;
  sourceRef: string;
  roleTitle: string;
  isPrimary: number;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  id: string;
  userId: string;
  authProviderConfigId: string | null;
  sessionToken: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
};

export type AccessWhitelistRule = {
  id: string;
  tenantSpaceId: string | null;
  businessTeamId: string;
  allowDescendants: number;
  note: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AccessRequest = {
  id: string;
  authProviderConfigId: string | null;
  email: string;
  name: string;
  requestedBusinessTeamHint: string;
  requestNote: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamPermissionGrant = {
  id: string;
  businessTeamId: string;
  memberId: string | null;
  principalType: string;
  roleKey: string;
  resourceType: string;
  resourceScope: string;
  actionsJson: string;
  effect: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamAssetGrant = {
  id: string;
  businessTeamId: string;
  memberId: string | null;
  assetType: string;
  assetId: string;
  assetName: string;
  permissionJson: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ExecutionPolicy = {
  id: string;
  tenantSpaceId: string | null;
  businessTeamId: string | null;
  teamId: string | null;
  name: string;
  systemInstruction: string;
  toolPolicyJson: string;
  approvalPolicyJson: string;
  budgetPolicyJson: string;
  outputPolicyJson: string;
  securityPolicyJson: string;
  createdAt: string;
};

export type AgentTeam = {
  id: string;
  businessTeamId: string;
  slug: string;
  name: string;
  description: string;
  leaderAgentId: string | null;
  workflowType: string;
  orchestrationPrompt: string;
  workflowDefinitionJson: string;
  inputSchemaJson: string;
  outputSchemaJson: string;
  maxConcurrency: number;
  timeoutMs: number;
  successRateThreshold: number;
  pricingModelJson: string;
  visibility: string;
  defaultExecutionPolicyId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Agent = {
  id: string;
  teamId: string;
  slug: string;
  name: string;
  role: string;
  personaPrompt: string;
  model: string;
  shortTermWindow: number;
  ragConfigJson: string;
  toolBindingsJson: string;
  memoryScope: string;
  safetyPolicyJson: string;
  status: string;
  createdAt: string;
};

export type AgentTeamMember = {
  id: string;
  teamId: string;
  agentDefinitionId: string;
  memberRole: string;
  workInstruction: string;
  position: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentTeamShare = {
  id: string;
  agentTeamId: string;
  businessTeamId: string;
  accessLevel: string;
  createdAt: string;
};

export type AgentDefinition = {
  id: string;
  tenantSpaceId: string;
  ownerBusinessTeamId: string | null;
  ownerUserId: string;
  sourceAgentId: string | null;
  slug: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  model: string;
  defaultProviderProfileId: string | null;
  defaultRuntimeBindingId: string | null;
  avatarConfigJson: string;
  capabilityProfileJson: string;
  toolBindingsJson: string;
  harnessConfigJson: string;
  permissionPolicyJson: string;
  memoryScope: string;
  tagsJson: string;
  visibility: string;
  status: string;
  validationStatus: string;
  lastValidatedAt: string | null;
  lastValidationSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentDefinitionShare = {
  id: string;
  agentDefinitionId: string;
  businessTeamId: string;
  accessLevel: string;
  createdAt: string;
};

export type ProviderProfile = {
  id: string;
  tenantSpaceId: string;
  name: string;
  baseUrl: string;
  apiStyle: string;
  defaultModel: string;
  modelsJson: string;
  apiKeyRef: string;
  configJson: string;
  isEnabled: number;
  createdAt: string;
  updatedAt: string;
};

export type ProviderRuntimeBinding = {
  id: string;
  tenantSpaceId: string;
  businessTeamId: string | null;
  adapterDefinitionId: string;
  name: string;
  runtimeKind: string;
  baseUrl: string;
  command: string;
  workspaceRoot: string;
  defaultProviderProfileId: string | null;
  apiKeyRef: string;
  configJson: string;
  isEnabled: number;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeEndpoint = {
  id: string;
  tenantSpaceId: string;
  businessTeamId: string | null;
  name: string;
  baseUrl: string;
  runtimeKind: string;
  healthStatus: string;
  agentCatalogJson: string;
  providerCatalogJson: string;
  concurrencyLimit: number;
  activeRunCount: number;
  lastDiscoveredAt: string;
  createdAt: string;
};

export type AccessGrant = {
  id: string;
  providerTeamId: string;
  consumerBusinessTeamId: string;
  pricingModelJson: string;
  slaJson: string;
  accessScopeJson: string;
  serviceAccountRef: string;
  status: string;
  createdAt: string;
};

export type ServiceCatalogListing = {
  id: string;
  teamId: string;
  resumeJson: string;
  recruitmentMode: string;
  tagsJson: string;
  status: string;
  createdAt: string;
};

export type ScheduleTemplate = {
  id: string;
  businessTeamId: string;
  teamId: string;
  name: string;
  scheduleKind: string;
  cadence: string;
  nextRunAt: string | null;
  inputPayloadJson: string;
  isEnabled: number;
  createdAt: string;
};

export type TaskTemplate = {
  id: string;
  name: string;
  caseKey: string;
  pluginId: string | null;
  teamId: string;
  environmentId: string | null;
  plannerMode: string;
  summary: string;
  inputSchemaJson: string;
  defaultInputJson: string;
  memoryLayersJson: string;
  outputTargetsJson: string;
  nodesJson: string;
  webhookParserRef: string | null;
  visibility: string;
  createdAt: string;
};

export type TaskBlueprint = {
  id: string;
  name: string;
  category: string;
  visibility: string;
  ownerBusinessTeamId: string;
  teamId: string;
  environmentId: string | null;
  providerAdapterId: string;
  version: number;
  status: string;
  triggerJson: string;
  inputSchemaJson: string;
  environmentSelectorJson: string;
  agentTeamRunPlanJson: string;
  memoryPolicyJson: string;
  providerPolicyJson: string;
  permissionPolicyJson: string;
  resultSchemaJson: string;
  outputPolicyJson: string;
  dashboardPolicyJson: string;
  executionPolicyJson: string;
  archivePolicyJson: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskRun = {
  id: string;
  tenantSpaceId: string;
  businessTeamId: string;
  teamId: string;
  blueprintId: string | null;
  blueprintVersion: number;
  idempotencyKey: string | null;
  parentTaskRunId: string | null;
  runState: string;
  environmentSnapshotId: string | null;
  permissionSnapshotJson: string;
  agentTeamRunPlanJson: string;
  executionPolicyJson: string;
  accessGrantId: string | null;
  sourceType: string;
  sourceRef: string | null;
  status: string;
  priority: number;
  inputPayloadJson: string;
  outputPayloadJson: string | null;
  costEstimate: number;
  costActual: number;
  traceId: string;
  requestedBy: string;
  createdAt: string;
  completedAt: string | null;
};

export type TaskRunPlan = {
  id: string;
  taskRunId: string;
  plannerMode: string;
  dagJson: string;
  summary: string;
  createdAt: string;
};

export type TaskRunNode = {
  id: string;
  taskRunId: string;
  planId: string;
  nodeKey: string;
  agentId: string;
  dependsOnJson: string;
  inputJson: string;
  outputJson: string | null;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  startedAt: string | null;
  completedAt: string | null;
};

export type TraceSpan = {
  id: string;
  traceId: string;
  parentSpanId: string | null;
  taskRunId: string;
  nodeId: string | null;
  kind: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  attributesJson: string;
};

export type EventLog = {
  id: string;
  traceId: string;
  taskRunId: string;
  nodeId: string | null;
  seq: number;
  phase: string;
  foldGroup: string;
  title: string;
  content: string;
  metadataJson: string;
  createdAt: string;
};

export type TaskEvent = {
  id: string;
  taskRunId: string;
  agentRunId: string | null;
  eventType: string;
  eventTime: string;
  visibility: string;
  payloadJson: string;
  rawPayloadRef: string | null;
  parentEventId: string | null;
};

export type TaskRunIntervention = {
  id: string;
  taskRunId: string;
  nodeId: string | null;
  kind: string;
  status: string;
  requestedAction: string;
  resolutionNote: string | null;
  requestedAt: string;
  resolvedAt: string | null;
};

export type RuntimeSession = {
  id: string;
  tenantSpaceId: string;
  businessTeamId: string;
  agentTeamId: string | null;
  agentDefinitionId: string | null;
  runtimeBindingId: string;
  providerProfileId: string;
  mode: string;
  title: string;
  systemPrompt: string;
  model: string;
  status: string;
  lastError: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeSessionMessage = {
  id: string;
  sessionId: string;
  actorType: string;
  actorId: string | null;
  actorName: string;
  role: string;
  contentJson: string;
  visibility: string;
  turnIndex: number;
  createdAt: string;
};

export type RuntimeSessionEvent = {
  id: string;
  sessionId: string;
  messageId: string | null;
  actorId: string | null;
  actorName: string | null;
  eventType: string;
  payloadJson: string;
  visibility: string;
  createdAt: string;
};

export type RepositoryProfile = {
  id: string;
  businessTeamId: string;
  name: string;
  provider: string;
  branch: string;
  activityIndex: number;
  lastTaskRunCount: number;
};

export type DeveloperProfile = {
  id: string;
  businessTeamId: string;
  name: string;
  focus: string;
  lastActiveAt: string;
};

export type McpServerProfile = {
  id: string;
  businessTeamId: string | null;
  name: string;
  transport: string;
  command: string;
  url: string;
  authRef: string;
  toolAllowlistJson: string;
  status: string;
  lastHealthStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type ConnectorProfile = {
  id: string;
  businessTeamId: string | null;
  name: string;
  connectorType: string;
  provider: string;
  endpoint: string;
  secretRef: string;
  capabilitiesJson: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type CodebaseProfile = {
  id: string;
  businessTeamId: string;
  name: string;
  provider: string;
  repositoryUrl: string;
  defaultBranch: string;
  visibility: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type CodebaseOperatorToken = {
  id: string;
  codebaseId: string;
  operatorName: string;
  tokenRef: string;
  role: string;
  permissionJson: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ExecutionEnvironment = {
  id: string;
  businessTeamId: string;
  name: string;
  repositoryProvider: string;
  repositoryName: string;
  repositoryUrl: string;
  defaultBranch: string;
  executorRef: string;
  privateKeyRef: string;
  workingDirectory: string;
  sandboxProfileJson: string;
  memoryLayerRefsJson: string;
  visibility: string;
  status: string;
  createdAt: string;
};

export type EnvironmentTemplate = {
  id: string;
  businessTeamId: string;
  name: string;
  environmentType: string;
  repositorySelectorJson: string;
  executorPolicyJson: string;
  secretBindingsJson: string;
  workspacePolicyJson: string;
  sandboxPolicyJson: string;
  memoryDefaultsJson: string;
  visibility: string;
  status: string;
  createdAt: string;
};

export type EnvironmentSnapshot = {
  id: string;
  taskRunId: string;
  templateId: string | null;
  environmentId: string | null;
  snapshotJson: string;
  createdAt: string;
};

export type WebhookEndpoint = {
  id: string;
  businessTeamId: string;
  teamId: string;
  name: string;
  pathKey: string;
  method: string;
  requestSchemaJson: string;
  secretHint: string;
  isEnabled: number;
};

export type ImportedPluginManifest = {
  id: string;
  name: string;
  version: string;
  capability: string;
  lifecycle: string;
  mountPoint: string;
  configSchema: string;
  requiredSecretRefsJson: string;
  permissionsJson: string;
  healthCheck: string;
  extensionOnly: number;
  source: string;
  createdAt: string;
};

export type ProviderAdapterDefinition = {
  id: string;
  name: string;
  adapterType: string;
  entryRef: string;
  version: string;
  lifecycle: string;
  capabilitiesJson: string;
  configSchemaJson: string;
  secretRefsJson: string;
  permissionRefsJson: string;
  healthStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type InspectionSkill = {
  id: string;
  ownerBusinessTeamId: string | null;
  name: string;
  layer: string;
  description: string;
  tagsJson: string;
  visibility: string;
  vikingUri: string | null;
  isEnabled: number;
  promptMd: string;
  heuristicsJson: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeEntryRecord = {
  id: string;
  knowledgeSpaceId: string | null;
  layer: string;
  scopeKey: string;
  skillId: string | null;
  vikingUri: string;
  title: string;
  contentMd: string;
  metadataJson: string;
  sourceType: string;
  syncStatus: string;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  revision: number;
};

export type KnowledgeEntryVersionRecord = {
  id: string;
  entryId: string;
  revision: number;
  knowledgeSpaceId: string | null;
  layer: string;
  scopeKey: string;
  skillId: string | null;
  vikingUri: string;
  title: string;
  contentMd: string;
  metadataJson: string;
  sourceType: string;
  syncStatus: string;
  syncError: string | null;
  createdAt: string;
  createdBy: string | null;
};

export type KnowledgeLayer = {
  id: string;
  layerKey: string;
  name: string;
  scope: string;
  vikingUri: string;
  parentUri: string | null;
  description: string;
  loadOrder: number;
  retentionPolicyJson: string;
  isEnabled: number;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeSpace = {
  id: string;
  tenantSpaceId: string;
  businessTeamId: string | null;
  agentTeamId: string | null;
  projectKey: string | null;
  knowledgeCategory: KnowledgeCategory;
  repositoryName: string | null;
  slug: string;
  name: string;
  spaceType: string;
  vikingUri: string;
  description: string;
  visibility: string;
  status: string;
  retentionPolicyJson: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeSpaceBinding = {
  id: string;
  knowledgeSpaceId: string;
  targetType: string;
  targetId: string;
  accessLevel: string;
  loadOrder: number;
  createdAt: string;
};

export type MergeRequestComment = {
  id: string;
  webhookId: string;
  platform: string;
  repositorySlug: string;
  repositoryCloneUrl: string | null;
  mrIid: string;
  mrTitle: string;
  mrUrl: string | null;
  sourceBranch: string | null;
  targetBranch: string | null;
  commitSha: string | null;
  author: string | null;
  status: string;
  diffStatus: string;
  commentStatus: string;
  commentUrl: string | null;
  commentMarkdown: string | null;
  callbackBaseUrl: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type InspectionFinding = {
  id: string;
  inspectionId: string;
  skillId: string;
  knowledgeLayer: string;
  severity: string;
  filePath: string | null;
  lineNumber: number | null;
  title: string;
  body: string;
  suggestion: string | null;
  feedbackToken: string;
  feedbackState: string;
  createdAt: string;
};

export type Finding = {
  id: string;
  taskRunId: string;
  sourceAgent: string;
  category: string;
  severity: string;
  confidence: number;
  title: string;
  description: string;
  evidenceJson: string;
  recommendation: string;
  skillRefsJson: string;
  fingerprint: string;
  status: string;
  publicationJson: string;
  createdAt: string;
  updatedAt: string;
};

export type InspectionFeedback = {
  id: string;
  findingId: string;
  inspectionId: string;
  token: string;
  verdict: string;
  note: string | null;
  sourceIp: string | null;
  knowledgeUri: string | null;
  createdAt: string;
};

export type KnowledgeApiToken = {
  id: string;
  label: string;
  tokenPrefix: string;
  tokenHash: string;
  status: string;
  createdBy: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SystemSetting = {
  key: string;
  valueJson: string;
  updatedBy: string;
  updatedAt: string;
};

const DATA_DIR = process.env.AGENTWORLD_DATA_DIR
  ? path.resolve(process.env.AGENTWORLD_DATA_DIR)
  : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "agentworld.db");

const requiredCurrentTables = [
  "tenant_spaces",
  "business_teams",
  "agent_teams",
  "task_blueprints",
  "task_runs",
  "task_events",
  "findings",
  "provider_runtime_bindings",
  "provider_adapter_definitions",
  "environment_snapshots",
];

const currentSchemaChecks = [
  { table: "agent_teams", column: "business_team_id" },
  { table: "provider_profiles", column: "api_key_ref" },
  { table: "provider_runtime_bindings", column: "adapter_definition_id" },
  { table: "task_blueprints", column: "permission_policy_json" },
  { table: "task_runs", column: "tenant_space_id" },
  { table: "task_runs", column: "blueprint_id" },
  { table: "task_events", column: "event_type" },
  { table: "task_run_nodes", column: "task_run_id" },
  { table: "findings", column: "fingerprint" },
  { table: "provider_adapter_definitions", column: "capabilities_json" },
  { table: "tenant_spaces", column: "default_execution_policy_id" },
  { table: "execution_environments", column: "memory_layer_refs_json" },
  { table: "environment_snapshots", column: "snapshot_json" },
];

function tableExists(db: DatabaseSyncType, table: string) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { name: string } | undefined;
  return Boolean(row);
}

function tableHasColumn(db: DatabaseSyncType, table: string, column: string) {
  if (!tableExists(db, table)) return true;
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function replaceLegacyKnowledgeUriColumn(db: DatabaseSyncType, table: string, column: string) {
  if (!tableExists(db, table) || !tableHasColumn(db, table, column)) return;
  db.prepare(`UPDATE ${table} SET ${column} = replace(${column}, ?, ?) WHERE ${column} LIKE ?`).run(
    LEGACY_KNOWLEDGE_URI_SCHEME,
    NATIVE_KNOWLEDGE_URI_SCHEME,
    `%${LEGACY_KNOWLEDGE_URI_SCHEME}%`,
  );
}

function normalizePersistedKnowledgeUris(db: DatabaseSyncType) {
  for (const [table, columns] of [
    ["knowledge_layers", ["viking_uri", "parent_uri", "retention_policy_json"]],
    ["knowledge_spaces", ["viking_uri", "retention_policy_json"]],
    ["knowledge_entries", ["viking_uri", "content_md", "metadata_json"]],
    ["knowledge_entry_versions", ["viking_uri", "content_md", "metadata_json"]],
    ["inspection_skills", ["viking_uri"]],
    ["execution_environments", ["memory_layer_refs_json"]],
    ["task_blueprints", ["memory_policy_json"]],
  ] as const) {
    for (const column of columns) {
      replaceLegacyKnowledgeUriColumn(db, table, column);
    }
  }
}

function databaseNeedsSchemaReset(db: DatabaseSyncType) {
  if (requiredCurrentTables.some((table) => !tableExists(db, table))) return true;
  return currentSchemaChecks.some((check) => !tableHasColumn(db, check.table, check.column));
}

function archiveIncompatibleDatabaseIfNeeded() {
  if (!fs.existsSync(DB_PATH)) return;
  const probe = new DatabaseSync(DB_PATH);
  const needsReset = databaseNeedsSchemaReset(probe);
  probe.close();

  if (!needsReset) return;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.renameSync(DB_PATH, `${DB_PATH}.legacy-${timestamp}.bak`);
}

let database: DatabaseSyncType | null = null;

const builtInProviderAdapterDefinitions: Array<{
  id: string;
  name: string;
  adapterType: string;
  entryRef: string;
  version: string;
  lifecycle: string;
  capabilitiesJson: string;
  configSchemaJson: string;
  secretRefsJson: string;
  permissionRefsJson: string;
  healthStatus: string;
}> = [
  {
    id: "builtin-agent-runtime",
    name: "Unified Agent Runtime",
    adapterType: "embedded",
    entryRef: "internal://runtime/pi",
    version: "1.0.0",
    lifecycle: "general_availability",
    capabilitiesJson: JSON.stringify(
      ["session.create", "event.stream", "message.send", "session.cancel", "artifact.collect", "runtime.discover"],
      null,
      2,
    ),
    configSchemaJson: JSON.stringify(
      {
        type: "object",
        properties: {
          defaultModel: { type: "string" },
          approvalMode: { enum: ["allow", "ask", "deny", "manual"] },
          eventContract: { type: "string" },
          env: { type: "object" },
        },
      },
      null,
      2,
    ),
    secretRefsJson: JSON.stringify([], null, 2),
    permissionRefsJson: JSON.stringify(["tool.read", "tool.execute", "memory.read"], null, 2),
    healthStatus: "healthy",
  },
];

function ensureAgentDefinitionHarnessColumns(db: DatabaseSyncType) {
  if (!tableHasColumn(db, "agent_definitions", "avatar_config_json")) {
    db.exec("ALTER TABLE agent_definitions ADD COLUMN avatar_config_json TEXT NOT NULL DEFAULT '{}'");
  }
  if (!tableHasColumn(db, "agent_definitions", "capability_profile_json")) {
    db.exec("ALTER TABLE agent_definitions ADD COLUMN capability_profile_json TEXT NOT NULL DEFAULT '{}'");
  }
  if (!tableHasColumn(db, "agent_definitions", "harness_config_json")) {
    db.exec(
      "ALTER TABLE agent_definitions ADD COLUMN harness_config_json TEXT NOT NULL DEFAULT '{\"approvalMode\":\"allow\",\"humanIntervention\":\"steer\",\"thinkingLevel\":\"medium\",\"maxToolCalls\":6}'",
    );
  }
  if (!tableHasColumn(db, "agent_definitions", "permission_policy_json")) {
    db.exec(
      "ALTER TABLE agent_definitions ADD COLUMN permission_policy_json TEXT NOT NULL DEFAULT '{\"repositoryAccess\":\"read_only\",\"memoryAccess\":\"inherit\",\"secretAccess\":\"runtime_bound_only\",\"allowedToolNames\":[\"search_repo\",\"read_file\",\"list_dir\",\"memory.read\",\"memory.search\",\"memory.retrieve\"],\"deniedToolNames\":[]}'",
    );
  }
}

function ensureBusinessTeamHierarchyColumns(db: DatabaseSyncType) {
  if (!tableHasColumn(db, "business_teams", "parent_business_team_id")) {
    db.exec("ALTER TABLE business_teams ADD COLUMN parent_business_team_id TEXT");
  }
  if (!tableHasColumn(db, "business_teams", "description")) {
    db.exec("ALTER TABLE business_teams ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  }
}

function ensureRuntimeSessionAgentDefinitionColumn(db: DatabaseSyncType) {
  if (!tableHasColumn(db, "runtime_sessions", "agent_definition_id")) {
    db.exec("ALTER TABLE runtime_sessions ADD COLUMN agent_definition_id TEXT");
  }
}

function ensureKnowledgeEntryColumns(db: DatabaseSyncType) {
  const legacyPrefix = ["open", "viking"].join("");
  const legacyEntriesTable = `${legacyPrefix}_knowledge_entries`;
  const legacyVersionsTable = `${legacyPrefix}_knowledge_entry_versions`;

  if (tableExists(db, legacyEntriesTable)) {
    if (!tableHasColumn(db, legacyEntriesTable, "knowledge_space_id")) {
      db.exec(`ALTER TABLE ${legacyEntriesTable} ADD COLUMN knowledge_space_id TEXT`);
    }
    if (!tableHasColumn(db, legacyEntriesTable, "updated_at")) {
      db.exec(`ALTER TABLE ${legacyEntriesTable} ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`);
      db.exec(`UPDATE ${legacyEntriesTable} SET updated_at = created_at WHERE updated_at = ''`);
    }
    if (!tableHasColumn(db, legacyEntriesTable, "updated_by")) {
      db.exec(`ALTER TABLE ${legacyEntriesTable} ADD COLUMN updated_by TEXT`);
    }
    if (!tableHasColumn(db, legacyEntriesTable, "revision")) {
      db.exec(`ALTER TABLE ${legacyEntriesTable} ADD COLUMN revision INTEGER NOT NULL DEFAULT 1`);
    }
    db.exec(`
      INSERT OR IGNORE INTO knowledge_entries (
        id, knowledge_space_id, layer, scope_key, skill_id, viking_uri, title, content_md,
        metadata_json, source_type, sync_status, sync_error, created_at, updated_at, updated_by, revision
      )
      SELECT
        id, knowledge_space_id, layer, scope_key, skill_id, viking_uri, title, content_md,
        metadata_json, source_type, sync_status, sync_error, created_at,
        COALESCE(NULLIF(updated_at, ''), created_at), updated_by, revision
      FROM ${legacyEntriesTable}
    `);
    db.exec(`DROP TABLE ${legacyEntriesTable}`);
  }

  if (tableExists(db, legacyVersionsTable)) {
    db.exec(`
      INSERT OR IGNORE INTO knowledge_entry_versions (
        id, entry_id, revision, knowledge_space_id, layer, scope_key, skill_id, viking_uri, title,
        content_md, metadata_json, source_type, sync_status, sync_error, created_at, created_by
      )
      SELECT
        id, entry_id, revision, knowledge_space_id, layer, scope_key, skill_id, viking_uri, title,
        content_md, metadata_json, source_type, sync_status, sync_error, created_at, created_by
      FROM ${legacyVersionsTable}
    `);
    db.exec(`DROP TABLE ${legacyVersionsTable}`);
  }

  if (!tableHasColumn(db, "knowledge_entries", "knowledge_space_id")) {
    db.exec("ALTER TABLE knowledge_entries ADD COLUMN knowledge_space_id TEXT");
  }
  if (!tableHasColumn(db, "knowledge_entries", "updated_at")) {
    db.exec("ALTER TABLE knowledge_entries ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
    db.exec("UPDATE knowledge_entries SET updated_at = created_at WHERE updated_at = ''");
  }
  if (!tableHasColumn(db, "knowledge_entries", "updated_by")) {
    db.exec("ALTER TABLE knowledge_entries ADD COLUMN updated_by TEXT");
  }
  if (!tableHasColumn(db, "knowledge_entries", "revision")) {
    db.exec("ALTER TABLE knowledge_entries ADD COLUMN revision INTEGER NOT NULL DEFAULT 1");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_entry_versions (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      knowledge_space_id TEXT,
      layer TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      skill_id TEXT,
      viking_uri TEXT NOT NULL,
      title TEXT NOT NULL,
      content_md TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      source_type TEXT NOT NULL,
      sync_status TEXT NOT NULL,
      sync_error TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT,
      UNIQUE(entry_id, revision)
    )
  `);
}

function ensureKnowledgeSpaceColumns(db: DatabaseSyncType) {
  if (!tableHasColumn(db, "knowledge_spaces", "knowledge_category")) {
    db.exec("ALTER TABLE knowledge_spaces ADD COLUMN knowledge_category TEXT NOT NULL DEFAULT 'domain'");
  }
  if (!tableHasColumn(db, "knowledge_spaces", "repository_name")) {
    db.exec("ALTER TABLE knowledge_spaces ADD COLUMN repository_name TEXT");
  }
  db.exec("UPDATE knowledge_spaces SET knowledge_category = 'global' WHERE knowledge_category = 'public'");
  db.exec("UPDATE knowledge_spaces SET knowledge_category = 'skill' WHERE knowledge_category = 'global' AND (viking_uri LIKE 'agentworld://knowledge/agent/knowledge/%' OR viking_uri LIKE 'agentworld://knowledge/agent/skills/%')");
  db.exec("UPDATE knowledge_spaces SET knowledge_category = 'codebase' WHERE knowledge_category IN ('code', 'repository', 'repo')");
}

function ensureSkillGovernanceColumns(db: DatabaseSyncType) {
  if (!tableHasColumn(db, "inspection_skills", "owner_business_team_id")) {
    db.exec("ALTER TABLE inspection_skills ADD COLUMN owner_business_team_id TEXT");
  }
  if (!tableHasColumn(db, "inspection_skills", "tags_json")) {
    db.exec("ALTER TABLE inspection_skills ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!tableHasColumn(db, "inspection_skills", "visibility")) {
    db.exec("ALTER TABLE inspection_skills ADD COLUMN visibility TEXT NOT NULL DEFAULT 'team'");
  }
  if (!tableHasColumn(db, "inspection_skills", "viking_uri")) {
    db.exec("ALTER TABLE inspection_skills ADD COLUMN viking_uri TEXT");
  }
}

function ensureRepositoryProfileActivityIndex(db: DatabaseSyncType) {
  if (tableHasColumn(db, "repository_profiles", "activity_index")) return;
  if (!tableHasColumn(db, "repository_profiles", "activity_score")) return;

  db.exec("ALTER TABLE repository_profiles ADD COLUMN activity_index INTEGER NOT NULL DEFAULT 0");
  db.exec("UPDATE repository_profiles SET activity_index = activity_score WHERE activity_index = 0");
}

function ensureAgentTeamCatalogColumns(db: DatabaseSyncType) {
  if (!tableHasColumn(db, "agent_teams", "orchestration_prompt")) {
    db.exec("ALTER TABLE agent_teams ADD COLUMN orchestration_prompt TEXT NOT NULL DEFAULT ''");
  }
  if (!tableHasColumn(db, "agent_teams", "workflow_definition_json")) {
    db.exec("ALTER TABLE agent_teams ADD COLUMN workflow_definition_json TEXT NOT NULL DEFAULT '{}'");
  }
  if (!tableHasColumn(db, "agent_teams", "updated_at")) {
    db.exec("ALTER TABLE agent_teams ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
    db.exec("UPDATE agent_teams SET updated_at = created_at WHERE updated_at = ''");
  }
}

function ensureBuiltInProviderAdapterDefinitions(db: DatabaseSyncType) {
  for (const adapter of builtInProviderAdapterDefinitions) {
    const current = db
      .prepare("SELECT id FROM provider_adapter_definitions WHERE id = ?")
      .get(adapter.id) as { id: string } | undefined;
    if (current) continue;

    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO provider_adapter_definitions (id, name, adapter_type, entry_ref, version, lifecycle, capabilities_json, config_schema_json, secret_refs_json, permission_refs_json, health_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      adapter.id,
      adapter.name,
      adapter.adapterType,
      adapter.entryRef,
      adapter.version,
      adapter.lifecycle,
      adapter.capabilitiesJson,
      adapter.configSchemaJson,
      adapter.secretRefsJson,
      adapter.permissionRefsJson,
      adapter.healthStatus,
      now,
      now,
    );
  }
}

export function getDb() {
  if (!database) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    archiveIncompatibleDatabaseIfNeeded();
    database = new DatabaseSync(DB_PATH);
    database.exec(schemaSql);
    ensureBusinessTeamHierarchyColumns(database);
    ensureAgentTeamCatalogColumns(database);
    ensureAgentDefinitionHarnessColumns(database);
    ensureRuntimeSessionAgentDefinitionColumn(database);
    ensureKnowledgeSpaceColumns(database);
    ensureKnowledgeEntryColumns(database);
    ensureSkillGovernanceColumns(database);
    normalizePersistedKnowledgeUris(database);
    ensureRepositoryProfileActivityIndex(database);
    ensureBuiltInProviderAdapterDefinitions(database);
  }

  return database;
}

export function queryAll<T extends Row>(sql: string, ...params: SQLInputValue[]) {
  return getDb()
    .prepare(sql)
    .all(...params)
    .map((row) => camelizeRow<T>(row as Row))
    .filter((row): row is T => row !== null);
}

export function queryOne<T extends Row>(sql: string, ...params: SQLInputValue[]) {
  const row = getDb().prepare(sql).get(...params) as Row | undefined;
  return camelizeRow<T>(row) ?? null;
}

export function execute(sql: string, ...params: SQLInputValue[]) {
  return getDb().prepare(sql).run(...params);
}

export function refreshDatabase() {
  database = null;
  return getDb();
}

export function getDatabasePath() {
  return DB_PATH;
}
