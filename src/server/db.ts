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

export type World = {
  id: string;
  slug: string;
  name: string;
  ownerUserId: string;
  status: string;
  quotaLimitJson: string;
  modelWhitelistJson: string;
  globalGuardrailsJson: string;
  defaultHarnessId: string | null;
  createdAt: string;
};

export type Kingdom = {
  id: string;
  worldId: string;
  slug: string;
  name: string;
  lordUserId: string;
  status: string;
  balance: number;
  creditLimit: number;
  privateToolRefsJson: string;
  privateMemoryNamespace: string;
  policyJson: string;
  createdAt: string;
};

export type HarnessProfile = {
  id: string;
  worldId: string | null;
  kingdomId: string | null;
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
  kingdomId: string;
  slug: string;
  name: string;
  description: string;
  captainAgentId: string | null;
  workflowType: string;
  inputSchemaJson: string;
  outputSchemaJson: string;
  maxConcurrency: number;
  timeoutMs: number;
  successRateThreshold: number;
  pricingModelJson: string;
  visibility: string;
  defaultHarnessId: string | null;
  createdAt: string;
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

export type ProviderProfile = {
  id: string;
  worldId: string;
  name: string;
  baseUrl: string;
  apiStyle: string;
  defaultModel: string;
  modelsJson: string;
  isEnabled: number;
  createdAt: string;
};

export type RuntimeEndpoint = {
  id: string;
  worldId: string;
  kingdomId: string | null;
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

export type Contract = {
  id: string;
  providerTeamId: string;
  consumerKingdomId: string;
  pricingModelJson: string;
  slaJson: string;
  accessScopeJson: string;
  serviceAccountRef: string;
  status: string;
  createdAt: string;
};

export type TavernListing = {
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
  kingdomId: string;
  teamId: string;
  name: string;
  scheduleKind: string;
  cadence: string;
  nextRunAt: string | null;
  inputPayloadJson: string;
  isEnabled: number;
  createdAt: string;
};

export type Quest = {
  id: string;
  worldId: string;
  kingdomId: string;
  teamId: string;
  contractId: string | null;
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

export type QuestPlan = {
  id: string;
  questId: string;
  plannerMode: string;
  dagJson: string;
  summary: string;
  createdAt: string;
};

export type QuestNode = {
  id: string;
  questId: string;
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
  questId: string;
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
  questId: string;
  nodeId: string | null;
  seq: number;
  phase: string;
  foldGroup: string;
  title: string;
  content: string;
  metadataJson: string;
  createdAt: string;
};

export type QuestIntervention = {
  id: string;
  questId: string;
  nodeId: string | null;
  kind: string;
  status: string;
  requestedAction: string;
  resolutionNote: string | null;
  requestedAt: string;
  resolvedAt: string | null;
};

export type RepositoryProfile = {
  id: string;
  kingdomId: string;
  name: string;
  provider: string;
  branch: string;
  activityScore: number;
  lastQuestCount: number;
};

export type DeveloperProfile = {
  id: string;
  kingdomId: string;
  name: string;
  focus: string;
  lastActiveAt: string;
};

export type WebhookEndpoint = {
  id: string;
  kingdomId: string;
  teamId: string;
  name: string;
  pathKey: string;
  method: string;
  requestSchemaJson: string;
  secretHint: string;
  isEnabled: number;
};

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "agentworld.db");

const schemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  quota_limit_json TEXT NOT NULL,
  model_whitelist_json TEXT NOT NULL,
  global_guardrails_json TEXT NOT NULL,
  default_harness_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kingdoms (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  lord_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  balance REAL NOT NULL,
  credit_limit REAL NOT NULL,
  private_tool_refs_json TEXT NOT NULL,
  private_memory_namespace TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS harness_profiles (
  id TEXT PRIMARY KEY,
  world_id TEXT,
  kingdom_id TEXT,
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
  kingdom_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  captain_agent_id TEXT,
  workflow_type TEXT NOT NULL,
  input_schema_json TEXT NOT NULL,
  output_schema_json TEXT NOT NULL,
  max_concurrency INTEGER NOT NULL,
  timeout_ms INTEGER NOT NULL,
  success_rate_threshold REAL NOT NULL,
  pricing_model_json TEXT NOT NULL,
  visibility TEXT NOT NULL,
  default_harness_id TEXT,
  created_at TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS provider_profiles (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_style TEXT NOT NULL,
  default_model TEXT NOT NULL,
  models_json TEXT NOT NULL,
  is_enabled INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_endpoints (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  kingdom_id TEXT,
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

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  provider_team_id TEXT NOT NULL,
  consumer_kingdom_id TEXT NOT NULL,
  pricing_model_json TEXT NOT NULL,
  sla_json TEXT NOT NULL,
  access_scope_json TEXT NOT NULL,
  service_account_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tavern_listings (
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
  kingdom_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  schedule_kind TEXT NOT NULL,
  cadence TEXT NOT NULL,
  next_run_at TEXT,
  input_payload_json TEXT NOT NULL,
  is_enabled INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quests (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  kingdom_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  contract_id TEXT,
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

CREATE TABLE IF NOT EXISTS quest_plans (
  id TEXT PRIMARY KEY,
  quest_id TEXT NOT NULL,
  planner_mode TEXT NOT NULL,
  dag_json TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quest_nodes (
  id TEXT PRIMARY KEY,
  quest_id TEXT NOT NULL,
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
  quest_id TEXT NOT NULL,
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
  quest_id TEXT NOT NULL,
  node_id TEXT,
  seq INTEGER NOT NULL,
  phase TEXT NOT NULL,
  fold_group TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quest_interventions (
  id TEXT PRIMARY KEY,
  quest_id TEXT NOT NULL,
  node_id TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_action TEXT NOT NULL,
  resolution_note TEXT,
  requested_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS repository_profiles (
  id TEXT PRIMARY KEY,
  kingdom_id TEXT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  branch TEXT NOT NULL,
  activity_score INTEGER NOT NULL,
  last_quest_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS developer_profiles (
  id TEXT PRIMARY KEY,
  kingdom_id TEXT NOT NULL,
  name TEXT NOT NULL,
  focus TEXT NOT NULL,
  last_active_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  kingdom_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path_key TEXT NOT NULL,
  method TEXT NOT NULL,
  request_schema_json TEXT NOT NULL,
  secret_hint TEXT NOT NULL,
  is_enabled INTEGER NOT NULL
);
`;

let database: DatabaseSync | null = null;

function seed(db: DatabaseSync) {
  const existing = db.prepare("SELECT COUNT(*) as count FROM worlds").get() as {
    count: number;
  };

  if (existing.count > 0) return;

  const now = Date.now();
  const iso = (offsetMs = 0) => new Date(now + offsetMs).toISOString();

  const insertWorld = db.prepare(
    "INSERT INTO worlds (id, slug, name, owner_user_id, status, quota_limit_json, model_whitelist_json, global_guardrails_json, default_harness_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertKingdom = db.prepare(
    "INSERT INTO kingdoms (id, world_id, slug, name, lord_user_id, status, balance, credit_limit, private_tool_refs_json, private_memory_namespace, policy_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertHarness = db.prepare(
    "INSERT INTO harness_profiles (id, world_id, kingdom_id, team_id, name, system_instruction, tool_policy_json, approval_policy_json, budget_policy_json, output_policy_json, security_policy_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertTeam = db.prepare(
    "INSERT INTO agent_teams (id, kingdom_id, slug, name, description, captain_agent_id, workflow_type, input_schema_json, output_schema_json, max_concurrency, timeout_ms, success_rate_threshold, pricing_model_json, visibility, default_harness_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertAgent = db.prepare(
    "INSERT INTO agents (id, team_id, slug, name, role, persona_prompt, model, short_term_window, rag_config_json, tool_bindings_json, memory_scope, safety_policy_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertProvider = db.prepare(
    "INSERT INTO provider_profiles (id, world_id, name, base_url, api_style, default_model, models_json, is_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertRuntime = db.prepare(
    "INSERT INTO runtime_endpoints (id, world_id, kingdom_id, name, base_url, runtime_kind, health_status, agent_catalog_json, provider_catalog_json, concurrency_limit, active_run_count, last_discovered_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertContract = db.prepare(
    "INSERT INTO contracts (id, provider_team_id, consumer_kingdom_id, pricing_model_json, sla_json, access_scope_json, service_account_ref, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertListing = db.prepare(
    "INSERT INTO tavern_listings (id, team_id, resume_json, recruitment_mode, tags_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertSchedule = db.prepare(
    "INSERT INTO schedule_templates (id, kingdom_id, team_id, name, schedule_kind, cadence, next_run_at, input_payload_json, is_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertQuest = db.prepare(
    "INSERT INTO quests (id, world_id, kingdom_id, team_id, contract_id, source_type, source_ref, status, priority, input_payload_json, output_payload_json, cost_estimate, cost_actual, trace_id, requested_by, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertPlan = db.prepare(
    "INSERT INTO quest_plans (id, quest_id, planner_mode, dag_json, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertNode = db.prepare(
    "INSERT INTO quest_nodes (id, quest_id, plan_id, node_key, agent_id, depends_on_json, input_json, output_json, status, attempt_count, max_attempts, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertSpan = db.prepare(
    "INSERT INTO trace_spans (id, trace_id, parent_span_id, quest_id, node_id, kind, status, started_at, ended_at, attributes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertEvent = db.prepare(
    "INSERT INTO event_logs (id, trace_id, quest_id, node_id, seq, phase, fold_group, title, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertIntervention = db.prepare(
    "INSERT INTO quest_interventions (id, quest_id, node_id, kind, status, requested_action, resolution_note, requested_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertRepo = db.prepare(
    "INSERT INTO repository_profiles (id, kingdom_id, name, provider, branch, activity_score, last_quest_count) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertDeveloper = db.prepare(
    "INSERT INTO developer_profiles (id, kingdom_id, name, focus, last_active_at) VALUES (?, ?, ?, ?, ?)",
  );
  const insertWebhook = db.prepare(
    "INSERT INTO webhook_endpoints (id, kingdom_id, team_id, name, path_key, method, request_schema_json, secret_hint, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const updateCaptain = db.prepare(
    "UPDATE agent_teams SET captain_agent_id = ? WHERE id = ?",
  );

  const worldId = randomUUID();
  const platformKingdomId = randomUUID();
  const releaseKingdomId = randomUUID();

  const worldHarnessId = randomUUID();
  const platformHarnessId = randomUUID();
  const releaseHarnessId = randomUUID();
  const tavernHarnessId = randomUUID();

  insertWorld.run(
    worldId,
    "open-frontier",
    "Open Frontier",
    "ava",
    "active",
    JSON.stringify({ monthlyUsd: 5000, maxRunningQuests: 40 }),
    JSON.stringify(["gpt-5.4", "gpt-5.4-mini", "o4-mini"]),
    JSON.stringify({
      promptScan: true,
      outputScan: true,
      maxQuestUsd: 120,
      allowPublicListings: true,
    }),
    worldHarnessId,
    iso(-1000 * 60 * 60 * 24 * 20),
  );

  insertKingdom.run(
    platformKingdomId,
    worldId,
    "platform-guild",
    "Platform Guild",
    "ming",
    "active",
    1820,
    500,
    JSON.stringify(["repo.readonly", "incident.index", "search.web"]),
    "world/open-frontier/platform",
    JSON.stringify({ preferredProvider: "openai-primary", spendCeilingUsd: 1800 }),
    iso(-1000 * 60 * 60 * 24 * 15),
  );
  insertKingdom.run(
    releaseKingdomId,
    worldId,
    "release-guild",
    "Release Guild",
    "sophia",
    "active",
    910,
    300,
    JSON.stringify(["github.pr", "repo.diff", "ci.read"]),
    "world/open-frontier/release",
    JSON.stringify({ preferredProvider: "azure-fallback", spendCeilingUsd: 950 }),
    iso(-1000 * 60 * 60 * 24 * 12),
  );

  insertHarness.run(
    worldHarnessId,
    worldId,
    null,
    null,
    "World Baseline Harness",
    "Always produce structured operational output. Explain plan changes. Escalate risky actions.",
    JSON.stringify({
      allowed: ["search_web", "read_repo", "openai_chat", "opencode_runtime"],
      blocked: ["raw_network"],
      approvalRequired: ["write_repo", "shell_exec"],
    }),
    JSON.stringify({ requiredOn: ["write_repo", "secret_access"] }),
    JSON.stringify({ maxRuntimeMs: 20 * 60 * 1000, maxSteps: 18, maxToolCalls: 24 }),
    JSON.stringify({ collapseThinkingByDefault: true, structuredOutput: true }),
    JSON.stringify({ promptScan: true, outputScan: true, redactSecrets: true }),
    iso(-1000 * 60 * 60 * 24 * 20),
  );
  insertHarness.run(
    platformHarnessId,
    worldId,
    platformKingdomId,
    null,
    "Platform Guard Harness",
    "Prefer read-only investigation. Any production-changing action must wait for a human gate.",
    JSON.stringify({
      allowed: ["search_web", "read_repo", "incident_index", "openai_chat"],
      blocked: ["write_repo"],
      approvalRequired: ["shell_exec"],
    }),
    JSON.stringify({ requiredOn: ["shell_exec"] }),
    JSON.stringify({ maxRuntimeMs: 15 * 60 * 1000, maxSteps: 14, maxToolCalls: 18 }),
    JSON.stringify({ collapseThinkingByDefault: true, structuredOutput: true }),
    JSON.stringify({ promptScan: true, outputScan: true }),
    iso(-1000 * 60 * 60 * 24 * 14),
  );
  insertHarness.run(
    releaseHarnessId,
    worldId,
    releaseKingdomId,
    null,
    "Release Write Gate Harness",
    "Review repository intent carefully. Never merge or write without explicit approval.",
    JSON.stringify({
      allowed: ["read_repo", "github_pr", "ci_read", "openai_chat"],
      blocked: [],
      approvalRequired: ["write_repo", "merge_pull_request"],
    }),
    JSON.stringify({ requiredOn: ["write_repo", "merge_pull_request"] }),
    JSON.stringify({ maxRuntimeMs: 18 * 60 * 1000, maxSteps: 16, maxToolCalls: 20 }),
    JSON.stringify({ collapseThinkingByDefault: true, structuredOutput: true }),
    JSON.stringify({ promptScan: true, outputScan: true }),
    iso(-1000 * 60 * 60 * 24 * 14),
  );
  insertHarness.run(
    tavernHarnessId,
    worldId,
    null,
    null,
    "Tavern Readonly Harness",
    "Marketplace calls are read-only unless a contract explicitly enables more.",
    JSON.stringify({
      allowed: ["openai_chat", "search_web", "read_repo"],
      blocked: ["write_repo", "shell_exec"],
      approvalRequired: [],
    }),
    JSON.stringify({ requiredOn: [] }),
    JSON.stringify({ maxRuntimeMs: 10 * 60 * 1000, maxSteps: 10, maxToolCalls: 12 }),
    JSON.stringify({ collapseThinkingByDefault: true, structuredOutput: true }),
    JSON.stringify({ promptScan: true, outputScan: true }),
    iso(-1000 * 60 * 60 * 24 * 14),
  );

  const incidentTeamId = randomUUID();
  const researchTeamId = randomUUID();
  const reviewTeamId = randomUUID();

  insertTeam.run(
    incidentTeamId,
    platformKingdomId,
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
    platformHarnessId,
    iso(-1000 * 60 * 60 * 24 * 10),
  );
  insertTeam.run(
    researchTeamId,
    platformKingdomId,
    "research-relay",
    "Research Relay",
    "Plans multi-step research quests and returns structured findings for other kingdoms.",
    null,
    "dag",
    JSON.stringify({ type: "object", required: ["brief", "audience"] }),
    JSON.stringify({ type: "object", required: ["findings", "recommendations"] }),
    3,
    20 * 60 * 1000,
    0.9,
    JSON.stringify({ baseUsd: 0.35, tokenMultiplier: 1.15 }),
    "public",
    tavernHarnessId,
    iso(-1000 * 60 * 60 * 24 * 9),
  );
  insertTeam.run(
    reviewTeamId,
    releaseKingdomId,
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
    releaseHarnessId,
    iso(-1000 * 60 * 60 * 24 * 8),
  );

  const scoutAgentId = randomUUID();
  const analystAgentId = randomUUID();
  const captainAgentId = randomUUID();
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
    captainAgentId,
    researchTeamId,
    "captain-meridian",
    "Captain Meridian",
    "captain",
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

  updateCaptain.run(captainAgentId, researchTeamId);

  insertProvider.run(
    randomUUID(),
    worldId,
    "OpenAI Primary",
    "https://api.openai.com/v1",
    "openai",
    "gpt-5.4",
    JSON.stringify(["gpt-5.4", "gpt-5.4-mini", "o4-mini"]),
    1,
    iso(-1000 * 60 * 60 * 24 * 6),
  );
  insertProvider.run(
    randomUUID(),
    worldId,
    "Azure Fallback",
    "https://example-azure-openai.local/v1",
    "openai",
    "gpt-5.4-mini",
    JSON.stringify(["gpt-5.4-mini"]),
    1,
    iso(-1000 * 60 * 60 * 24 * 6),
  );

  insertRuntime.run(
    randomUUID(),
    worldId,
    platformKingdomId,
    "OpenCode Lab",
    "http://127.0.0.1:4096",
    "opencode",
    "offline",
    JSON.stringify(["captain-meridian", "market-scout"]),
    JSON.stringify(["OpenAI Primary"]),
    3,
    1,
    iso(-1000 * 60 * 15),
    iso(-1000 * 60 * 60 * 24 * 5),
  );
  insertRuntime.run(
    randomUUID(),
    worldId,
    releaseKingdomId,
    "Release Lane Runtime",
    "http://127.0.0.1:4097",
    "opencode",
    "offline",
    JSON.stringify(["release-reviewer", "merge-steward"]),
    JSON.stringify(["Azure Fallback"]),
    2,
    1,
    iso(-1000 * 60 * 10),
    iso(-1000 * 60 * 60 * 24 * 5),
  );

  const researchContractId = randomUUID();
  insertContract.run(
    researchContractId,
    researchTeamId,
    releaseKingdomId,
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
    platformKingdomId,
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
    platformKingdomId,
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
    releaseKingdomId,
    reviewTeamId,
    "PR intake webhook mirror",
    "event",
    "Webhook only",
    null,
    JSON.stringify({ repository: "agent-world" }),
    1,
    iso(-1000 * 60 * 60 * 24 * 2),
  );

  const runningQuestId = randomUUID();
  const awaitingQuestId = randomUUID();
  const completedQuestId = randomUUID();

  const runningTraceId = randomUUID();
  const awaitingTraceId = randomUUID();
  const completedTraceId = randomUUID();

  insertQuest.run(
    runningQuestId,
    worldId,
    platformKingdomId,
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
  insertQuest.run(
    awaitingQuestId,
    worldId,
    releaseKingdomId,
    reviewTeamId,
    researchContractId,
    "webhook",
    "github/pr/481",
    "awaiting",
    82,
    JSON.stringify({ repository: "agent-world", pullRequest: 481 }),
    null,
    1.6,
    0.8,
    awaitingTraceId,
    "webhook/github",
    iso(-1000 * 60 * 58),
    null,
  );
  insertQuest.run(
    completedQuestId,
    worldId,
    releaseKingdomId,
    researchTeamId,
    researchContractId,
    "contract",
    "contract/research-relay",
    "completed",
    75,
    JSON.stringify({ brief: "Compare agent platforms for Q2", audience: "release leadership" }),
    JSON.stringify({
      findings: ["Strong managed-agent posture", "Good local-first ergonomics"],
      recommendations: ["Pilot with small guild", "Keep write tools behind approval"],
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
    runningQuestId,
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
    awaitingQuestId,
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
    completedQuestId,
    "captain_agent",
    JSON.stringify({
      nodes: [
        { id: "scan", agent: "market-scout" },
        { id: "synthesize", agent: "captain-meridian" },
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
    runningQuestId,
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
    runningQuestId,
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
    awaitingQuestId,
    awaitingPlanId,
    "review",
    reviewerAgentId,
    JSON.stringify([]),
    JSON.stringify({ repository: "agent-world", pr: 481 }),
    JSON.stringify({ decision: "needs_approval", commentary: "Low risk, but write-back pending" }),
    "completed",
    1,
    2,
    iso(-1000 * 60 * 56),
    iso(-1000 * 60 * 49),
  );
  insertNode.run(
    awaitingNodeWriteback,
    awaitingQuestId,
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
    completedQuestId,
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
    completedQuestId,
    completedPlanId,
    "synthesize",
    captainAgentId,
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
    runningQuestId,
    null,
    "quest",
    "open",
    iso(-1000 * 60 * 34),
    null,
    JSON.stringify({ team: "Incident Observatory" }),
  );
  insertSpan.run(
    randomUUID(),
    awaitingTraceId,
    null,
    awaitingQuestId,
    null,
    "quest",
    "open",
    iso(-1000 * 60 * 58),
    null,
    JSON.stringify({ team: "PR Vanguard" }),
  );
  insertSpan.run(
    randomUUID(),
    completedTraceId,
    null,
    completedQuestId,
    null,
    "quest",
    "ok",
    iso(-1000 * 60 * 60 * 4),
    iso(-1000 * 60 * 60 * 3 - 1000 * 60 * 12),
    JSON.stringify({ team: "Research Relay" }),
  );

  [
    [
      runningTraceId,
      runningQuestId,
      null,
      1,
      "planning",
      "Planning",
      "Quest accepted",
      "Schedule tick created the quest and selected the Incident Observatory team.",
      iso(-1000 * 60 * 34),
    ],
    [
      runningTraceId,
      runningQuestId,
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
      runningQuestId,
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
      awaitingQuestId,
      null,
      1,
      "planning",
      "Planning",
      "Webhook quest created",
      "GitHub PR webhook became a governed Quest before any repository action was attempted.",
      iso(-1000 * 60 * 58),
    ],
    [
      awaitingTraceId,
      awaitingQuestId,
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
      awaitingQuestId,
      awaitingNodeWriteback,
      3,
      "approval_required",
      "Human Actions",
      "Write-back blocked",
      "Merge Steward prepared repository write-back steps, but the Release Write Gate Harness paused execution for approval.",
      iso(-1000 * 60 * 48),
    ],
    [
      completedTraceId,
      completedQuestId,
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
      completedQuestId,
      completedNodeSynthesize,
      2,
      "text_delta",
      "Synthesis",
      "Brief delivered",
      "Captain Meridian converted raw evidence into a brief with findings, risks, and rollout recommendations.",
      iso(-1000 * 60 * 60 * 3 - 1000 * 60 * 14),
    ],
  ].forEach(([traceId, questId, nodeId, seq, phase, foldGroup, title, content, createdAt]) => {
    insertEvent.run(
      randomUUID(),
      traceId,
      questId,
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
    awaitingQuestId,
    awaitingNodeWriteback,
    "approval",
    "pending",
    "Approve repository write-back for PR #481",
    null,
    iso(-1000 * 60 * 47),
    null,
  );

  insertRepo.run(randomUUID(), platformKingdomId, "platform-core", "github", "main", 92, 14);
  insertRepo.run(randomUUID(), releaseKingdomId, "agent-world", "github", "main", 97, 21);
  insertRepo.run(randomUUID(), releaseKingdomId, "release-bot", "github", "main", 78, 8);

  insertDeveloper.run(randomUUID(), platformKingdomId, "Ming", "platform reliability", iso(-1000 * 60 * 12));
  insertDeveloper.run(randomUUID(), releaseKingdomId, "Sophia", "release automation", iso(-1000 * 60 * 20));
  insertDeveloper.run(randomUUID(), platformKingdomId, "Ava", "agent governance", iso(-1000 * 60 * 28));

  insertWebhook.run(
    randomUUID(),
    releaseKingdomId,
    reviewTeamId,
    "GitHub PR Intake",
    "github-pr",
    "POST",
    JSON.stringify({ type: "object", required: ["repository", "pull_request", "action"] }),
    "ghpr-****",
    1,
  );
}

export function getDb() {
  if (!database) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    database = new DatabaseSync(DB_PATH);
    database.exec(schemaSql);
    seed(database);
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
