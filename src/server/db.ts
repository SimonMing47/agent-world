import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";

type Row = Record<string, unknown>;

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
  slug: string;
  name: string;
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
  activityScore: number;
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

export type CodeReviewSkill = {
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

export type MergeRequestReview = {
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

export type ReviewFinding = {
  id: string;
  reviewId: string;
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

export type ReviewFeedback = {
  id: string;
  findingId: string;
  reviewId: string;
  token: string;
  verdict: string;
  note: string | null;
  sourceIp: string | null;
  knowledgeUri: string | null;
  createdAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "agentworld.db");

const legacySchemaTables = [
  "worlds",
  "kingdoms",
  "quests",
  "quest_nodes",
  "contracts",
  "contract_events",
  "tavern_listings",
  "harness_profiles",
];

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

function tableExists(db: DatabaseSync, table: string) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { name: string } | undefined;
  return Boolean(row);
}

function tableHasColumn(db: DatabaseSync, table: string, column: string) {
  if (!tableExists(db, table)) return true;
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function databaseNeedsSchemaReset(db: DatabaseSync) {
  if (legacySchemaTables.some((table) => tableExists(db, table))) return true;
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

CREATE TABLE IF NOT EXISTS business_teams (
  id TEXT PRIMARY KEY,
  tenant_space_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
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
  activity_score INTEGER NOT NULL,
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

CREATE TABLE IF NOT EXISTS code_review_skills (
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

CREATE TABLE IF NOT EXISTS merge_request_reviews (
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

CREATE TABLE IF NOT EXISTS review_findings (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS review_feedback (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  token TEXT NOT NULL,
  verdict TEXT NOT NULL,
  note TEXT,
  source_ip TEXT,
  knowledge_uri TEXT,
  created_at TEXT NOT NULL
);
`;

let database: DatabaseSync | null = null;

function seed(db: DatabaseSync) {
  const existing = db.prepare("SELECT COUNT(*) as count FROM tenant_spaces").get() as {
    count: number;
  };

  if (existing.count > 0) return;

  const now = Date.now();
  const iso = (offsetMs = 0) => new Date(now + offsetMs).toISOString();

  const insertTenantSpace = db.prepare(
    "INSERT INTO tenant_spaces (id, slug, name, owner_user_id, status, quota_limit_json, model_whitelist_json, global_guardrails_json, default_execution_policy_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertBusinessTeam = db.prepare(
    "INSERT INTO business_teams (id, tenant_space_id, slug, name, owner_user_id, status, balance, credit_limit, private_tool_refs_json, private_memory_namespace, policy_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertExecutionPolicy = db.prepare(
    "INSERT INTO execution_policies (id, tenant_space_id, business_team_id, team_id, name, system_instruction, tool_policy_json, approval_policy_json, budget_policy_json, output_policy_json, security_policy_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertTeam = db.prepare(
    "INSERT INTO agent_teams (id, business_team_id, slug, name, description, leader_agent_id, workflow_type, input_schema_json, output_schema_json, max_concurrency, timeout_ms, success_rate_threshold, pricing_model_json, visibility, default_execution_policy_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertAgent = db.prepare(
    "INSERT INTO agents (id, team_id, slug, name, role, persona_prompt, model, short_term_window, rag_config_json, tool_bindings_json, memory_scope, safety_policy_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertProvider = db.prepare(
    "INSERT INTO provider_profiles (id, tenant_space_id, name, base_url, api_style, default_model, models_json, api_key_ref, config_json, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertProviderRuntimeBinding = db.prepare(
    "INSERT INTO provider_runtime_bindings (id, tenant_space_id, business_team_id, adapter_definition_id, name, runtime_kind, base_url, command, workspace_root, default_provider_profile_id, api_key_ref, config_json, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertRuntime = db.prepare(
    "INSERT INTO runtime_endpoints (id, tenant_space_id, business_team_id, name, base_url, runtime_kind, health_status, agent_catalog_json, provider_catalog_json, concurrency_limit, active_run_count, last_discovered_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertAccessGrant = db.prepare(
    "INSERT INTO access_grants (id, provider_team_id, consumer_business_team_id, pricing_model_json, sla_json, access_scope_json, service_account_ref, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertListing = db.prepare(
    "INSERT INTO service_catalog_listings (id, team_id, resume_json, recruitment_mode, tags_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertSchedule = db.prepare(
    "INSERT INTO schedule_templates (id, business_team_id, team_id, name, schedule_kind, cadence, next_run_at, input_payload_json, is_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertTaskRun = db.prepare(
    "INSERT INTO task_runs (id, tenant_space_id, business_team_id, team_id, access_grant_id, source_type, source_ref, status, priority, input_payload_json, output_payload_json, cost_estimate, cost_actual, trace_id, requested_by, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertPlan = db.prepare(
    "INSERT INTO task_run_plans (id, task_run_id, planner_mode, dag_json, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertNode = db.prepare(
    "INSERT INTO task_run_nodes (id, task_run_id, plan_id, node_key, agent_id, depends_on_json, input_json, output_json, status, attempt_count, max_attempts, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertSpan = db.prepare(
    "INSERT INTO trace_spans (id, trace_id, parent_span_id, task_run_id, node_id, kind, status, started_at, ended_at, attributes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertEvent = db.prepare(
    "INSERT INTO event_logs (id, trace_id, task_run_id, node_id, seq, phase, fold_group, title, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertIntervention = db.prepare(
    "INSERT INTO task_run_interventions (id, task_run_id, node_id, kind, status, requested_action, resolution_note, requested_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertRepo = db.prepare(
    "INSERT INTO repository_profiles (id, business_team_id, name, provider, branch, activity_score, last_task_run_count) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertDeveloper = db.prepare(
    "INSERT INTO developer_profiles (id, business_team_id, name, focus, last_active_at) VALUES (?, ?, ?, ?, ?)",
  );
  const insertWebhook = db.prepare(
    "INSERT INTO webhook_endpoints (id, business_team_id, team_id, name, path_key, method, request_schema_json, secret_hint, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const updateLeader = db.prepare(
    "UPDATE agent_teams SET leader_agent_id = ? WHERE id = ?",
  );

  const tenantSpaceId = randomUUID();
  const platformBusinessTeamId = randomUUID();
  const releaseBusinessTeamId = randomUUID();

  const tenantSpaceExecutionPolicyId = randomUUID();
  const platformExecutionPolicyId = randomUUID();
  const releaseExecutionPolicyId = randomUUID();
  const serviceCatalogExecutionPolicyId = randomUUID();

  insertTenantSpace.run(
    tenantSpaceId,
    "open-frontier",
    "Open Frontier",
    "ava",
    "active",
    JSON.stringify({ monthlyUsd: 5000, maxRunningTasks: 40 }),
    JSON.stringify(["gpt-5.4", "gpt-5.4-mini", "o4-mini"]),
    JSON.stringify({
      promptScan: true,
      outputScan: true,
      maxTaskUsd: 120,
      allowPublicListings: true,
    }),
    tenantSpaceExecutionPolicyId,
    iso(-1000 * 60 * 60 * 24 * 20),
  );

  insertBusinessTeam.run(
    platformBusinessTeamId,
    tenantSpaceId,
    "platform-team",
    "Platform Team",
    "ming",
    "active",
    1820,
    500,
    JSON.stringify(["repo.readonly", "incident.index", "search.web"]),
    "tenant/open-frontier/platform",
    JSON.stringify({ preferredProvider: "openai-primary", spendCeilingUsd: 1800 }),
    iso(-1000 * 60 * 60 * 24 * 15),
  );
  insertBusinessTeam.run(
    releaseBusinessTeamId,
    tenantSpaceId,
    "release-team",
    "Release Team",
    "sophia",
    "active",
    910,
    300,
    JSON.stringify(["github.pr", "repo.diff", "ci.read"]),
    "tenant/open-frontier/release",
    JSON.stringify({ preferredProvider: "azure-fallback", spendCeilingUsd: 950 }),
    iso(-1000 * 60 * 60 * 24 * 12),
  );

  insertExecutionPolicy.run(
    tenantSpaceExecutionPolicyId,
    tenantSpaceId,
    null,
    null,
    "租户基线运行约束",
    "Always produce structured operational output. Explain plan changes. Escalate risky actions.",
    JSON.stringify({
      allowed: ["search_web", "read_repo", "openai_chat", "pi_runtime"],
      blocked: ["raw_network"],
      approvalRequired: ["write_repo", "shell_exec"],
    }),
    JSON.stringify({ requiredOn: ["write_repo", "secret_access"] }),
    JSON.stringify({ maxRuntimeMs: 20 * 60 * 1000, maxSteps: 18, maxToolCalls: 24 }),
    JSON.stringify({ collapseThinkingByDefault: true, structuredOutput: true, defaultLocale: "zh-CN" }),
    JSON.stringify({ promptScan: true, outputScan: true, redactSecrets: true }),
    iso(-1000 * 60 * 60 * 24 * 20),
  );
  insertExecutionPolicy.run(
    platformExecutionPolicyId,
    tenantSpaceId,
    platformBusinessTeamId,
    null,
    "平台只读运行约束",
    "Prefer read-only investigation. Any production-changing action must wait for a human gate.",
    JSON.stringify({
      allowed: ["search_web", "read_repo", "incident_index", "openai_chat"],
      blocked: ["write_repo"],
      approvalRequired: ["shell_exec"],
    }),
    JSON.stringify({ requiredOn: ["shell_exec"] }),
    JSON.stringify({ maxRuntimeMs: 15 * 60 * 1000, maxSteps: 14, maxToolCalls: 18 }),
    JSON.stringify({ collapseThinkingByDefault: true, structuredOutput: true, defaultLocale: "zh-CN" }),
    JSON.stringify({ promptScan: true, outputScan: true }),
    iso(-1000 * 60 * 60 * 24 * 14),
  );
  insertExecutionPolicy.run(
    releaseExecutionPolicyId,
    tenantSpaceId,
    releaseBusinessTeamId,
    null,
    "发布回写运行约束",
    "Review repository intent carefully. Never merge or write without explicit approval.",
    JSON.stringify({
      allowed: ["read_repo", "github_pr", "ci_read", "openai_chat"],
      blocked: [],
      approvalRequired: ["write_repo", "merge_pull_request"],
    }),
    JSON.stringify({ requiredOn: ["write_repo", "merge_pull_request"] }),
    JSON.stringify({ maxRuntimeMs: 18 * 60 * 1000, maxSteps: 16, maxToolCalls: 20 }),
    JSON.stringify({ collapseThinkingByDefault: true, structuredOutput: true, defaultLocale: "zh-CN" }),
    JSON.stringify({ promptScan: true, outputScan: true }),
    iso(-1000 * 60 * 60 * 24 * 14),
  );
  insertExecutionPolicy.run(
    serviceCatalogExecutionPolicyId,
    tenantSpaceId,
    null,
    null,
    "服务目录只读运行约束",
    "服务目录调用默认只读；只有跨团队授权明确放开时才允许更高风险动作。",
    JSON.stringify({
      allowed: ["openai_chat", "search_web", "read_repo"],
      blocked: ["write_repo", "shell_exec"],
      approvalRequired: [],
    }),
    JSON.stringify({ requiredOn: [] }),
    JSON.stringify({ maxRuntimeMs: 10 * 60 * 1000, maxSteps: 10, maxToolCalls: 12 }),
    JSON.stringify({ collapseThinkingByDefault: true, structuredOutput: true, defaultLocale: "zh-CN" }),
    JSON.stringify({ promptScan: true, outputScan: true }),
    iso(-1000 * 60 * 60 * 24 * 14),
  );

  const incidentTeamId = randomUUID();
  const researchTeamId = randomUUID();
  const reviewTeamId = randomUUID();

  insertTeam.run(
    incidentTeamId,
    platformBusinessTeamId,
    "incident-observatory",
    "Incident Observatory",
    "Reads signals, groups incident evidence, and produces calm operational digests.",
    null,
    "sequential",
    JSON.stringify({ type: "object", required: ["window", "services"] }),
    JSON.stringify({ type: "object", required: ["summary", "risks", "owners"] }),
    2,
    15 * 60 * 1000,
    0.92,
    JSON.stringify({ baseUsd: 0.2, tokenMultiplier: 1.05 }),
    "private",
    platformExecutionPolicyId,
    iso(-1000 * 60 * 60 * 24 * 10),
  );
  insertTeam.run(
    researchTeamId,
    platformBusinessTeamId,
    "research-relay",
    "Research Relay",
    "Plans multi-step research tasks and returns structured findings for other business teams.",
    null,
    "dag",
    JSON.stringify({ type: "object", required: ["brief", "audience"] }),
    JSON.stringify({ type: "object", required: ["findings", "recommendations"] }),
    3,
    20 * 60 * 1000,
    0.9,
    JSON.stringify({ baseUsd: 0.35, tokenMultiplier: 1.15 }),
    "public",
    serviceCatalogExecutionPolicyId,
    iso(-1000 * 60 * 60 * 24 * 9),
  );
  insertTeam.run(
    reviewTeamId,
    releaseBusinessTeamId,
    "pr-vanguard",
    "PR Vanguard",
    "Reviews pull requests, assesses release risk, and stops before write-back without approval.",
    null,
    "parallel",
    JSON.stringify({ type: "object", required: ["repository", "pullRequest"] }),
    JSON.stringify({ type: "object", required: ["decision", "commentary", "nextActions"] }),
    2,
    18 * 60 * 1000,
    0.95,
    JSON.stringify({ baseUsd: 0.25, tokenMultiplier: 1.1 }),
    "public",
    releaseExecutionPolicyId,
    iso(-1000 * 60 * 60 * 24 * 8),
  );

  const scoutAgentId = randomUUID();
  const analystAgentId = randomUUID();
  const leaderAgentId = randomUUID();
  const researcherAgentId = randomUUID();
  const reviewerAgentId = randomUUID();
  const stewardAgentId = randomUUID();

  insertAgent.run(
    scoutAgentId,
    incidentTeamId,
    "signal-scout",
    "Signal Scout",
    "researcher",
    "Scan signals, detect clusters, and bring only relevant evidence forward.",
    "gpt-5.4-mini",
    8,
    JSON.stringify({ retrieval: "fts", topK: 8 }),
    JSON.stringify(["search_web", "incident_index"]),
    "team_shared",
    JSON.stringify({ redactSecrets: true }),
    "active",
    iso(-1000 * 60 * 60 * 24 * 7),
  );
  insertAgent.run(
    analystAgentId,
    incidentTeamId,
    "failure-analyst",
    "Failure Analyst",
    "analyst",
    "Turn grouped evidence into incident hypotheses, risks, and owner suggestions.",
    "gpt-5.4",
    10,
    JSON.stringify({ retrieval: "fts", topK: 6 }),
    JSON.stringify(["read_repo", "search_web"]),
    "team_shared",
    JSON.stringify({ requireStructuredOutput: true }),
    "active",
    iso(-1000 * 60 * 60 * 24 * 7),
  );
  insertAgent.run(
    leaderAgentId,
    researchTeamId,
    "leader-meridian",
    "Leader Meridian",
    "leader",
    "Break research briefs into a safe and efficient DAG. Keep the plan short and explicit.",
    "gpt-5.4",
    12,
    JSON.stringify({ retrieval: "fts", topK: 10 }),
    JSON.stringify(["search_web", "read_repo"]),
    "team_shared",
    JSON.stringify({ requireStructuredPlan: true }),
    "active",
    iso(-1000 * 60 * 60 * 24 * 7),
  );
  insertAgent.run(
    researcherAgentId,
    researchTeamId,
    "market-scout",
    "Market Scout",
    "researcher",
    "Gather sources, extract evidence, and keep every finding attributable.",
    "gpt-5.4-mini",
    10,
    JSON.stringify({ retrieval: "fts", topK: 10 }),
    JSON.stringify(["search_web", "read_repo"]),
    "team_shared",
    JSON.stringify({ citeSources: true }),
    "active",
    iso(-1000 * 60 * 60 * 24 * 7),
  );
  insertAgent.run(
    reviewerAgentId,
    reviewTeamId,
    "release-reviewer",
    "Release Reviewer",
    "reviewer",
    "Review changes, analyze risk, and explain the release decision clearly.",
    "gpt-5.4",
    10,
    JSON.stringify({ retrieval: "fts", topK: 8 }),
    JSON.stringify(["github_pr", "read_repo", "ci_read"]),
    "team_shared",
    JSON.stringify({ requireEvidence: true }),
    "active",
    iso(-1000 * 60 * 60 * 24 * 7),
  );
  insertAgent.run(
    stewardAgentId,
    reviewTeamId,
    "merge-steward",
    "Merge Steward",
    "executor",
    "Prepare repository write-back steps, but always stop for a human before acting.",
    "gpt-5.4-mini",
    6,
    JSON.stringify({ retrieval: "fts", topK: 4 }),
    JSON.stringify(["write_repo", "merge_pull_request"]),
    "private",
    JSON.stringify({ approvalRequired: true }),
    "active",
    iso(-1000 * 60 * 60 * 24 * 7),
  );

  updateLeader.run(leaderAgentId, researchTeamId);
  const openAiProviderId = randomUUID();
  const azureProviderId = randomUUID();
  const glmProviderId = randomUUID();

  insertProvider.run(
    openAiProviderId,
    tenantSpaceId,
    "OpenAI Primary",
    "https://api.openai.com/v1",
    "openai",
    "gpt-5.4",
    JSON.stringify(["gpt-5.4", "gpt-5.4-mini", "o4-mini"]),
    "env:OPENAI_API_KEY",
    JSON.stringify({
      supportsChatCompletions: true,
      supportsResponsesApi: true,
      headers: {},
    }),
    1,
    iso(-1000 * 60 * 60 * 24 * 6),
    iso(-1000 * 60 * 60 * 24 * 6),
  );
  insertProvider.run(
    azureProviderId,
    tenantSpaceId,
    "Azure Fallback",
    "https://example-azure-openai.local/v1",
    "openai",
    "gpt-5.4-mini",
    JSON.stringify(["gpt-5.4-mini"]),
    "env:AZURE_OPENAI_API_KEY",
    JSON.stringify({
      apiVersion: "2024-10-21",
      supportsChatCompletions: true,
      supportsResponsesApi: false,
    }),
    1,
    iso(-1000 * 60 * 60 * 24 * 6),
    iso(-1000 * 60 * 60 * 24 * 6),
  );
  insertProvider.run(
    glmProviderId,
    tenantSpaceId,
    "GLM-5.1 Coding",
    "https://open.bigmodel.cn/api/coding/paas/v4",
    "openai-compatible",
    "GLM-5.1",
    JSON.stringify(["GLM-5.1"]),
    "env:AGENTWORLD_GLM_API_KEY",
    JSON.stringify({
      piApi: "openai-completions",
      supportsChatCompletions: true,
      supportsResponsesApi: false,
      contextWindow: 128000,
      maxTokens: 16384,
      reasoning: true,
      headers: {},
    }),
    1,
    iso(-1000 * 60 * 60 * 24 * 6),
    iso(-1000 * 60 * 60 * 24 * 6),
  );

  insertRuntime.run(
    randomUUID(),
    tenantSpaceId,
    platformBusinessTeamId,
    "AgentWorld Research Runtime",
    "embedded://agentworld/research",
    "pi",
    "offline",
    JSON.stringify(["leader-meridian", "market-scout"]),
    JSON.stringify(["GLM-5.1 Coding"]),
    3,
    0,
    iso(-1000 * 60 * 15),
    iso(-1000 * 60 * 60 * 24 * 5),
  );

  insertProviderRuntimeBinding.run(
    "runtime-binding-pi-default",
    tenantSpaceId,
    releaseBusinessTeamId,
    "pi-runtime-adapter",
    "AgentWorld 默认执行配置",
    "pi",
    "embedded://agentworld/default",
    "embedded",
    process.cwd(),
    glmProviderId,
    "env:AGENTWORLD_GLM_API_KEY",
    JSON.stringify({
      defaultModel: "GLM-5.1",
      executionMode: "embedded",
      approvalMode: "allow",
      eventContract: "provider_event_v1",
      humanIntervention: "steer",
      env: {
        AGENTWORLD_GLM_API_KEY: "ref:env:AGENTWORLD_GLM_API_KEY",
      },
    }),
    1,
    iso(-1000 * 60 * 60 * 24 * 5),
    iso(-1000 * 60 * 60 * 24 * 5),
  );
  insertRuntime.run(
    randomUUID(),
    tenantSpaceId,
    releaseBusinessTeamId,
    "AgentWorld Release Runtime",
    "embedded://agentworld/release",
    "pi",
    "offline",
    JSON.stringify(["release-reviewer", "merge-steward"]),
    JSON.stringify(["GLM-5.1 Coding", "Azure Fallback"]),
    2,
    0,
    iso(-1000 * 60 * 10),
    iso(-1000 * 60 * 60 * 24 * 5),
  );

  const researchAccessGrantId = randomUUID();
  insertAccessGrant.run(
    researchAccessGrantId,
    researchTeamId,
    releaseBusinessTeamId,
    JSON.stringify({ baseUsd: 0.4, tokenMultiplier: 1.2, platformFeePct: 10 }),
    JSON.stringify({ responseSeconds: 120, successRateFloor: 0.88 }),
    JSON.stringify({ actions: ["research", "summary"], tools: ["search_web", "read_repo"] }),
    "svc-release-research",
    "active",
    iso(-1000 * 60 * 60 * 24 * 4),
  );

  insertListing.run(
    randomUUID(),
    researchTeamId,
    JSON.stringify({
      successRate: 0.91,
      avgLatencyMs: 18200,
      avgCostUsd: 1.8,
      topTasks: ["market scan", "vendor comparison", "competitive brief"],
    }),
    "subscribe",
    JSON.stringify(["research", "market", "briefing"]),
    "listed",
    iso(-1000 * 60 * 60 * 24 * 3),
  );
  insertListing.run(
    randomUUID(),
    reviewTeamId,
    JSON.stringify({
      successRate: 0.95,
      avgLatencyMs: 9600,
      avgCostUsd: 1.1,
      topTasks: ["pr review", "release gate", "rollback checklist"],
    }),
    "dedicated",
    JSON.stringify(["release", "code-review", "github"]),
    "listed",
    iso(-1000 * 60 * 60 * 24 * 3),
  );

  insertSchedule.run(
    randomUUID(),
    platformBusinessTeamId,
    incidentTeamId,
    "Daily reliability digest",
    "cron",
    "Every weekday at 09:00",
    iso(1000 * 60 * 85),
    JSON.stringify({ window: "24h", services: ["api", "worker", "billing"] }),
    1,
    iso(-1000 * 60 * 60 * 24 * 2),
  );
  insertSchedule.run(
    randomUUID(),
    platformBusinessTeamId,
    researchTeamId,
    "Weekly market scout",
    "cron",
    "Every Monday at 10:30",
    iso(-1000 * 60 * 25),
    JSON.stringify({ brief: "Track emerging agent platforms", audience: "product leadership" }),
    1,
    iso(-1000 * 60 * 60 * 24 * 2),
  );
  insertSchedule.run(
    randomUUID(),
    releaseBusinessTeamId,
    reviewTeamId,
    "PR intake webhook mirror",
    "event",
    "Webhook only",
    null,
    JSON.stringify({ repository: "agentworld" }),
    1,
    iso(-1000 * 60 * 60 * 24 * 2),
  );

  const runningTaskRunId = randomUUID();
  const awaitingTaskRunId = randomUUID();
  const completedTaskRunId = randomUUID();

  const runningTraceId = randomUUID();
  const awaitingTraceId = randomUUID();
  const completedTraceId = randomUUID();

  insertTaskRun.run(
    runningTaskRunId,
    tenantSpaceId,
    platformBusinessTeamId,
    incidentTeamId,
    null,
    "schedule",
    "daily-reliability-digest",
    "running",
    90,
    JSON.stringify({ window: "24h", services: ["api", "worker", "billing"] }),
    null,
    2.4,
    0.9,
    runningTraceId,
    "scheduler",
    iso(-1000 * 60 * 34),
    null,
  );
  insertTaskRun.run(
    awaitingTaskRunId,
    tenantSpaceId,
    releaseBusinessTeamId,
    reviewTeamId,
    researchAccessGrantId,
    "webhook",
    "github/pr/481",
    "awaiting",
    82,
    JSON.stringify({ repository: "agentworld", pullRequest: 481 }),
    null,
    1.6,
    0.8,
    awaitingTraceId,
    "webhook/github",
    iso(-1000 * 60 * 58),
    null,
  );
  insertTaskRun.run(
    completedTaskRunId,
    tenantSpaceId,
    releaseBusinessTeamId,
    researchTeamId,
    researchAccessGrantId,
    "access_grant",
    "cross-team/research-relay",
    "completed",
    75,
    JSON.stringify({ brief: "Compare agent platforms for Q2", audience: "release leadership" }),
    JSON.stringify({
      findings: ["Strong managed-agent posture", "Good local-first ergonomics"],
      recommendations: ["Pilot with small team", "Keep write tools behind approval"],
    }),
    3.2,
    2.6,
    completedTraceId,
    "Sophia",
    iso(-1000 * 60 * 60 * 4),
    iso(-1000 * 60 * 60 * 3 - 1000 * 60 * 12),
  );

  const runningPlanId = randomUUID();
  const awaitingPlanId = randomUUID();
  const completedPlanId = randomUUID();

  insertPlan.run(
    runningPlanId,
    runningTaskRunId,
    "rule",
    JSON.stringify({
      nodes: [
        { id: "collect", agent: "signal-scout" },
        { id: "analyze", agent: "failure-analyst" },
      ],
      edges: [["collect", "analyze"]],
    }),
    "Collect signals first, then synthesize owner-facing incident guidance.",
    iso(-1000 * 60 * 33),
  );
  insertPlan.run(
    awaitingPlanId,
    awaitingTaskRunId,
    "rule",
    JSON.stringify({
      nodes: [
        { id: "review", agent: "release-reviewer" },
        { id: "writeback", agent: "merge-steward" },
      ],
      edges: [["review", "writeback"]],
    }),
    "Review the PR, then prepare write-back steps behind a human gate.",
    iso(-1000 * 60 * 57),
  );
  insertPlan.run(
    completedPlanId,
    completedTaskRunId,
    "leader_agent",
    JSON.stringify({
      nodes: [
        { id: "scan", agent: "market-scout" },
        { id: "synthesize", agent: "leader-meridian" },
      ],
      edges: [["scan", "synthesize"]],
    }),
    "Scout the market, then turn raw evidence into a leadership brief.",
    iso(-1000 * 60 * 60 * 4),
  );

  const runningNodeCollect = randomUUID();
  const runningNodeAnalyze = randomUUID();
  const awaitingNodeReview = randomUUID();
  const awaitingNodeWriteback = randomUUID();
  const completedNodeScan = randomUUID();
  const completedNodeSynthesize = randomUUID();

  insertNode.run(
    runningNodeCollect,
    runningTaskRunId,
    runningPlanId,
    "collect",
    scoutAgentId,
    JSON.stringify([]),
    JSON.stringify({ focus: "signal collection" }),
    JSON.stringify({ incidents: 5, clustered: 2 }),
    "completed",
    1,
    2,
    iso(-1000 * 60 * 32),
    iso(-1000 * 60 * 29),
  );
  insertNode.run(
    runningNodeAnalyze,
    runningTaskRunId,
    runningPlanId,
    "analyze",
    analystAgentId,
    JSON.stringify(["collect"]),
    JSON.stringify({ incidents: 5, clustered: 2 }),
    null,
    "running",
    1,
    2,
    iso(-1000 * 60 * 28),
    null,
  );
  insertNode.run(
    awaitingNodeReview,
    awaitingTaskRunId,
    awaitingPlanId,
    "review",
    reviewerAgentId,
    JSON.stringify([]),
    JSON.stringify({ repository: "agentworld", pr: 481 }),
    JSON.stringify({ decision: "needs_approval", commentary: "Low risk, but write-back pending" }),
    "completed",
    1,
    2,
    iso(-1000 * 60 * 56),
    iso(-1000 * 60 * 49),
  );
  insertNode.run(
    awaitingNodeWriteback,
    awaitingTaskRunId,
    awaitingPlanId,
    "writeback",
    stewardAgentId,
    JSON.stringify(["review"]),
    JSON.stringify({ proposedActions: ["post review comment", "label release-safe"] }),
    null,
    "awaiting",
    1,
    1,
    iso(-1000 * 60 * 48),
    null,
  );
  insertNode.run(
    completedNodeScan,
    completedTaskRunId,
    completedPlanId,
    "scan",
    researcherAgentId,
    JSON.stringify([]),
    JSON.stringify({ brief: "Compare agent platforms" }),
    JSON.stringify({ sources: 12, findings: 8 }),
    "completed",
    1,
    2,
    iso(-1000 * 60 * 60 * 4),
    iso(-1000 * 60 * 60 * 3 - 1000 * 60 * 40),
  );
  insertNode.run(
    completedNodeSynthesize,
    completedTaskRunId,
    completedPlanId,
    "synthesize",
    leaderAgentId,
    JSON.stringify(["scan"]),
    JSON.stringify({ sources: 12, findings: 8 }),
    JSON.stringify({ briefDelivered: true }),
    "completed",
    1,
    2,
    iso(-1000 * 60 * 60 * 3 - 1000 * 60 * 39),
    iso(-1000 * 60 * 60 * 3 - 1000 * 60 * 12),
  );

  insertSpan.run(
    randomUUID(),
    runningTraceId,
    null,
    runningTaskRunId,
    null,
    "task_run",
    "open",
    iso(-1000 * 60 * 34),
    null,
    JSON.stringify({ team: "Incident Observatory" }),
  );
  insertSpan.run(
    randomUUID(),
    awaitingTraceId,
    null,
    awaitingTaskRunId,
    null,
    "task_run",
    "open",
    iso(-1000 * 60 * 58),
    null,
    JSON.stringify({ team: "PR Vanguard" }),
  );
  insertSpan.run(
    randomUUID(),
    completedTraceId,
    null,
    completedTaskRunId,
    null,
    "task_run",
    "ok",
    iso(-1000 * 60 * 60 * 4),
    iso(-1000 * 60 * 60 * 3 - 1000 * 60 * 12),
    JSON.stringify({ team: "Research Relay" }),
  );

  [
    [
      runningTraceId,
      runningTaskRunId,
      null,
      1,
      "planning",
      "Planning",
      "任务已接收",
      "调度器时间片已生成任务，并选择 Incident Observatory 团队接手。",
      iso(-1000 * 60 * 34),
    ],
    [
      runningTraceId,
      runningTaskRunId,
      runningNodeCollect,
      2,
      "tool_result",
      "Signal Collection",
      "Collected evidence",
      "Signal Scout clustered 5 incidents into 2 candidate reliability threads.",
      iso(-1000 * 60 * 29),
    ],
    [
      runningTraceId,
      runningTaskRunId,
      runningNodeAnalyze,
      3,
      "thinking",
      "Analysis",
      "Assessing owner-facing risk",
      "Failure Analyst is comparing billing alerts with worker queue lag to explain probable blast radius.",
      iso(-1000 * 60 * 26),
    ],
    [
      awaitingTraceId,
      awaitingTaskRunId,
      null,
      1,
      "planning",
      "Planning",
      "Webhook 任务已创建",
      "GitHub PR webhook 已先转成受治理任务，之后才允许进入代码仓动作。",
      iso(-1000 * 60 * 58),
    ],
    [
      awaitingTraceId,
      awaitingTaskRunId,
      awaitingNodeReview,
      2,
      "text_delta",
      "Review Summary",
      "Review finished",
      "Release Reviewer found no blocking defects and prepared a concise recommendation.",
      iso(-1000 * 60 * 50),
    ],
    [
      awaitingTraceId,
      awaitingTaskRunId,
      awaitingNodeWriteback,
      3,
      "approval_required",
      "Human Actions",
      "Write-back blocked",
      "Merge Steward 已准备好代码仓回写步骤，但发布回写运行约束要求先获得人工批准。",
      iso(-1000 * 60 * 48),
    ],
    [
      completedTraceId,
      completedTaskRunId,
      completedNodeScan,
      1,
      "thinking",
      "Research Scan",
      "Scanning market evidence",
      "Market Scout gathered product pages, engineering writeups, and adoption notes for the comparison brief.",
      iso(-1000 * 60 * 60 * 3 - 1000 * 60 * 44),
    ],
    [
      completedTraceId,
      completedTaskRunId,
      completedNodeSynthesize,
      2,
      "text_delta",
      "Synthesis",
      "Brief delivered",
      "Leader Meridian converted raw evidence into a brief with findings, risks, and rollout recommendations.",
      iso(-1000 * 60 * 60 * 3 - 1000 * 60 * 14),
    ],
  ].forEach(([traceId, taskRunId, nodeId, seq, phase, foldGroup, title, content, createdAt]) => {
    insertEvent.run(
      randomUUID(),
      traceId,
      taskRunId,
      nodeId,
      seq,
      phase,
      foldGroup,
      title,
      content,
      JSON.stringify({}),
      createdAt,
    );
  });

  insertIntervention.run(
    randomUUID(),
    awaitingTaskRunId,
    awaitingNodeWriteback,
    "approval",
    "pending",
    "Approve repository write-back for PR #481",
    null,
    iso(-1000 * 60 * 47),
    null,
  );

  insertRepo.run(randomUUID(), platformBusinessTeamId, "platform-core", "github", "main", 92, 14);
  insertRepo.run(randomUUID(), releaseBusinessTeamId, "agentworld", "github", "main", 97, 21);
  insertRepo.run(randomUUID(), releaseBusinessTeamId, "release-bot", "github", "main", 78, 8);

  insertDeveloper.run(randomUUID(), platformBusinessTeamId, "Ming", "platform reliability", iso(-1000 * 60 * 12));
  insertDeveloper.run(randomUUID(), releaseBusinessTeamId, "Sophia", "release automation", iso(-1000 * 60 * 20));
  insertDeveloper.run(randomUUID(), platformBusinessTeamId, "Ava", "agent governance", iso(-1000 * 60 * 28));

  insertWebhook.run(
    randomUUID(),
    releaseBusinessTeamId,
    reviewTeamId,
    "GitHub PR Intake",
    "github-pr",
    "POST",
    JSON.stringify({ type: "object", required: ["repository", "pull_request", "action"] }),
    "ghpr-****",
    1,
  );
}

function ensureCodeReviewSkillSeed(db: DatabaseSync) {
  const now = new Date().toISOString();
  const insertSkill = db.prepare(
    "INSERT OR IGNORE INTO code_review_skills (id, name, layer, description, is_enabled, prompt_md, heuristics_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertLayer = db.prepare(
    "INSERT OR IGNORE INTO knowledge_layers (id, layer_key, name, scope, viking_uri, parent_uri, description, load_order, retention_policy_json, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );

  [
    {
      key: "repository/code-review",
      name: "代码仓 MR 上下文",
      scope: "resources",
      uri: "viking://resources/agentworld/code-review/repositories",
      parent: "viking://resources/agentworld/code-review",
      order: 10,
      description: "保存 MR 标题、作者、分支、文件列表、diff 获取方式和检视上下文。",
      retention: { keepDays: 180, promoteWhenFeedbackCorrect: true },
    },
    {
      key: "global/code-review",
      name: "全局检视经验",
      scope: "resources",
      uri: "viking://resources/agentworld/code-review/global",
      parent: "viking://resources/agentworld/code-review",
      order: 20,
      description: "保存 MR 结构、变更范围、依赖变化等跨仓库通用经验。",
      retention: { keepDays: 365, promoteWhenFeedbackCorrect: true },
    },
    {
      key: "security",
      name: "安全检视技能知识",
      scope: "agent",
      uri: "viking://agent/skills/agentworld/code-review/security",
      parent: "viking://agent/skills/agentworld/code-review",
      order: 30,
      description: "保存命令执行、动态执行、密钥、token、鉴权边界等安全检视知识。",
      retention: { keepDays: 365, requireEvidence: true },
    },
    {
      key: "quality/test",
      name: "测试影响技能知识",
      scope: "agent",
      uri: "viking://agent/skills/agentworld/code-review/quality-test",
      parent: "viking://agent/skills/agentworld/code-review",
      order: 40,
      description: "保存源码变化、测试缺口、验证说明等质量检视知识。",
      retention: { keepDays: 365, requireEvidence: true },
    },
    {
      key: "data-interface",
      name: "数据与接口知识",
      scope: "agent",
      uri: "viking://agent/skills/agentworld/code-review/data-api",
      parent: "viking://agent/skills/agentworld/code-review",
      order: 50,
      description: "保存数据库、API、Webhook、schema 兼容性和回滚知识。",
      retention: { keepDays: 365, requireEvidence: true },
    },
    {
      key: "feedback/correct",
      name: "正确反馈记忆",
      scope: "user",
      uri: "viking://user/memories/agentworld/code-review/feedback/correct",
      parent: "viking://user/memories/agentworld/code-review/feedback",
      order: 60,
      description: "保存用户确认正确的检视意见，用于增强后续检视上下文。",
      retention: { keepDays: 540, promoteToSkill: true },
    },
    {
      key: "feedback/incorrect",
      name: "误报反馈记忆",
      scope: "user",
      uri: "viking://user/memories/agentworld/code-review/feedback/incorrect",
      parent: "viking://user/memories/agentworld/code-review/feedback",
      order: 70,
      description: "保存用户确认不正确的检视意见，用于降低同类误报。",
      retention: { keepDays: 540, suppressSimilarFinding: true },
    },
    {
      key: "feedback/unclear",
      name: "解释不足反馈记忆",
      scope: "user",
      uri: "viking://user/memories/agentworld/code-review/feedback/unclear",
      parent: "viking://user/memories/agentworld/code-review/feedback",
      order: 80,
      description: "保存用户认为解释不清楚的检视意见，用于改进评论表达。",
      retention: { keepDays: 270, improveExplanation: true },
    },
  ].forEach((layer) => {
    insertLayer.run(
      randomUUID(),
      layer.key,
      layer.name,
      layer.scope,
      layer.uri,
      layer.parent,
      layer.description,
      layer.order,
      JSON.stringify(layer.retention),
      1,
      now,
      now,
    );
  });

  [
    {
      id: "mr-structure",
      name: "MR 结构检视",
      layer: "global/code-review",
      description: "先判断 MR 是否足够小、范围是否清楚、是否有明显的依赖或锁文件风险。",
      promptMd:
        "你是代码检视的第一层守门员。只关注 MR 的范围、变更形状、是否容易回滚、是否需要拆分，不做没有证据的推断。",
      heuristics: {
        maxChangedFiles: 20,
        largeDiffLineThreshold: 800,
        watchFiles: ["package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json"],
      },
    },
    {
      id: "security-sensitive",
      name: "安全敏感检视",
      layer: "security",
      description: "扫描密钥、命令执行、动态代码执行、鉴权绕过等高风险信号。",
      promptMd:
        "你是安全检视员。优先指出可以被利用或会泄露权限的风险，每条意见都必须能在 diff 中找到证据。",
      heuristics: {
        riskyPatterns: [
          "eval(",
          "new Function(",
          "child_process",
          "exec(",
          "spawn(",
          "password",
          "secret",
          "token",
          "private_key",
          ".env",
        ],
      },
    },
    {
      id: "test-impact",
      name: "测试影响检视",
      layer: "quality/test",
      description: "判断业务或接口变更是否缺少测试、快照或验证入口。",
      promptMd:
        "你是测试策略检视员。关注变更有没有对应测试，不要求机械覆盖率，但要能解释缺失测试会带来什么风险。",
      heuristics: {
        sourcePatterns: ["/src/", ".ts", ".tsx"],
        testPatterns: [".test.", ".spec.", "__tests__", "/tests/"],
      },
    },
    {
      id: "data-interface",
      name: "数据与接口检视",
      layer: "data-interface",
      description: "检查数据库、API 入参出参、Webhook 协议、回调地址等是否有兼容性说明。",
      promptMd:
        "你是数据与接口检视员。只在看到数据库结构、API route、schema、webhook 或序列化格式变化时给意见。",
      heuristics: {
        interfacePatterns: [
          "CREATE TABLE",
          "ALTER TABLE",
          "route.ts",
          "NextResponse",
          "request.json",
          "schema",
          "webhook",
        ],
      },
    },
  ].forEach((skill) => {
    insertSkill.run(
      skill.id,
      skill.name,
      skill.layer,
      skill.description,
      1,
      skill.promptMd,
      JSON.stringify(skill.heuristics),
      now,
      now,
    );
  });

  db.exec(`
    UPDATE code_review_skills
    SET tags_json = '["代码检视","MR","结构"]',
        visibility = 'global',
        viking_uri = COALESCE(viking_uri, 'viking://agent/skills/agentworld/code-review/global/mr-structure')
    WHERE id = 'mr-structure';
    UPDATE code_review_skills
    SET tags_json = '["安全","高危","证据"]',
        visibility = 'team',
        viking_uri = COALESCE(viking_uri, 'viking://agent/skills/agentworld/code-review/security/security-sensitive')
    WHERE id = 'security-sensitive';
    UPDATE code_review_skills
    SET tags_json = '["测试","质量","回归"]',
        visibility = 'team',
        viking_uri = COALESCE(viking_uri, 'viking://agent/skills/agentworld/code-review/quality-test/test-impact')
    WHERE id = 'test-impact';
    UPDATE code_review_skills
    SET tags_json = '["接口","数据","兼容性"]',
        visibility = 'team',
        viking_uri = COALESCE(viking_uri, 'viking://agent/skills/agentworld/code-review/data-api/data-interface')
    WHERE id = 'data-interface';
  `);
}

function ensureKnowledgeSpaceSeed(db: DatabaseSync) {
  const now = new Date().toISOString();
  const tenant = db
    .prepare("SELECT id FROM tenant_spaces ORDER BY created_at ASC LIMIT 1")
    .get() as { id: string } | undefined;
  const releaseTeam = db
    .prepare("SELECT id FROM business_teams WHERE slug = ?")
    .get("release-team") as { id: string } | undefined;
  const platformTeam = db
    .prepare("SELECT id FROM business_teams WHERE slug = ?")
    .get("platform-team") as { id: string } | undefined;
  const reviewAgentTeam = db
    .prepare("SELECT id FROM agent_teams WHERE slug = ?")
    .get("pr-vanguard") as { id: string } | undefined;
  const researchAgentTeam = db
    .prepare("SELECT id FROM agent_teams WHERE slug = ?")
    .get("research-relay") as { id: string } | undefined;

  if (!tenant) return;

  const insertSpace = db.prepare(
    "INSERT OR IGNORE INTO knowledge_spaces (id, tenant_space_id, business_team_id, agent_team_id, project_key, slug, name, space_type, viking_uri, description, visibility, status, retention_policy_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertBinding = db.prepare(
    "INSERT OR IGNORE INTO knowledge_space_bindings (id, knowledge_space_id, target_type, target_id, access_level, load_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  const spaces = [
    {
      id: "ks-global-code-review",
      businessTeamId: null,
      agentTeamId: null,
      projectKey: null,
      slug: "global-code-review",
      name: "全局代码检视知识",
      spaceType: "global",
      vikingUri: "viking://resources/agentworld/global/code-review",
      description: "全局通用代码检视规范、跨团队经验和可复用检视样例。",
      visibility: "global",
      retention: { keepDays: 540, promoteToSkill: true },
      bindings: [],
    },
    {
      id: "ks-release-code-review",
      businessTeamId: releaseTeam?.id ?? null,
      agentTeamId: null,
      projectKey: null,
      slug: "release-team-code-review",
      name: "Release Team 代码检视知识",
      spaceType: "team",
      vikingUri: "viking://resources/agentworld/teams/release-team/code-review",
      description: "Release Team 的代码规范、历史检视偏好、误报基线和团队约束。",
      visibility: "team",
      retention: { keepDays: 365, requireTeamReview: true },
      bindings: releaseTeam ? [{ targetType: "business_team", targetId: releaseTeam.id, accessLevel: "write", loadOrder: 20 }] : [],
    },
    {
      id: "ks-release-platform-project",
      businessTeamId: releaseTeam?.id ?? null,
      agentTeamId: null,
      projectKey: "demo/platform",
      slug: "release-demo-platform-project",
      name: "demo/platform 项目知识",
      spaceType: "project",
      vikingUri: "viking://resources/agentworld/teams/release-team/projects/demo-platform",
      description: "demo/platform 项目架构、仓库风险画像、接口约束和历史检视结论。",
      visibility: "team",
      retention: { keepDays: 365, archiveFindings: true },
      bindings: releaseTeam ? [{ targetType: "business_team", targetId: releaseTeam.id, accessLevel: "write", loadOrder: 30 }] : [],
    },
    {
      id: "ks-pr-vanguard-skills",
      businessTeamId: releaseTeam?.id ?? null,
      agentTeamId: reviewAgentTeam?.id ?? null,
      projectKey: null,
      slug: "pr-vanguard-skills",
      name: "PR Vanguard AgentTeam Skill 空间",
      spaceType: "agent_team",
      vikingUri: "viking://agent/skills/agentworld/teams/release-team/agent-teams/pr-vanguard",
      description: "PR Vanguard 使用的分层检视方法、输出模板和发布策略。",
      visibility: "team",
      retention: { keepDays: 540, versionedSkill: true },
      bindings: reviewAgentTeam ? [{ targetType: "agent_team", targetId: reviewAgentTeam.id, accessLevel: "read", loadOrder: 10 }] : [],
    },
    {
      id: "ks-release-security-review",
      businessTeamId: releaseTeam?.id ?? null,
      agentTeamId: reviewAgentTeam?.id ?? null,
      projectKey: null,
      slug: "release-security-review",
      name: "Release Team 安全检视知识",
      spaceType: "team",
      vikingUri: "viking://agent/skills/agentworld/teams/release-team/security-review",
      description: "安全基线、依赖风险、密钥泄露、敏感 API 和误报抑制规则。",
      visibility: "team",
      retention: { keepDays: 540, suppressFalsePositive: true },
      bindings: reviewAgentTeam ? [{ targetType: "agent_team", targetId: reviewAgentTeam.id, accessLevel: "read", loadOrder: 15 }] : [],
    },
    {
      id: "ks-platform-research",
      businessTeamId: platformTeam?.id ?? null,
      agentTeamId: researchAgentTeam?.id ?? null,
      projectKey: null,
      slug: "platform-research",
      name: "Platform Team 研究知识",
      spaceType: "team",
      vikingUri: "viking://resources/agentworld/teams/platform-team/research",
      description: "平台团队沉淀的研究资料、决策依据和跨团队可读结论。",
      visibility: "team",
      retention: { keepDays: 365, publishDigest: true },
      bindings: researchAgentTeam ? [{ targetType: "agent_team", targetId: researchAgentTeam.id, accessLevel: "read", loadOrder: 20 }] : [],
    },
  ];

  for (const space of spaces) {
    insertSpace.run(
      space.id,
      tenant.id,
      space.businessTeamId,
      space.agentTeamId,
      space.projectKey,
      space.slug,
      space.name,
      space.spaceType,
      space.vikingUri,
      space.description,
      space.visibility,
      "active",
      JSON.stringify(space.retention),
      now,
      now,
    );

    for (const binding of space.bindings) {
      insertBinding.run(
        `${space.id}:${binding.targetType}:${binding.targetId}`,
        space.id,
        binding.targetType,
        binding.targetId,
        binding.accessLevel,
        binding.loadOrder,
        now,
      );
    }
  }
}

function ensureTeamGovernanceSeed(db: DatabaseSync) {
  const now = new Date().toISOString();
  const tenant = db
    .prepare("SELECT id FROM tenant_spaces ORDER BY created_at ASC LIMIT 1")
    .get() as { id: string } | undefined;
  const platformTeam = db
    .prepare("SELECT id FROM business_teams WHERE slug = ?")
    .get("platform-team") as { id: string } | undefined;
  const releaseTeam = db
    .prepare("SELECT id FROM business_teams WHERE slug = ?")
    .get("release-team") as { id: string } | undefined;

  if (!tenant || !platformTeam || !releaseTeam) return;

  const insertMember = db.prepare(
    "INSERT OR IGNORE INTO team_members (id, tenant_space_id, business_team_id, employee_no, name, email, role, title, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertPermission = db.prepare(
    "INSERT OR IGNORE INTO team_permission_grants (id, business_team_id, member_id, principal_type, role_key, resource_type, resource_scope, actions_json, effect, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertAsset = db.prepare(
    "INSERT OR IGNORE INTO team_asset_grants (id, business_team_id, member_id, asset_type, asset_id, asset_name, permission_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertMcp = db.prepare(
    "INSERT OR IGNORE INTO mcp_servers (id, business_team_id, name, transport, command, url, auth_ref, tool_allowlist_json, status, last_health_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertConnector = db.prepare(
    "INSERT OR IGNORE INTO connector_profiles (id, business_team_id, name, connector_type, provider, endpoint, secret_ref, capabilities_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertCodebase = db.prepare(
    "INSERT OR IGNORE INTO codebase_profiles (id, business_team_id, name, provider, repository_url, default_branch, visibility, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertCodebaseToken = db.prepare(
    "INSERT OR IGNORE INTO codebase_operator_tokens (id, codebase_id, operator_name, token_ref, role, permission_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const members = [
    {
      id: "member-platform-ming",
      teamId: platformTeam.id,
      employeeNo: "AW1001",
      name: "Ming",
      email: "ming@example.com",
      role: "owner",
      title: "平台负责人",
    },
    {
      id: "member-platform-ava",
      teamId: platformTeam.id,
      employeeNo: "AW1002",
      name: "Ava",
      email: "ava@example.com",
      role: "admin",
      title: "Agent 治理",
    },
    {
      id: "member-release-sophia",
      teamId: releaseTeam.id,
      employeeNo: "AW2001",
      name: "Sophia",
      email: "sophia@example.com",
      role: "owner",
      title: "发布负责人",
    },
    {
      id: "member-release-chen",
      teamId: releaseTeam.id,
      employeeNo: "AW2002",
      name: "Chen",
      email: "chen@example.com",
      role: "operator",
      title: "代码检视运营",
    },
  ];

  members.forEach((member) => {
    insertMember.run(
      member.id,
      tenant.id,
      member.teamId,
      member.employeeNo,
      member.name,
      member.email,
      member.role,
      member.title,
      "active",
      "manual",
      now,
      now,
    );
  });

  [
    {
      id: "perm-platform-owner",
      teamId: platformTeam.id,
      memberId: "member-platform-ming",
      roleKey: "team_owner",
      resourceType: "agentworld",
      resourceScope: "team:*",
      actions: ["team.manage", "agent.manage", "task.manage", "asset.manage", "audit.read"],
    },
    {
      id: "perm-release-operator",
      teamId: releaseTeam.id,
      memberId: "member-release-chen",
      roleKey: "task_operator",
      resourceType: "task_blueprint",
      resourceScope: "team:release-team",
      actions: ["task.read", "task.run", "task.pause", "finding.triage"],
    },
  ].forEach((grant) => {
    insertPermission.run(
      grant.id,
      grant.teamId,
      grant.memberId,
      "member",
      grant.roleKey,
      grant.resourceType,
      grant.resourceScope,
      JSON.stringify(grant.actions),
      "allow",
      "active",
      now,
      now,
    );
  });

  [
    {
      id: "mcp-filesystem-readonly",
      teamId: platformTeam.id,
      name: "Filesystem Readonly MCP",
      transport: "stdio",
      command: "npx -y @modelcontextprotocol/server-filesystem /workspace",
      url: "",
      authRef: "",
      tools: ["read_file", "list_directory", "search_files"],
    },
    {
      id: "mcp-code-search",
      teamId: releaseTeam.id,
      name: "Code Search MCP",
      transport: "http",
      command: "",
      url: "https://mcp.example.com/code-search",
      authRef: "secret:mcp-code-search-token",
      tools: ["search_code", "read_symbol", "dependency_graph"],
    },
  ].forEach((server) => {
    insertMcp.run(
      server.id,
      server.teamId,
      server.name,
      server.transport,
      server.command,
      server.url,
      server.authRef,
      JSON.stringify(server.tools),
      "active",
      "unknown",
      now,
      now,
    );
  });

  [
    {
      id: "connector-release-email",
      teamId: releaseTeam.id,
      name: "Release Email",
      type: "email",
      provider: "smtp",
      endpoint: "smtp://mail.example.com:587",
      secretRef: "secret:release-smtp",
      capabilities: ["email.send", "report.publish"],
    },
    {
      id: "connector-platform-im",
      teamId: platformTeam.id,
      name: "Platform IM",
      type: "im",
      provider: "webhook",
      endpoint: "https://im.example.com/agentworld",
      secretRef: "secret:platform-im-webhook",
      capabilities: ["message.send", "approval.notify"],
    },
    {
      id: "connector-web-push",
      teamId: null,
      name: "Web Push",
      type: "web_push",
      provider: "browser",
      endpoint: "/api/notifications/push",
      secretRef: "secret:web-push-vapid",
      capabilities: ["push.notify", "incident.alert"],
    },
  ].forEach((connector) => {
    insertConnector.run(
      connector.id,
      connector.teamId,
      connector.name,
      connector.type,
      connector.provider,
      connector.endpoint,
      connector.secretRef,
      JSON.stringify(connector.capabilities),
      "active",
      now,
      now,
    );
  });

  [
    {
      id: "codebase-agentworld",
      teamId: releaseTeam.id,
      name: "agentworld",
      provider: "codehub",
      url: "ssh://codehub.example.com/agentworld/agentworld.git",
      branch: "main",
      description: "AgentWorld 主仓，供代码检视与安全检视任务使用。",
    },
    {
      id: "codebase-platform-core",
      teamId: platformTeam.id,
      name: "platform-core",
      provider: "git",
      url: "ssh://git.example.com/platform/core.git",
      branch: "main",
      description: "平台团队核心服务仓库。",
    },
  ].forEach((codebase) => {
    insertCodebase.run(
      codebase.id,
      codebase.teamId,
      codebase.name,
      codebase.provider,
      codebase.url,
      codebase.branch,
      "team",
      codebase.description,
      "active",
      now,
      now,
    );
  });

  [
    {
      id: "token-agentworld-reviewer",
      codebaseId: "codebase-agentworld",
      operatorName: "MR Reviewer",
      tokenRef: "secret:codehub-agentworld-reviewer-token",
      role: "reviewer",
      permissions: ["repo.read", "mr.diff.read", "mr.comment.write"],
    },
    {
      id: "token-agentworld-security",
      codebaseId: "codebase-agentworld",
      operatorName: "Security Scanner",
      tokenRef: "secret:codehub-agentworld-security-token",
      role: "scanner",
      permissions: ["repo.read", "branch.clone", "artifact.write"],
    },
    {
      id: "token-platform-readonly",
      codebaseId: "codebase-platform-core",
      operatorName: "Readonly Inspector",
      tokenRef: "secret:platform-core-readonly-key",
      role: "readonly",
      permissions: ["repo.read", "branch.clone"],
    },
  ].forEach((token) => {
    insertCodebaseToken.run(
      token.id,
      token.codebaseId,
      token.operatorName,
      token.tokenRef,
      token.role,
      JSON.stringify(token.permissions),
      "active",
      now,
      now,
    );
  });

  [
    {
      id: "asset-release-skill-security",
      teamId: releaseTeam.id,
      memberId: "member-release-chen",
      type: "skill",
      assetId: "security-sensitive",
      assetName: "安全敏感检视",
      permissions: { use: true, edit: false, publish: false },
    },
    {
      id: "asset-release-codebase-agentworld",
      teamId: releaseTeam.id,
      memberId: "member-release-sophia",
      type: "codebase",
      assetId: "codebase-agentworld",
      assetName: "agentworld",
      permissions: { read: true, review: true, comment: true, tokenAdmin: true },
    },
    {
      id: "asset-platform-knowledge-research",
      teamId: platformTeam.id,
      memberId: "member-platform-ava",
      type: "knowledge_space",
      assetId: "ks-platform-research",
      assetName: "Platform Team 研究知识",
      permissions: { read: true, write: true, curate: true },
    },
  ].forEach((asset) => {
    insertAsset.run(
      asset.id,
      asset.teamId,
      asset.memberId,
      asset.type,
      asset.assetId,
      asset.assetName,
      JSON.stringify(asset.permissions),
      "active",
      now,
      now,
    );
  });
}

function ensureProviderAdapterSeed(db: DatabaseSync) {
  const now = new Date().toISOString();
  const insertAdapter = db.prepare(
    "INSERT OR IGNORE INTO provider_adapter_definitions (id, name, adapter_type, entry_ref, version, lifecycle, capabilities_json, config_schema_json, secret_refs_json, permission_refs_json, health_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );

  [
    {
      id: "pi-runtime-adapter",
      name: "AgentWorld Runtime Adapter",
      adapterType: "sdk",
      entryRef: "system://agentworld-runtime",
      lifecycle: "configured",
      capabilities: [
        "session.create",
        "event.stream",
        "message.send",
        "artifact.collect",
        "runtime.discover",
      ],
      configSchema: {
        type: "object",
        required: ["defaultModel"],
        properties: {
          executionMode: { type: "string", enum: ["embedded", "proxy"], default: "embedded" },
          baseUrl: { type: "string" },
          apiKeySecretRef: { type: "string" },
          defaultModel: { type: "string" },
          eventContract: { type: "string", default: "provider_event_v1" },
        },
      },
      secretRefs: ["env:AGENTWORLD_GLM_API_KEY", "env:OPENAI_API_KEY"],
      permissions: ["provider.session.create", "provider.message.send", "provider.event.read"],
      healthStatus: "offline",
    },
    {
      id: "hermes-runtime-adapter",
      name: "Hermes Runtime Adapter",
      adapterType: "plugin",
      entryRef: "plugin://runtime-adapter/hermes",
      lifecycle: "declared",
      capabilities: ["session.create", "event.stream", "message.send", "artifact.collect"],
      configSchema: {
        type: "object",
        required: ["entrypoint"],
        properties: {
          entrypoint: { type: "string" },
        },
      },
      secretRefs: [],
      permissions: ["provider.session.create", "provider.message.send"],
      healthStatus: "declared",
    },
    {
      id: "langgraph-runtime-adapter",
      name: "LangGraph Runtime Adapter",
      adapterType: "plugin",
      entryRef: "plugin://runtime-adapter/langgraph",
      lifecycle: "declared",
      capabilities: ["session.create", "event.stream", "message.send", "artifact.collect"],
      configSchema: {
        type: "object",
        required: ["entrypoint"],
        properties: {
          entrypoint: { type: "string" },
        },
      },
      secretRefs: [],
      permissions: ["provider.session.create", "provider.message.send"],
      healthStatus: "declared",
    },
    {
      id: "mastra-runtime-adapter",
      name: "Mastra Runtime Adapter",
      adapterType: "plugin",
      entryRef: "plugin://runtime-adapter/mastra",
      lifecycle: "declared",
      capabilities: ["session.create", "event.stream", "message.send", "artifact.collect"],
      configSchema: {
        type: "object",
        required: ["entrypoint"],
        properties: {
          entrypoint: { type: "string" },
        },
      },
      secretRefs: [],
      permissions: ["provider.session.create", "provider.message.send"],
      healthStatus: "declared",
    },
    {
      id: "custom-runtime-adapter",
      name: "Custom Runtime Adapter",
      adapterType: "plugin",
      entryRef: "plugin://runtime-adapter/custom",
      lifecycle: "declared",
      capabilities: ["session.create", "event.stream", "message.send", "artifact.collect"],
      configSchema: {
        type: "object",
        required: ["entrypoint"],
        properties: {
          entrypoint: { type: "string" },
        },
      },
      secretRefs: [],
      permissions: ["provider.session.create", "provider.message.send"],
      healthStatus: "declared",
    },
  ].forEach((adapter) => {
    insertAdapter.run(
      adapter.id,
      adapter.name,
      adapter.adapterType,
      adapter.entryRef,
      "1.0.0",
      adapter.lifecycle,
      JSON.stringify(adapter.capabilities),
      JSON.stringify(adapter.configSchema),
      JSON.stringify(adapter.secretRefs),
      JSON.stringify(adapter.permissions),
      adapter.healthStatus,
      now,
      now,
    );
  });
}

function ensureRuntimeDisplayNames(db: DatabaseSync) {
  db.prepare(
    "UPDATE provider_runtime_bindings SET name = REPLACE(name, 'Pi 默认运行时', 'AgentWorld 默认执行配置'), base_url = REPLACE(base_url, 'embedded://pi/', 'embedded://agentworld/'), config_json = REPLACE(config_json, 'pi_agent_event_v1', 'provider_event_v1') WHERE name LIKE '%Pi%' OR base_url LIKE 'embedded://pi/%' OR config_json LIKE '%pi_agent_event_v1%'",
  ).run();
  db.prepare(
    "UPDATE runtime_endpoints SET name = REPLACE(name, 'Pi', 'AgentWorld'), base_url = REPLACE(base_url, 'embedded://pi/', 'embedded://agentworld/') WHERE name LIKE '%Pi%' OR base_url LIKE 'embedded://pi/%'",
  ).run();
  db.prepare(
    "UPDATE provider_adapter_definitions SET name = ?, entry_ref = ?, config_schema_json = REPLACE(config_schema_json, 'pi_agent_event_v1', 'provider_event_v1') WHERE id = ?",
  ).run("AgentWorld Runtime Adapter", "system://agentworld-runtime", "pi-runtime-adapter");
  db.prepare(
    "UPDATE task_blueprints SET provider_policy_json = REPLACE(provider_policy_json, 'pi_agent_event_v1', 'provider_event_v1') WHERE provider_policy_json LIKE '%pi_agent_event_v1%'",
  ).run();
  db.prepare(
    "UPDATE agent_definitions SET last_validation_summary = REPLACE(last_validation_summary, '默认 Pi 运行时', '默认运行接口') WHERE last_validation_summary LIKE '%默认 Pi 运行时%'",
  ).run();
}

function ensureCoreCaseSeed(db: DatabaseSync) {
  const now = new Date().toISOString();
  const tomorrow = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  const releaseBusinessTeam = db
    .prepare("SELECT id FROM business_teams WHERE slug = ?")
    .get("release-team") as { id: string } | undefined;
  const reviewTeam = db
    .prepare("SELECT id FROM agent_teams WHERE slug = ?")
    .get("pr-vanguard") as { id: string } | undefined;

  if (!releaseBusinessTeam || !reviewTeam) return;

  const insertEnvironment = db.prepare(
    "INSERT OR IGNORE INTO execution_environments (id, business_team_id, name, repository_provider, repository_name, repository_url, default_branch, executor_ref, private_key_ref, working_directory, sandbox_profile_json, memory_layer_refs_json, visibility, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertEnvironmentTemplate = db.prepare(
    "INSERT OR IGNORE INTO environment_templates (id, business_team_id, name, environment_type, repository_selector_json, executor_policy_json, secret_bindings_json, workspace_policy_json, sandbox_policy_json, memory_defaults_json, visibility, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertAgent = db.prepare(
    "INSERT OR IGNORE INTO agents (id, team_id, slug, name, role, persona_prompt, model, short_term_window, rag_config_json, tool_bindings_json, memory_scope, safety_policy_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const updateReviewTeamLeader = db.prepare(
    "UPDATE agent_teams SET leader_agent_id = ?, workflow_type = ? WHERE id = ?",
  );
  const insertSchedule = db.prepare(
    "INSERT OR IGNORE INTO schedule_templates (id, business_team_id, team_id, name, schedule_kind, cadence, next_run_at, input_payload_json, is_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const updateScheduleInput = db.prepare(
    "UPDATE schedule_templates SET input_payload_json = ? WHERE id = ?",
  );
  const insertTaskTemplate = db.prepare(
    "INSERT OR IGNORE INTO task_templates (id, name, case_key, plugin_id, team_id, environment_id, planner_mode, summary, input_schema_json, default_input_json, memory_layers_json, output_targets_json, nodes_json, webhook_parser_ref, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertTaskBlueprint = db.prepare(
    "INSERT OR REPLACE INTO task_blueprints (id, name, category, visibility, owner_business_team_id, team_id, environment_id, provider_adapter_id, version, status, trigger_json, input_schema_json, environment_selector_json, agent_team_run_plan_json, memory_policy_json, provider_policy_json, permission_policy_json, result_schema_json, output_policy_json, dashboard_policy_json, execution_policy_json, archive_policy_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );

  [
    {
      id: "agent-shield-review-leader",
      slug: "shield-review-leader",
      name: "Shield Review Leader",
      role: "leader",
      prompt: "拆解 MR 检视任务，协调并行检视 Agent，合并 Finding 并控制输出质量。",
      tools: ["repo.diff.read", "memory.retrieve", "finding.aggregate", "mr.comment.write"],
    },
    {
      id: "agent-code-quality-reviewer",
      slug: "code-quality-reviewer",
      name: "Code Quality Reviewer",
      role: "reviewer",
      prompt: "检查代码质量、可维护性、边界条件和兼容性风险。",
      tools: ["repo.diff.read", "repo.context.read", "memory.retrieve", "finding.create"],
    },
    {
      id: "agent-security-reviewer",
      slug: "security-reviewer",
      name: "Security Reviewer",
      role: "reviewer",
      prompt: "检查注入、越权、敏感信息、危险调用和依赖安全风险。",
      tools: ["repo.diff.read", "repo.context.read", "memory.retrieve", "finding.create"],
    },
    {
      id: "agent-test-reviewer",
      slug: "test-reviewer",
      name: "Test Reviewer",
      role: "reviewer",
      prompt: "检查测试覆盖、回归风险和验证路径是否充分。",
      tools: ["repo.diff.read", "repo.context.read", "memory.retrieve", "finding.create"],
    },
    {
      id: "agent-report-writer",
      slug: "report-writer",
      name: "Report Writer",
      role: "publisher",
      prompt: "把 Finding 汇总成 MR 评论、邮件报告和看板可读摘要。",
      tools: ["finding.read", "mr.comment.write", "email.send", "artifact.write"],
    },
  ].forEach((agent) => {
    insertAgent.run(
      agent.id,
      reviewTeam.id,
      agent.slug,
      agent.name,
      agent.role,
      agent.prompt,
      "gpt-5.4",
      12,
      JSON.stringify({ retrieval: "openviking", topK: 8 }),
      JSON.stringify(agent.tools),
      "team_shared",
      JSON.stringify({ requireEvidenceTrace: true, redactSecrets: true }),
      "active",
      now,
    );
  });
  updateReviewTeamLeader.run("agent-shield-review-leader", "parallel", reviewTeam.id);

  insertEnvironment.run(
    "env-shield-mr-review",
    releaseBusinessTeam.id,
    "神盾计划 MR 检视环境",
    "github",
    "agentworld",
    "git@github.com:SimonMing47/agentworld.git",
    "main",
    "svc-release-reviewer",
    "secret:release-team/repo-private-key",
    ".",
    JSON.stringify({ isolation: "process", network: "egress-controlled", future: "sandbox-template" }),
    JSON.stringify(["repository/code-review", "global/code-review", "security", "quality/test", "data-interface"]),
    "global",
    "active",
    now,
  );
  insertEnvironment.run(
    "env-daily-security-scan",
    releaseBusinessTeam.id,
    "每日全量安全检视环境",
    "github",
    "release-team/*",
    "git@github.com:SimonMing47/*.git",
    "main",
    "svc-security-reviewer",
    "secret:release-team/security-private-key",
    ".",
    JSON.stringify({ isolation: "future-sandbox", network: "read-only-egress", cloneDepth: "full" }),
    JSON.stringify(["security", "feedback/correct", "feedback/incorrect", "repository/code-review"]),
    "global",
    "active",
    now,
  );
  insertEnvironmentTemplate.run(
    "environment-template-repository-diff",
    releaseBusinessTeam.id,
    "代码仓 Diff 工作区模板",
    "repository_workspace",
    JSON.stringify({
      repoBinding: "${repo_id}",
      checkoutMode: "diff_context",
      branchBinding: "${target_branch}",
      commitBinding: "${source_commit_sha}",
    }),
    JSON.stringify({
      executorIdentity: "repo_executor_key",
      allowedWorkspaceRoots: ["."],
      cleanup: "after_archive",
    }),
    JSON.stringify({
      privateKeyRef: "secret:release-team/repo-private-key",
      tokenRef: "secret:code-platform-token",
      rawSecretReadable: false,
    }),
    JSON.stringify({ workspaceKind: "ephemeral", pathTemplate: "workspaces/${task_run_id}" }),
    JSON.stringify({ isolation: "process", network: "egress-controlled", future: "sandbox-template" }),
    JSON.stringify({
      requiredSpaces: ["viking://teams/security/code-review/", "viking://global/skills/code-review/"],
    }),
    "global",
    "active",
    now,
  );
  insertEnvironmentTemplate.run(
    "environment-template-repository-full-scan",
    releaseBusinessTeam.id,
    "代码仓全量扫描工作区模板",
    "repository_workspace",
    JSON.stringify({
      repoScope: "all_authorized_repositories",
      checkoutMode: "full_clone",
      branchBinding: "${branch}",
    }),
    JSON.stringify({
      executorIdentity: "security_scan_executor",
      splitStrategy: "by_repository",
      cleanup: "after_archive",
    }),
    JSON.stringify({
      privateKeyRef: "secret:release-team/security-private-key",
      rawSecretReadable: false,
    }),
    JSON.stringify({ workspaceKind: "ephemeral", pathTemplate: "workspaces/${task_run_id}/${repo_id}" }),
    JSON.stringify({ isolation: "future-sandbox", network: "read-only-egress" }),
    JSON.stringify({
      requiredSpaces: ["viking://teams/security/security-review/", "viking://global/skills/security/"],
    }),
    "global",
    "active",
    now,
  );

  insertTaskTemplate.run(
    "task-template-shield-mr-review",
    "神盾计划 MR 分层检视",
    "shield",
    "builtin.repo.git",
    reviewTeam.id,
    "env-shield-mr-review",
    "rule",
    "根据导入的任务模板将 MR webhook 转为可观测任务，并绑定分层检视记忆。",
    JSON.stringify({ type: "object", required: ["repository", "changeRequest", "diff"] }),
    JSON.stringify({
      taskCategory: "code_review",
      output: ["mr_comment", "task_trace", "knowledge_archive"],
    }),
    JSON.stringify(["repository/code-review", "global/code-review", "security", "quality/test", "data-interface"]),
    JSON.stringify(["mr_comment", "task_trace", "knowledge_archive"]),
    JSON.stringify([]),
    "builtin.code-review.github-gitlab-parser",
    "global",
    now,
  );
  insertSchedule.run(
    "template-shield-mr-review",
    releaseBusinessTeam.id,
    reviewTeam.id,
    "神盾计划 MR webhook 检视",
    "event",
    "Webhook: MR diff",
    null,
    JSON.stringify({
      caseKey: "shield",
      taskTemplateId: "task-template-shield-mr-review",
      taskCategory: "code_review",
      trigger: "webhook",
      webhookPathKey: "github-pr",
      environmentId: "env-shield-mr-review",
      memoryLayers: ["repository/code-review", "global/code-review", "security", "quality/test", "data-interface"],
      output: ["mr_comment", "task_trace", "knowledge_archive"],
    }),
    1,
    now,
  );
  updateScheduleInput.run(
    JSON.stringify({
      caseKey: "shield",
      taskTemplateId: "task-template-shield-mr-review",
      taskCategory: "code_review",
      trigger: "webhook",
      webhookPathKey: "github-pr",
      environmentId: "env-shield-mr-review",
      memoryLayers: ["repository/code-review", "global/code-review", "security", "quality/test", "data-interface"],
      output: ["mr_comment", "task_trace", "knowledge_archive"],
    }),
    "template-shield-mr-review",
  );
  insertTaskTemplate.run(
    "task-template-daily-security-review",
    "每日全量安全检视",
    "security-daily",
    "builtin.notify.email",
    reviewTeam.id,
    "env-daily-security-scan",
    "leader_agent",
    "按仓库集合执行全量安全检视，生成风险报告并通过通知插件发送。",
    JSON.stringify({ type: "object", required: ["repositorySelector"] }),
    JSON.stringify({
      taskCategory: "security_review",
      repositorySelector: { businessTeam: "release-team", branch: "main" },
      notificationPlugin: "builtin.notify.email",
    }),
    JSON.stringify(["security", "feedback/correct", "feedback/incorrect"]),
    JSON.stringify(["risk_report", "email_digest", "knowledge_archive"]),
    JSON.stringify([]),
    null,
    "global",
    now,
  );
  insertSchedule.run(
    "template-daily-security-review",
    releaseBusinessTeam.id,
    reviewTeam.id,
    "每日全量安全检视",
    "cron",
    "Every day at 02:00",
    tomorrow,
    JSON.stringify({
      caseKey: "security-daily",
      taskTemplateId: "task-template-daily-security-review",
      taskCategory: "security_review",
      trigger: "schedule",
      environmentId: "env-daily-security-scan",
      repositorySelector: { businessTeam: "release-team", branch: "main" },
      memoryLayers: ["security", "feedback/correct", "feedback/incorrect"],
      notificationPlugin: "builtin.notify.email",
      output: ["risk_report", "email_digest", "knowledge_archive"],
    }),
    1,
    now,
  );
  updateScheduleInput.run(
    JSON.stringify({
      caseKey: "security-daily",
      taskTemplateId: "task-template-daily-security-review",
      taskCategory: "security_review",
      trigger: "schedule",
      environmentId: "env-daily-security-scan",
      repositorySelector: { businessTeam: "release-team", branch: "main" },
      memoryLayers: ["security", "feedback/correct", "feedback/incorrect"],
      notificationPlugin: "builtin.notify.email",
      output: ["risk_report", "email_digest", "knowledge_archive"],
    }),
    "template-daily-security-review",
  );

  insertTaskBlueprint.run(
    "shield_mr_review",
    "神盾计划 MR 代码检视",
    "code_review",
    "global",
    releaseBusinessTeam.id,
    reviewTeam.id,
    "env-shield-mr-review",
    "pi-runtime-adapter",
    1,
    "active",
    JSON.stringify({
      type: "webhook",
      connector: "builtin.repo.git",
      event: "merge_request.updated",
      webhookPathKey: "github-pr",
      idempotencyKey: "${repo_id}:${mr_id}:${source_commit_sha}",
    }),
    JSON.stringify({
      type: "object",
      required: ["repo_id", "mr_id", "diff_ref", "author", "target_branch"],
      properties: {
        repo_id: { type: "string" },
        mr_id: { type: "string" },
        diff_ref: { type: "string" },
        author: { type: "string" },
        target_branch: { type: "string" },
        source_commit_sha: { type: "string" },
      },
    }),
    JSON.stringify({
      type: "repository_workspace",
      templateId: "environment-template-repository-diff",
      repoBinding: "${repo_id}",
      checkoutMode: "diff_context",
      privateKeyBinding: "repo_executor_key",
      executorIdentity: "svc-release-reviewer",
    }),
    JSON.stringify({
      strategy: "leader_worker_parallel",
      leader: "agent-shield-review-leader",
      workers: [
        {
          agent: "agent-code-quality-reviewer",
          task: "检查代码质量、可维护性、边界条件和兼容性。",
        },
        {
          agent: "agent-security-reviewer",
          task: "检查注入、越权、敏感信息、危险调用和依赖风险。",
        },
        {
          agent: "agent-test-reviewer",
          task: "检查测试覆盖、回归风险和验证路径。",
        },
      ],
      aggregation: {
        agent: "agent-shield-review-leader",
        method: "deduplicate_rank_and_publish",
      },
      conflictResolution: { method: "leader_decision" },
    }),
    JSON.stringify({
      requiredSpaces: ["viking://teams/security/code-review/", "viking://global/skills/code-review/"],
      skillSpaces: ["viking://global/skills/code-review/", "viking://teams/security/skills/shield-review/"],
      archiveOutputTo: ["viking://teams/security/review-cases/"],
      retrievalTrace: true,
    }),
    JSON.stringify({
      adapterId: "pi-runtime-adapter",
      mode: "session",
      eventContract: "provider_event_v1",
      timeoutMinutes: 30,
    }),
    JSON.stringify({
      defaultMode: "ask",
      rules: [
        { effect: "allow", resource: "tool.git.diff.read", scope: "repository" },
        { effect: "allow", resource: "tool.repo.context.read", scope: "current_merge_request" },
        { effect: "allow", resource: "tool.memory.retrieve", scope: "declared_spaces" },
        { effect: "allow", resource: "tool.mr.comment.write", scope: "current_merge_request" },
        { effect: "deny", resource: "tool.repo.force_push", scope: "*" },
        { effect: "deny", resource: "secret.read.raw_private_key", scope: "*" },
        { effect: "ask", resource: "tool.email.send", scope: "external_recipients" },
      ],
    }),
    JSON.stringify({
      type: "object",
      required: ["findings", "publication"],
      properties: {
        findings: { type: "array" },
        publication: { type: "object" },
      },
    }),
    JSON.stringify({
      publishers: [
        { type: "merge_request_comment", pluginId: "builtin.repo.git" },
        { type: "dashboard" },
        { type: "artifact_archive" },
      ],
    }),
    JSON.stringify({
      views: ["global_task_board", "business_team_board", "code_review_board", "task_run_detail"],
      dimensions: ["business_team", "repository", "severity", "category", "agent"],
      metrics: ["review_count", "avg_duration", "finding_count", "false_positive_rate"],
    }),
    JSON.stringify({
      stateMachine: [
        "created",
        "queued",
        "preparing_environment",
        "running",
        "waiting_approval",
        "publishing_output",
        "succeeded",
        "failed",
        "cancelled",
        "archived",
      ],
      timeoutMinutes: 30,
      retry: 1,
      concurrencyKey: "${repo_id}:${mr_id}",
      idempotencyKey: "${repo_id}:${mr_id}:${source_commit_sha}",
    }),
    JSON.stringify({
      keepDays: 540,
      archiveEvents: true,
      archiveFindings: true,
      memoryTargets: ["viking://teams/security/review-cases/"],
    }),
    now,
    now,
  );

  insertTaskBlueprint.run(
    "daily_security_review",
    "每日全量安全检视",
    "security_review",
    "global",
    releaseBusinessTeam.id,
    reviewTeam.id,
    "env-daily-security-scan",
    "pi-runtime-adapter",
    1,
    "active",
    JSON.stringify({
      type: "cron",
      expression: "0 2 * * *",
      timezone: "Asia/Shanghai",
      idempotencyKey: "${task_blueprint_id}:${run_date}:${repo_id}:${branch}:${commit_sha}",
    }),
    JSON.stringify({
      type: "object",
      required: ["repo_scope", "branch"],
      properties: {
        repo_scope: { type: "string", enum: ["team_or_global", "all_authorized_repositories"] },
        branch: { type: "string" },
        run_date: { type: "string" },
      },
    }),
    JSON.stringify({
      type: "repository_workspace",
      templateId: "environment-template-repository-full-scan",
      checkoutMode: "full_clone",
      repoScope: "all_authorized_repositories",
      executorIdentity: "svc-security-reviewer",
    }),
    JSON.stringify({
      strategy: "leader_worker_parallel",
      leader: "agent-shield-review-leader",
      splitStrategy: "by_repository",
      defaultWorkerTool: "repo.clone.read",
      workers: [
        {
          agent: "agent-security-reviewer",
          task: "按仓库扫描敏感信息、危险调用、鉴权风险和依赖风险。",
        },
        {
          agent: "agent-code-quality-reviewer",
          task: "识别架构风险、长期可维护性风险和高风险调用链。",
        },
        {
          agent: "agent-report-writer",
          task: "汇总日报、邮件和看板摘要。",
        },
      ],
      aggregation: {
        agent: "agent-report-writer",
        method: "merge_child_runs_and_publish_digest",
      },
      conflictResolution: { method: "leader_decision" },
    }),
    JSON.stringify({
      requiredSpaces: ["viking://teams/security/security-review/", "viking://global/skills/security/"],
      skillSpaces: ["viking://global/skills/security/", "viking://teams/security/skills/dependency-audit/"],
      archiveOutputTo: ["viking://teams/security/security-findings/"],
      retrievalTrace: true,
      baseline: "viking://teams/security/memories/false-positive-rules/",
    }),
    JSON.stringify({
      adapterId: "pi-runtime-adapter",
      mode: "session",
      eventContract: "provider_event_v1",
      timeoutMinutes: 240,
    }),
    JSON.stringify({
      defaultMode: "ask",
      rules: [
        { effect: "allow", resource: "tool.repo.clone.read", scope: "authorized_repositories" },
        { effect: "allow", resource: "tool.memory.retrieve", scope: "declared_spaces" },
        { effect: "allow", resource: "tool.finding.create", scope: "task_run" },
        { effect: "allow", resource: "tool.finding.aggregate", scope: "task_run" },
        { effect: "allow", resource: "tool.artifact.write", scope: "task_archive" },
        { effect: "ask", resource: "tool.email.send", scope: "approved_distribution_list" },
        { effect: "deny", resource: "tool.repo.write", scope: "*" },
        { effect: "deny", resource: "secret.read.raw_private_key", scope: "*" },
      ],
    }),
    JSON.stringify({
      type: "object",
      required: ["findings", "mailReport", "artifacts"],
      properties: {
        findings: { type: "array" },
        mailReport: { type: "object" },
        artifacts: { type: "array" },
      },
    }),
    JSON.stringify({
      publishers: [
        { type: "email_report", pluginId: "builtin.notify.email" },
        { type: "dashboard" },
        { type: "artifact_archive" },
      ],
    }),
    JSON.stringify({
      views: ["global_task_board", "business_team_board", "security_review_board", "finding_trend_board"],
      dimensions: ["business_team", "repository", "severity", "category", "day"],
      metrics: ["scanned_repository_count", "new_findings", "repeat_findings", "email_status"],
    }),
    JSON.stringify({
      stateMachine: [
        "created",
        "queued",
        "preparing_environment",
        "running",
        "waiting_approval",
        "publishing_output",
        "partially_succeeded",
        "succeeded",
        "failed",
        "cancelled",
        "archived",
      ],
      timeoutMinutes: 240,
      retry: 2,
      splitStrategy: "by_repository",
      concurrencyKey: "${repo_scope}:${branch}",
      idempotencyKey: "${task_blueprint_id}:${run_date}:${repo_id}:${branch}:${commit_sha}",
    }),
    JSON.stringify({
      keepDays: 730,
      archiveEvents: true,
      archiveFindings: true,
      memoryTargets: ["viking://teams/security/security-findings/"],
    }),
    now,
    now,
  );
}

function ensureAgentDefinitionSeed(db: DatabaseSync) {
  const now = new Date().toISOString();
  const tenantSpace = db
    .prepare("SELECT id FROM tenant_spaces ORDER BY created_at ASC LIMIT 1")
    .get() as { id: string } | undefined;
  const platformTeam = db
    .prepare("SELECT id FROM business_teams WHERE slug = ?")
    .get("platform-team") as { id: string } | undefined;
  const releaseTeam = db
    .prepare("SELECT id FROM business_teams WHERE slug = ?")
    .get("release-team") as { id: string } | undefined;
  const piRuntime = db
    .prepare("SELECT id FROM provider_runtime_bindings WHERE id = ?")
    .get("runtime-binding-pi-default") as { id: string } | undefined;
  const glmProvider = db
    .prepare("SELECT id FROM provider_profiles WHERE name = ?")
    .get("GLM-5.1 Coding") as { id: string } | undefined;

  if (!tenantSpace || !platformTeam || !releaseTeam) return;

  const insertDefinition = db.prepare(
    "INSERT OR IGNORE INTO agent_definitions (id, tenant_space_id, owner_business_team_id, owner_user_id, source_agent_id, slug, name, role, description, system_prompt, model, default_provider_profile_id, default_runtime_binding_id, tool_bindings_json, harness_config_json, permission_policy_json, memory_scope, tags_json, visibility, status, validation_status, last_validated_at, last_validation_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertShare = db.prepare(
    "INSERT OR IGNORE INTO agent_definition_shares (id, agent_definition_id, business_team_id, access_level, created_at) VALUES (?, ?, ?, ?, ?)",
  );

  [
    {
      id: "agent-definition-shield-review-leader",
      ownerBusinessTeamId: releaseTeam.id,
      ownerUserId: "ming",
      sourceAgentId: "agent-shield-review-leader",
      slug: "shield-review-leader",
      name: "Shield Review Leader",
      role: "leader",
      description: "负责拆解 MR 检视任务、协调协作 Agent、汇总 Finding 并控制输出质量。",
      systemPrompt:
        "你是团队代码检视 Leader。你需要先拆解任务，再组织协作 Agent 并行检视，最后基于证据去重、归类、分级并给出适合提交到代码平台的结论。",
      model: "GLM-5.1",
      toolBindings: ["repo.diff.read", "memory.retrieve", "finding.aggregate", "mr.comment.write"],
      memoryScope: "team_shared",
      tags: ["code-review", "leader", "mr"],
      visibility: "team",
      status: "ready",
      validationStatus: "passed",
      lastValidationSummary: "已通过默认运行接口完成定义校验。",
      harnessConfig: { approvalMode: "allow", humanIntervention: "steer", thinkingLevel: "high", maxToolCalls: 10 },
      permissionPolicy: {
        repositoryAccess: "read_only",
        memoryAccess: "team_shared",
        secretAccess: "runtime_bound_only",
        allowedToolNames: ["search_repo", "read_file", "list_dir"],
        deniedToolNames: [],
      },
      shares: [{ businessTeamId: platformTeam.id, accessLevel: "viewer" }],
    },
    {
      id: "agent-definition-security-reviewer",
      ownerBusinessTeamId: releaseTeam.id,
      ownerUserId: "ming",
      sourceAgentId: "agent-security-reviewer",
      slug: "security-reviewer",
      name: "Security Reviewer",
      role: "reviewer",
      description: "聚焦注入、越权、敏感信息和危险调用的安全检视 Agent。",
      systemPrompt:
        "你是安全检视 Agent。请优先识别注入、越权、敏感信息暴露、依赖风险和危险调用，并基于代码证据给出可执行的修复建议。",
      model: "GLM-5.1",
      toolBindings: ["repo.diff.read", "repo.context.read", "memory.retrieve", "finding.create"],
      memoryScope: "team_shared",
      tags: ["security", "review", "mr"],
      visibility: "team",
      status: "ready",
      validationStatus: "untested",
      lastValidationSummary: null,
      harnessConfig: { approvalMode: "allow", humanIntervention: "steer", thinkingLevel: "high", maxToolCalls: 8 },
      permissionPolicy: {
        repositoryAccess: "read_only",
        memoryAccess: "team_shared",
        secretAccess: "runtime_bound_only",
        allowedToolNames: ["search_repo", "read_file", "list_dir"],
        deniedToolNames: [],
      },
      shares: [{ businessTeamId: platformTeam.id, accessLevel: "viewer" }],
    },
    {
      id: "agent-definition-report-writer",
      ownerBusinessTeamId: releaseTeam.id,
      ownerUserId: "ming",
      sourceAgentId: "agent-report-writer",
      slug: "report-writer",
      name: "Report Writer",
      role: "publisher",
      description: "把检视结果整理为 MR 评论、邮件报告和看板摘要。",
      systemPrompt:
        "你是结果发布 Agent。请把多来源 Finding 汇总为结构清晰、适合代码平台评论或邮件发送的可执行输出，避免重复和空泛表述。",
      model: "GLM-5.1",
      toolBindings: ["finding.read", "mr.comment.write", "email.send", "artifact.write"],
      memoryScope: "team_shared",
      tags: ["report", "publishing", "summary"],
      visibility: "global",
      status: "ready",
      validationStatus: "untested",
      lastValidationSummary: null,
      harnessConfig: { approvalMode: "allow", humanIntervention: "steer", thinkingLevel: "medium", maxToolCalls: 5 },
      permissionPolicy: {
        repositoryAccess: "read_only",
        memoryAccess: "team_shared",
        secretAccess: "runtime_bound_only",
        allowedToolNames: ["search_repo", "read_file", "list_dir"],
        deniedToolNames: [],
      },
      shares: [],
    },
    {
      id: "agent-definition-personal-analysis-assistant",
      ownerBusinessTeamId: platformTeam.id,
      ownerUserId: "ming",
      sourceAgentId: null,
      slug: "personal-analysis-assistant",
      name: "Personal Analysis Assistant",
      role: "analyst",
      description: "用于个人分析和方案整理的私有 Agent。",
      systemPrompt:
        "你是个人分析 Agent。请先归纳目标，再识别关键约束，最后给出分步骤建议，并明确风险与待确认项。",
      model: "GLM-5.1",
      toolBindings: ["search_repo", "read_file", "list_dir"],
      memoryScope: "private",
      tags: ["personal", "analysis"],
      visibility: "personal",
      status: "draft",
      validationStatus: "untested",
      lastValidationSummary: null,
      harnessConfig: { approvalMode: "allow", humanIntervention: "follow_up", thinkingLevel: "medium", maxToolCalls: 4 },
      permissionPolicy: {
        repositoryAccess: "read_only",
        memoryAccess: "private_only",
        secretAccess: "none",
        allowedToolNames: ["search_repo", "read_file", "list_dir"],
        deniedToolNames: [],
      },
      shares: [],
    },
  ].forEach((definition) => {
    insertDefinition.run(
      definition.id,
      tenantSpace.id,
      definition.ownerBusinessTeamId,
      definition.ownerUserId,
      definition.sourceAgentId,
      definition.slug,
      definition.name,
      definition.role,
      definition.description,
      definition.systemPrompt,
      definition.model,
      glmProvider?.id ?? null,
      piRuntime?.id ?? null,
      JSON.stringify(definition.toolBindings),
      JSON.stringify(definition.harnessConfig),
      JSON.stringify(definition.permissionPolicy),
      definition.memoryScope,
      JSON.stringify(definition.tags),
      definition.visibility,
      definition.status,
      definition.validationStatus,
      definition.validationStatus === "passed" ? now : null,
      definition.lastValidationSummary,
      now,
      now,
    );

    definition.shares.forEach((share) => {
      insertShare.run(randomUUID(), definition.id, share.businessTeamId, share.accessLevel, now);
    });
  });
}

function ensureAgentDefinitionHarnessColumns(db: DatabaseSync) {
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

function ensureRuntimeSessionAgentDefinitionColumn(db: DatabaseSync) {
  if (!tableHasColumn(db, "runtime_sessions", "agent_definition_id")) {
    db.exec("ALTER TABLE runtime_sessions ADD COLUMN agent_definition_id TEXT");
  }
}

function ensureOpenVikingKnowledgeColumns(db: DatabaseSync) {
  if (!tableHasColumn(db, "openviking_knowledge_entries", "knowledge_space_id")) {
    db.exec("ALTER TABLE openviking_knowledge_entries ADD COLUMN knowledge_space_id TEXT");
  }
}

function ensureSkillGovernanceColumns(db: DatabaseSync) {
  if (!tableHasColumn(db, "code_review_skills", "owner_business_team_id")) {
    db.exec("ALTER TABLE code_review_skills ADD COLUMN owner_business_team_id TEXT");
  }
  if (!tableHasColumn(db, "code_review_skills", "tags_json")) {
    db.exec("ALTER TABLE code_review_skills ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!tableHasColumn(db, "code_review_skills", "visibility")) {
    db.exec("ALTER TABLE code_review_skills ADD COLUMN visibility TEXT NOT NULL DEFAULT 'team'");
  }
  if (!tableHasColumn(db, "code_review_skills", "viking_uri")) {
    db.exec("ALTER TABLE code_review_skills ADD COLUMN viking_uri TEXT");
  }
}

function ensureAgentTeamCatalogColumns(db: DatabaseSync) {
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

function ensureLegacyAgentsPromotedToTeamMembers(db: DatabaseSync) {
  const teams = db.prepare("SELECT * FROM agent_teams").all() as Array<{
    id: string;
    business_team_id: string;
    slug: string;
    name: string;
    description: string;
    workflow_type: string;
    visibility: string;
    created_at: string;
  }>;
  const agents = db.prepare("SELECT * FROM agents ORDER BY team_id ASC, created_at ASC").all() as Array<{
    id: string;
    team_id: string;
    slug: string;
    name: string;
    role: string;
    persona_prompt: string;
    model: string;
    tool_bindings_json: string;
    memory_scope: string;
    status: string;
    created_at: string;
  }>;
  if (agents.length === 0) return;

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const piRuntime = db
    .prepare("SELECT id FROM provider_runtime_bindings WHERE id = ?")
    .get("runtime-binding-pi-default") as { id: string } | undefined;
  const glmProvider = db
    .prepare("SELECT id FROM provider_profiles WHERE name = ?")
    .get("GLM-5.1 Coding") as { id: string } | undefined;
  const firstTenant = db
    .prepare("SELECT id FROM tenant_spaces ORDER BY created_at ASC LIMIT 1")
    .get() as { id: string } | undefined;
  if (!firstTenant) return;

  const selectDefinitionBySource = db.prepare(
    "SELECT id FROM agent_definitions WHERE source_agent_id = ? ORDER BY updated_at DESC LIMIT 1",
  );
  const insertDefinition = db.prepare(
    "INSERT INTO agent_definitions (id, tenant_space_id, owner_business_team_id, owner_user_id, source_agent_id, slug, name, role, description, system_prompt, model, default_provider_profile_id, default_runtime_binding_id, tool_bindings_json, harness_config_json, permission_policy_json, memory_scope, tags_json, visibility, status, validation_status, last_validated_at, last_validation_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const selectMember = db.prepare("SELECT id FROM agent_team_members WHERE id = ?");
  const insertMember = db.prepare(
    "INSERT INTO agent_team_members (id, team_id, agent_definition_id, member_role, work_instruction, position, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const countMembers = db.prepare("SELECT COUNT(*) as count FROM agent_team_members WHERE team_id = ?");
  const selectShare = db.prepare(
    "SELECT id FROM agent_team_shares WHERE agent_team_id = ? AND business_team_id = ? LIMIT 1",
  );
  const insertShare = db.prepare(
    "INSERT INTO agent_team_shares (id, agent_team_id, business_team_id, access_level, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  const businessTeams = db.prepare("SELECT id FROM business_teams").all() as Array<{ id: string }>;

  for (const agent of agents) {
    if (selectMember.get(agent.id)) continue;
    const team = teamById.get(agent.team_id);
    if (!team) continue;

    const existingDefinition = selectDefinitionBySource.get(agent.id) as { id: string } | undefined;
    const definitionId = existingDefinition?.id ?? randomUUID();

    if (!existingDefinition) {
      const slug = `legacy-${agent.slug}-${agent.id.slice(0, 8)}`;
      insertDefinition.run(
        definitionId,
        firstTenant.id,
        team.business_team_id,
        "system",
        agent.id,
        slug,
        agent.name,
        agent.role,
        `由历史 Team 成员提升为可编排 Agent 定义。来源团队：${team.name}。`,
        agent.persona_prompt,
        agent.model,
        glmProvider?.id ?? null,
        piRuntime?.id ?? null,
        agent.tool_bindings_json,
        JSON.stringify({ approvalMode: "allow", humanIntervention: "steer", thinkingLevel: "medium", maxToolCalls: 6 }),
        JSON.stringify({
          repositoryAccess: "read_only",
          memoryAccess: "inherit",
          secretAccess: "runtime_bound_only",
          allowedToolNames: ["search_repo", "read_file", "list_dir"],
          deniedToolNames: [],
        }),
        agent.memory_scope,
        JSON.stringify(["legacy", team.slug]),
        team.visibility === "public" ? "global" : "team",
        agent.status === "active" ? "ready" : agent.status,
        "untested",
        null,
        null,
        agent.created_at,
        agent.created_at,
      );
    }

    const memberCount = countMembers.get(agent.team_id) as { count: number };
    insertMember.run(
      agent.id,
      agent.team_id,
      definitionId,
      agent.role,
      agent.persona_prompt,
      Number(memberCount.count ?? 0),
      agent.status,
      agent.created_at,
      agent.created_at,
    );
  }

  for (const team of teams) {
    db.prepare(
      "UPDATE agent_teams SET orchestration_prompt = ?, workflow_definition_json = ?, updated_at = COALESCE(NULLIF(updated_at, ''), created_at) WHERE id = ?",
    ).run(
      team.description,
      JSON.stringify({
        strategy: team.workflow_type,
        teamStructure: team.workflow_type === "dag" ? "leader_worker" : "collaborative",
        teamObjective: team.description,
        aggregationMethod: "leader_summary",
        conflictResolution: "leader_decision",
      }),
      team.id,
    );

    if (team.visibility === "public") {
      for (const businessTeam of businessTeams) {
        if (businessTeam.id === team.business_team_id) continue;
        if (selectShare.get(team.id, businessTeam.id)) continue;
        insertShare.run(randomUUID(), team.id, businessTeam.id, "viewer", team.created_at);
      }
    }
  }
}

export function getDb() {
  if (!database) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    archiveIncompatibleDatabaseIfNeeded();
    database = new DatabaseSync(DB_PATH);
    database.exec(schemaSql);
    ensureAgentTeamCatalogColumns(database);
    ensureAgentDefinitionHarnessColumns(database);
    ensureRuntimeSessionAgentDefinitionColumn(database);
    ensureOpenVikingKnowledgeColumns(database);
    ensureSkillGovernanceColumns(database);
    seed(database);
    ensureCodeReviewSkillSeed(database);
    ensureProviderAdapterSeed(database);
    ensureRuntimeDisplayNames(database);
    ensureCoreCaseSeed(database);
    ensureAgentDefinitionSeed(database);
    ensureLegacyAgentsPromotedToTeamMembers(database);
    ensureKnowledgeSpaceSeed(database);
    ensureTeamGovernanceSeed(database);
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
