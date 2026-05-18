import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync as DatabaseSyncType, SQLInputValue } from "node:sqlite";

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

export type OpenVikingKnowledgeEntry = {
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

const schemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenant_spaces (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  quota_limit_json TEXT NOT NULL,
  model_whitelist_json TEXT NOT NULL,
  global_guardrails_json TEXT NOT NULL,
  default_execution_policy_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS business_teams (
  id TEXT PRIMARY KEY,
  tenant_space_id TEXT NOT NULL,
  parent_business_team_id TEXT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  balance REAL NOT NULL,
  credit_limit REAL NOT NULL,
  private_tool_refs_json TEXT NOT NULL,
  private_memory_namespace TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  tenant_space_id TEXT NOT NULL,
  business_team_id TEXT NOT NULL,
  employee_no TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_permission_grants (
  id TEXT PRIMARY KEY,
  business_team_id TEXT NOT NULL,
  member_id TEXT,
  principal_type TEXT NOT NULL,
  role_key TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_scope TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  effect TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_asset_grants (
  id TEXT PRIMARY KEY,
  business_team_id TEXT NOT NULL,
  member_id TEXT,
  asset_type TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  permission_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_policies (
  id TEXT PRIMARY KEY,
  tenant_space_id TEXT,
  business_team_id TEXT,
  team_id TEXT,
  name TEXT NOT NULL,
  system_instruction TEXT NOT NULL,
  tool_policy_json TEXT NOT NULL,
  approval_policy_json TEXT NOT NULL,
  budget_policy_json TEXT NOT NULL,
  output_policy_json TEXT NOT NULL,
  security_policy_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_teams (
  id TEXT PRIMARY KEY,
  business_team_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  leader_agent_id TEXT,
  workflow_type TEXT NOT NULL,
  orchestration_prompt TEXT NOT NULL DEFAULT '',
  workflow_definition_json TEXT NOT NULL DEFAULT '{}',
  input_schema_json TEXT NOT NULL,
  output_schema_json TEXT NOT NULL,
  max_concurrency INTEGER NOT NULL,
  timeout_ms INTEGER NOT NULL,
  success_rate_threshold REAL NOT NULL,
  pricing_model_json TEXT NOT NULL,
  visibility TEXT NOT NULL,
  default_execution_policy_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  persona_prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  short_term_window INTEGER NOT NULL,
  rag_config_json TEXT NOT NULL,
  tool_bindings_json TEXT NOT NULL,
  memory_scope TEXT NOT NULL,
  safety_policy_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  agent_definition_id TEXT NOT NULL,
  member_role TEXT NOT NULL,
  work_instruction TEXT NOT NULL,
  position INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_team_shares (
  id TEXT PRIMARY KEY,
  agent_team_id TEXT NOT NULL,
  business_team_id TEXT NOT NULL,
  access_level TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_definitions (
  id TEXT PRIMARY KEY,
  tenant_space_id TEXT NOT NULL,
  owner_business_team_id TEXT,
  owner_user_id TEXT NOT NULL,
  source_agent_id TEXT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  default_provider_profile_id TEXT,
  default_runtime_binding_id TEXT,
  tool_bindings_json TEXT NOT NULL,
  harness_config_json TEXT NOT NULL,
  permission_policy_json TEXT NOT NULL,
  memory_scope TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  visibility TEXT NOT NULL,
  status TEXT NOT NULL,
  validation_status TEXT NOT NULL,
  last_validated_at TEXT,
  last_validation_summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_definition_shares (
  id TEXT PRIMARY KEY,
  agent_definition_id TEXT NOT NULL,
  business_team_id TEXT NOT NULL,
  access_level TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_profiles (
  id TEXT PRIMARY KEY,
  tenant_space_id TEXT NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_style TEXT NOT NULL,
  default_model TEXT NOT NULL,
  models_json TEXT NOT NULL,
  api_key_ref TEXT NOT NULL,
  config_json TEXT NOT NULL,
  is_enabled INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_endpoints (
  id TEXT PRIMARY KEY,
  tenant_space_id TEXT NOT NULL,
  business_team_id TEXT,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  runtime_kind TEXT NOT NULL,
  health_status TEXT NOT NULL,
  agent_catalog_json TEXT NOT NULL,
  provider_catalog_json TEXT NOT NULL,
  concurrency_limit INTEGER NOT NULL,
  active_run_count INTEGER NOT NULL,
  last_discovered_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_runtime_bindings (
  id TEXT PRIMARY KEY,
  tenant_space_id TEXT NOT NULL,
  business_team_id TEXT,
  adapter_definition_id TEXT NOT NULL,
  name TEXT NOT NULL,
  runtime_kind TEXT NOT NULL,
  base_url TEXT NOT NULL,
  command TEXT NOT NULL,
  workspace_root TEXT NOT NULL,
  default_provider_profile_id TEXT,
  api_key_ref TEXT NOT NULL,
  config_json TEXT NOT NULL,
  is_enabled INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_grants (
  id TEXT PRIMARY KEY,
  provider_team_id TEXT NOT NULL,
  consumer_business_team_id TEXT NOT NULL,
  pricing_model_json TEXT NOT NULL,
  sla_json TEXT NOT NULL,
  access_scope_json TEXT NOT NULL,
  service_account_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_catalog_listings (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  resume_json TEXT NOT NULL,
  recruitment_mode TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_templates (
  id TEXT PRIMARY KEY,
  business_team_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  schedule_kind TEXT NOT NULL,
  cadence TEXT NOT NULL,
  next_run_at TEXT,
  input_payload_json TEXT NOT NULL,
  is_enabled INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  case_key TEXT NOT NULL,
  plugin_id TEXT,
  team_id TEXT NOT NULL,
  environment_id TEXT,
  planner_mode TEXT NOT NULL,
  summary TEXT NOT NULL,
  input_schema_json TEXT NOT NULL,
  default_input_json TEXT NOT NULL,
  memory_layers_json TEXT NOT NULL,
  output_targets_json TEXT NOT NULL,
  nodes_json TEXT NOT NULL,
  webhook_parser_ref TEXT,
  visibility TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_blueprints (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  visibility TEXT NOT NULL,
  owner_business_team_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  environment_id TEXT,
  provider_adapter_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  trigger_json TEXT NOT NULL,
  input_schema_json TEXT NOT NULL,
  environment_selector_json TEXT NOT NULL,
  agent_team_run_plan_json TEXT NOT NULL,
  memory_policy_json TEXT NOT NULL,
  provider_policy_json TEXT NOT NULL,
  permission_policy_json TEXT NOT NULL,
  result_schema_json TEXT NOT NULL,
  output_policy_json TEXT NOT NULL,
  dashboard_policy_json TEXT NOT NULL,
  execution_policy_json TEXT NOT NULL,
  archive_policy_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  tenant_space_id TEXT NOT NULL,
  business_team_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  blueprint_id TEXT,
  blueprint_version INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT,
  parent_task_run_id TEXT,
  run_state TEXT NOT NULL DEFAULT 'running',
  environment_snapshot_id TEXT,
  permission_snapshot_json TEXT NOT NULL DEFAULT '{}',
  agent_team_run_plan_json TEXT NOT NULL DEFAULT '{}',
  execution_policy_json TEXT NOT NULL DEFAULT '{}',
  access_grant_id TEXT,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL,
  input_payload_json TEXT NOT NULL,
  output_payload_json TEXT,
  cost_estimate REAL NOT NULL,
  cost_actual REAL NOT NULL,
  trace_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_runs_blueprint_idempotency
ON task_runs (blueprint_id, idempotency_key)
WHERE blueprint_id IS NOT NULL AND idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS task_run_plans (
  id TEXT PRIMARY KEY,
  task_run_id TEXT NOT NULL,
  planner_mode TEXT NOT NULL,
  dag_json TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_run_nodes (
  id TEXT PRIMARY KEY,
  task_run_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  node_key TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  depends_on_json TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL,
  max_attempts INTEGER NOT NULL,
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS trace_spans (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  parent_span_id TEXT,
  task_run_id TEXT NOT NULL,
  node_id TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  attributes_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_logs (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  task_run_id TEXT NOT NULL,
  node_id TEXT,
  seq INTEGER NOT NULL,
  phase TEXT NOT NULL,
  fold_group TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_run_id TEXT NOT NULL,
  agent_run_id TEXT,
  event_type TEXT NOT NULL,
  event_time TEXT NOT NULL,
  visibility TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  raw_payload_ref TEXT,
  parent_event_id TEXT
);

CREATE TABLE IF NOT EXISTS task_run_interventions (
  id TEXT PRIMARY KEY,
  task_run_id TEXT NOT NULL,
  node_id TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_action TEXT NOT NULL,
  resolution_note TEXT,
  requested_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS runtime_sessions (
  id TEXT PRIMARY KEY,
  tenant_space_id TEXT NOT NULL,
  business_team_id TEXT NOT NULL,
  agent_team_id TEXT,
  agent_definition_id TEXT,
  runtime_binding_id TEXT NOT NULL,
  provider_profile_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  title TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  last_error TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_session_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  role TEXT NOT NULL,
  content_json TEXT NOT NULL,
  visibility TEXT NOT NULL,
  turn_index INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_id TEXT,
  actor_id TEXT,
  actor_name TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  visibility TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repository_profiles (
  id TEXT PRIMARY KEY,
  business_team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  branch TEXT NOT NULL,
  activity_index INTEGER NOT NULL,
  last_task_run_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS developer_profiles (
  id TEXT PRIMARY KEY,
  business_team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  focus TEXT NOT NULL,
  last_active_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  business_team_id TEXT,
  name TEXT NOT NULL,
  transport TEXT NOT NULL,
  command TEXT NOT NULL,
  url TEXT NOT NULL,
  auth_ref TEXT NOT NULL,
  tool_allowlist_json TEXT NOT NULL,
  status TEXT NOT NULL,
  last_health_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS connector_profiles (
  id TEXT PRIMARY KEY,
  business_team_id TEXT,
  name TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  secret_ref TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS codebase_profiles (
  id TEXT PRIMARY KEY,
  business_team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  repository_url TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  visibility TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS codebase_operator_tokens (
  id TEXT PRIMARY KEY,
  codebase_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  token_ref TEXT NOT NULL,
  role TEXT NOT NULL,
  permission_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_environments (
  id TEXT PRIMARY KEY,
  business_team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  repository_provider TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  repository_url TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  executor_ref TEXT NOT NULL,
  private_key_ref TEXT NOT NULL,
  working_directory TEXT NOT NULL,
  sandbox_profile_json TEXT NOT NULL,
  memory_layer_refs_json TEXT NOT NULL,
  visibility TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS environment_templates (
  id TEXT PRIMARY KEY,
  business_team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  environment_type TEXT NOT NULL,
  repository_selector_json TEXT NOT NULL,
  executor_policy_json TEXT NOT NULL,
  secret_bindings_json TEXT NOT NULL,
  workspace_policy_json TEXT NOT NULL,
  sandbox_policy_json TEXT NOT NULL,
  memory_defaults_json TEXT NOT NULL,
  visibility TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS environment_snapshots (
  id TEXT PRIMARY KEY,
  task_run_id TEXT NOT NULL,
  template_id TEXT,
  environment_id TEXT,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  business_team_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path_key TEXT NOT NULL,
  method TEXT NOT NULL,
  request_schema_json TEXT NOT NULL,
  secret_hint TEXT NOT NULL,
  is_enabled INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS plugin_manifests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  capability TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  mount_point TEXT NOT NULL,
  config_schema TEXT NOT NULL,
  required_secret_refs_json TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  health_check TEXT NOT NULL,
  extension_only INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_adapter_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  adapter_type TEXT NOT NULL,
  entry_ref TEXT NOT NULL,
  version TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  config_schema_json TEXT NOT NULL,
  secret_refs_json TEXT NOT NULL,
  permission_refs_json TEXT NOT NULL,
  health_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inspection_skills (
  id TEXT PRIMARY KEY,
  owner_business_team_id TEXT,
  name TEXT NOT NULL,
  layer TEXT NOT NULL,
  description TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  visibility TEXT NOT NULL DEFAULT 'team',
  viking_uri TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  prompt_md TEXT NOT NULL,
  heuristics_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS openviking_knowledge_entries (
  id TEXT PRIMARY KEY,
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
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_layers (
  id TEXT PRIMARY KEY,
  layer_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL,
  viking_uri TEXT NOT NULL,
  parent_uri TEXT,
  description TEXT NOT NULL,
  load_order INTEGER NOT NULL,
  retention_policy_json TEXT NOT NULL,
  is_enabled INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_spaces (
  id TEXT PRIMARY KEY,
  tenant_space_id TEXT NOT NULL,
  business_team_id TEXT,
  agent_team_id TEXT,
  project_key TEXT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  space_type TEXT NOT NULL,
  viking_uri TEXT NOT NULL,
  description TEXT NOT NULL,
  visibility TEXT NOT NULL,
  status TEXT NOT NULL,
  retention_policy_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_space_bindings (
  id TEXT PRIMARY KEY,
  knowledge_space_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  access_level TEXT NOT NULL,
  load_order INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merge_request_comments (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  repository_slug TEXT NOT NULL,
  repository_clone_url TEXT,
  mr_iid TEXT NOT NULL,
  mr_title TEXT NOT NULL,
  mr_url TEXT,
  source_branch TEXT,
  target_branch TEXT,
  commit_sha TEXT,
  author TEXT,
  status TEXT NOT NULL,
  diff_status TEXT NOT NULL,
  comment_status TEXT NOT NULL,
  comment_url TEXT,
  comment_markdown TEXT,
  callback_base_url TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS inspection_findings (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  knowledge_layer TEXT NOT NULL,
  severity TEXT NOT NULL,
  file_path TEXT,
  line_number INTEGER,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  suggestion TEXT,
  feedback_token TEXT NOT NULL UNIQUE,
  feedback_state TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  task_run_id TEXT NOT NULL,
  source_agent TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence REAL NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  skill_refs_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL,
  publication_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inspection_feedback (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  inspection_id TEXT NOT NULL,
  token TEXT NOT NULL,
  verdict TEXT NOT NULL,
  note TEXT,
  source_ip TEXT,
  knowledge_uri TEXT,
  created_at TEXT NOT NULL
);
`;

let database: DatabaseSyncType | null = null;

function ensureAgentDefinitionHarnessColumns(db: DatabaseSyncType) {
  if (!tableHasColumn(db, "agent_definitions", "harness_config_json")) {
    db.exec(
      "ALTER TABLE agent_definitions ADD COLUMN harness_config_json TEXT NOT NULL DEFAULT '{\"approvalMode\":\"allow\",\"humanIntervention\":\"steer\",\"thinkingLevel\":\"medium\",\"maxToolCalls\":6}'",
    );
  }
  if (!tableHasColumn(db, "agent_definitions", "permission_policy_json")) {
    db.exec(
      "ALTER TABLE agent_definitions ADD COLUMN permission_policy_json TEXT NOT NULL DEFAULT '{\"repositoryAccess\":\"read_only\",\"memoryAccess\":\"inherit\",\"secretAccess\":\"runtime_bound_only\",\"allowedToolNames\":[\"search_repo\",\"read_file\",\"list_dir\"],\"deniedToolNames\":[]}'",
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

function ensureOpenVikingKnowledgeColumns(db: DatabaseSyncType) {
  if (!tableHasColumn(db, "openviking_knowledge_entries", "knowledge_space_id")) {
    db.exec("ALTER TABLE openviking_knowledge_entries ADD COLUMN knowledge_space_id TEXT");
  }
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
    ensureOpenVikingKnowledgeColumns(database);
    ensureSkillGovernanceColumns(database);
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
