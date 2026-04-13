import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";

type Row = Record<string, unknown>;

function toCamelCaseKey(key: string) {
  return key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function camelizeRow<T extends Row>(row: Row | null | undefined) {
  if (!row) {
    return null;
  }

  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [toCamelCaseKey(key), value]),
  );

  return normalized as T;
}

export type TeamSpace = {
  id: string;
  slug: string;
  name: string;
  description: string;
};

export type HarnessProfile = {
  id: string;
  teamSpaceId: string;
  name: string;
  systemInstruction: string;
  toolPolicyJson: string;
  approvalPolicyJson: string;
  budgetPolicyJson: string;
  outputPolicyJson: string;
  contextPolicyJson: string;
};

export type TaskDefinition = {
  id: string;
  teamSpaceId: string;
  name: string;
  triggerMode: string;
  runtimePolicy: string;
  harnessProfileId: string;
  instruction: string;
  inputSchemaJson: string;
  defaultPriority: number;
  isEnabled: number;
  nextRunAt: string | null;
};

export type RuntimeEndpoint = {
  id: string;
  teamSpaceId: string;
  name: string;
  baseUrl: string;
  runtimeKind: string;
  healthStatus: string;
  agentCatalogJson: string;
  providerCatalogJson: string;
  concurrencyLimit: number;
  activeRunCount: number;
  lastDiscoveredAt: string;
};

export type TaskRun = {
  id: string;
  teamSpaceId: string;
  taskDefinitionId: string;
  runtimeEndpointId: string;
  agentProfileId: string;
  repositoryProfileId: string | null;
  harnessProfileId: string;
  dispatchState: string;
  invocationState: string;
  resultStatus: string;
  summary: string;
  startedAt: string;
  finishedAt: string | null;
  requestedBy: string;
};

export type ExecutionEvent = {
  id: string;
  taskRunId: string;
  seq: number;
  phase: string;
  foldGroup: string;
  title: string;
  content: string;
  metadataJson: string;
  createdAt: string;
};

export type ProviderConnection = {
  id: string;
  teamSpaceId: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  modelsJson: string;
  isEnabled: number;
};

export type RepositoryProfile = {
  id: string;
  teamSpaceId: string;
  name: string;
  provider: string;
  branch: string;
  activityScore: number;
};

export type AgentProfile = {
  id: string;
  teamSpaceId: string;
  name: string;
  roleSummary: string;
  status: string;
};

export type DeveloperProfile = {
  id: string;
  teamSpaceId: string;
  name: string;
  focus: string;
  lastActiveAt: string;
};

export type WebhookEndpoint = {
  id: string;
  teamSpaceId: string;
  taskDefinitionId: string;
  name: string;
  pathKey: string;
  method: string;
  requestSchemaJson: string;
  secretHint: string;
  isEnabled: number;
};

export type DispatchPreview = {
  taskName: string;
  teamSpace: string;
  priorityScore: number;
  selectedRuntimeName: string;
  selectedRuntimeStatus: string;
  harnessName: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "agenthelix.db");

let database: DatabaseSync | null = null;

const schemaSql = `
CREATE TABLE IF NOT EXISTS team_spaces (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS harness_profiles (
  id TEXT PRIMARY KEY,
  team_space_id TEXT NOT NULL,
  name TEXT NOT NULL,
  system_instruction TEXT NOT NULL,
  tool_policy_json TEXT NOT NULL,
  approval_policy_json TEXT NOT NULL,
  budget_policy_json TEXT NOT NULL,
  output_policy_json TEXT NOT NULL,
  context_policy_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_definitions (
  id TEXT PRIMARY KEY,
  team_space_id TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger_mode TEXT NOT NULL,
  runtime_policy TEXT NOT NULL,
  harness_profile_id TEXT NOT NULL,
  instruction TEXT NOT NULL,
  input_schema_json TEXT NOT NULL,
  default_priority INTEGER NOT NULL,
  is_enabled INTEGER NOT NULL,
  next_run_at TEXT
);

CREATE TABLE IF NOT EXISTS runtime_endpoints (
  id TEXT PRIMARY KEY,
  team_space_id TEXT NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  runtime_kind TEXT NOT NULL,
  health_status TEXT NOT NULL,
  agent_catalog_json TEXT NOT NULL,
  provider_catalog_json TEXT NOT NULL,
  concurrency_limit INTEGER NOT NULL,
  active_run_count INTEGER NOT NULL,
  last_discovered_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_connections (
  id TEXT PRIMARY KEY,
  team_space_id TEXT NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  default_model TEXT NOT NULL,
  models_json TEXT NOT NULL,
  is_enabled INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS repository_profiles (
  id TEXT PRIMARY KEY,
  team_space_id TEXT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  branch TEXT NOT NULL,
  activity_score INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_profiles (
  id TEXT PRIMARY KEY,
  team_space_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role_summary TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS developer_profiles (
  id TEXT PRIMARY KEY,
  team_space_id TEXT NOT NULL,
  name TEXT NOT NULL,
  focus TEXT NOT NULL,
  last_active_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  team_space_id TEXT NOT NULL,
  task_definition_id TEXT NOT NULL,
  runtime_endpoint_id TEXT NOT NULL,
  agent_profile_id TEXT NOT NULL,
  repository_profile_id TEXT,
  harness_profile_id TEXT NOT NULL,
  dispatch_state TEXT NOT NULL,
  invocation_state TEXT NOT NULL,
  result_status TEXT NOT NULL,
  summary TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  requested_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_events (
  id TEXT PRIMARY KEY,
  task_run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  phase TEXT NOT NULL,
  fold_group TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_rules (
  id TEXT PRIMARY KEY,
  task_definition_id TEXT NOT NULL,
  cron_expr TEXT NOT NULL,
  timezone TEXT NOT NULL,
  next_run_at TEXT NOT NULL,
  is_paused INTEGER NOT NULL,
  lease_token TEXT,
  lease_expires_at TEXT
);

CREATE TABLE IF NOT EXISTS interventions (
  id TEXT PRIMARY KEY,
  task_run_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  team_space_id TEXT NOT NULL,
  task_definition_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path_key TEXT NOT NULL,
  method TEXT NOT NULL,
  request_schema_json TEXT NOT NULL,
  secret_hint TEXT NOT NULL,
  is_enabled INTEGER NOT NULL
);
`;

function nowPlus(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function seed(db: DatabaseSync) {
  const existing = db.prepare("SELECT COUNT(*) as count FROM team_spaces").get() as {
    count: number;
  };

  if (existing.count > 0) {
    return;
  }

  const insertTeam = db.prepare(
    "INSERT INTO team_spaces (id, slug, name, description) VALUES (?, ?, ?, ?)",
  );
  const insertHarness = db.prepare(
    "INSERT INTO harness_profiles (id, team_space_id, name, system_instruction, tool_policy_json, approval_policy_json, budget_policy_json, output_policy_json, context_policy_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertRuntime = db.prepare(
    "INSERT INTO runtime_endpoints (id, team_space_id, name, base_url, runtime_kind, health_status, agent_catalog_json, provider_catalog_json, concurrency_limit, active_run_count, last_discovered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertTask = db.prepare(
    "INSERT INTO task_definitions (id, team_space_id, name, trigger_mode, runtime_policy, harness_profile_id, instruction, input_schema_json, default_priority, is_enabled, next_run_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertProvider = db.prepare(
    "INSERT INTO provider_connections (id, team_space_id, name, base_url, default_model, models_json, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertRepo = db.prepare(
    "INSERT INTO repository_profiles (id, team_space_id, name, provider, branch, activity_score) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertAgent = db.prepare(
    "INSERT INTO agent_profiles (id, team_space_id, name, role_summary, status) VALUES (?, ?, ?, ?, ?)",
  );
  const insertDeveloper = db.prepare(
    "INSERT INTO developer_profiles (id, team_space_id, name, focus, last_active_at) VALUES (?, ?, ?, ?, ?)",
  );
  const insertRun = db.prepare(
    "INSERT INTO task_runs (id, team_space_id, task_definition_id, runtime_endpoint_id, agent_profile_id, repository_profile_id, harness_profile_id, dispatch_state, invocation_state, result_status, summary, started_at, finished_at, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertEvent = db.prepare(
    "INSERT INTO execution_events (id, task_run_id, seq, phase, fold_group, title, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertSchedule = db.prepare(
    "INSERT INTO schedule_rules (id, task_definition_id, cron_expr, timezone, next_run_at, is_paused, lease_token, lease_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertIntervention = db.prepare(
    "INSERT INTO interventions (id, task_run_id, actor_name, action_type, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertWebhook = db.prepare(
    "INSERT INTO webhook_endpoints (id, team_space_id, task_definition_id, name, path_key, method, request_schema_json, secret_hint, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const platformSpaceId = randomUUID();
  const releaseSpaceId = randomUUID();
  insertTeam.run(
    platformSpaceId,
    "platform-ops",
    "Platform Ops",
    "Owns production guardrails, platform maintenance, and recurring reliability work.",
  );
  insertTeam.run(
    releaseSpaceId,
    "release-automation",
    "Release Automation",
    "Handles repository events, release checks, and code-oriented webhook flows.",
  );

  const harnesses = [
    {
      id: randomUUID(),
      teamSpaceId: platformSpaceId,
      name: "Guarded Scheduler Harness",
      systemInstruction:
        "Prefer operational clarity. Summarize before acting. Ask for approval before risky tool use.",
      toolPolicyJson: JSON.stringify({
        allowed: ["read_repo", "search_logs", "create_issue", "summarize"],
        approvalRequired: ["write_repo", "shell"],
        blocked: ["delete_repo", "push_main"],
      }),
      approvalPolicyJson: JSON.stringify({
        pauseOnRisk: true,
        humanGate: ["write_repo", "push_release"],
      }),
      budgetPolicyJson: JSON.stringify({
        maxRuntimeMs: 900000,
        maxSteps: 18,
        maxToolCalls: 24,
      }),
      outputPolicyJson: JSON.stringify({
        collapseThinkingByDefault: true,
        collapseStdoutAfterLines: 20,
      }),
      contextPolicyJson: JSON.stringify({
        includeRepositories: true,
        includeWebhookPayload: false,
      }),
    },
    {
      id: randomUUID(),
      teamSpaceId: releaseSpaceId,
      name: "Repository Event Harness",
      systemInstruction:
        "Stay precise. Prefer repository facts, webhook payloads, and reproducible actions.",
      toolPolicyJson: JSON.stringify({
        allowed: ["read_repo", "diff_pr", "comment_pr", "generate_summary"],
        approvalRequired: ["write_repo", "merge_pr"],
        blocked: ["delete_branch", "force_push"],
      }),
      approvalPolicyJson: JSON.stringify({
        pauseOnRisk: true,
        humanGate: ["merge_pr", "write_repo"],
      }),
      budgetPolicyJson: JSON.stringify({
        maxRuntimeMs: 600000,
        maxSteps: 14,
        maxToolCalls: 18,
      }),
      outputPolicyJson: JSON.stringify({
        collapseThinkingByDefault: true,
        collapseStdoutAfterLines: 16,
      }),
      contextPolicyJson: JSON.stringify({
        includeRepositories: true,
        includeWebhookPayload: true,
      }),
    },
  ];

  for (const harness of harnesses) {
    insertHarness.run(
      harness.id,
      harness.teamSpaceId,
      harness.name,
      harness.systemInstruction,
      harness.toolPolicyJson,
      harness.approvalPolicyJson,
      harness.budgetPolicyJson,
      harness.outputPolicyJson,
      harness.contextPolicyJson,
    );
  }

  const runtimes = [
    {
      id: randomUUID(),
      teamSpaceId: platformSpaceId,
      name: "Local Control Runtime",
      baseUrl: "http://127.0.0.1:4096",
      runtimeKind: "opencode",
      healthStatus: "healthy",
      agentCatalogJson: JSON.stringify(["planner", "repo-analyst", "incident-helper"]),
      providerCatalogJson: JSON.stringify(["openai-compatible", "internal-router"]),
      concurrencyLimit: 4,
      activeRunCount: 2,
      lastDiscoveredAt: new Date().toISOString(),
    },
    {
      id: randomUUID(),
      teamSpaceId: releaseSpaceId,
      name: "Release Lane Runtime",
      baseUrl: "http://127.0.0.1:4097",
      runtimeKind: "opencode",
      healthStatus: "degraded",
      agentCatalogJson: JSON.stringify(["reviewer", "release-sweeper"]),
      providerCatalogJson: JSON.stringify(["openai-compatible"]),
      concurrencyLimit: 3,
      activeRunCount: 1,
      lastDiscoveredAt: new Date().toISOString(),
    },
  ];

  for (const runtime of runtimes) {
    insertRuntime.run(
      runtime.id,
      runtime.teamSpaceId,
      runtime.name,
      runtime.baseUrl,
      runtime.runtimeKind,
      runtime.healthStatus,
      runtime.agentCatalogJson,
      runtime.providerCatalogJson,
      runtime.concurrencyLimit,
      runtime.activeRunCount,
      runtime.lastDiscoveredAt,
    );
  }

  const providers = [
    {
      id: randomUUID(),
      teamSpaceId: platformSpaceId,
      name: "OpenAI Gateway",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-5.4",
      modelsJson: JSON.stringify(["gpt-5.4", "gpt-5.4-mini", "gpt-4.1"]),
      isEnabled: 1,
    },
    {
      id: randomUUID(),
      teamSpaceId: releaseSpaceId,
      name: "Enterprise Router",
      baseUrl: "https://models.internal.example/v1",
      defaultModel: "gpt-5.4-mini",
      modelsJson: JSON.stringify(["gpt-5.4-mini", "gpt-4.1-mini"]),
      isEnabled: 1,
    },
  ];

  for (const provider of providers) {
    insertProvider.run(
      provider.id,
      provider.teamSpaceId,
      provider.name,
      provider.baseUrl,
      provider.defaultModel,
      provider.modelsJson,
      provider.isEnabled,
    );
  }

  const repositories = [
    {
      id: randomUUID(),
      teamSpaceId: releaseSpaceId,
      name: "agent-helix/web",
      provider: "github",
      branch: "main",
      activityScore: 92,
    },
    {
      id: randomUUID(),
      teamSpaceId: releaseSpaceId,
      name: "agent-helix/runtime",
      provider: "github",
      branch: "main",
      activityScore: 79,
    },
    {
      id: randomUUID(),
      teamSpaceId: platformSpaceId,
      name: "platform/ops-playbooks",
      provider: "github",
      branch: "stable",
      activityScore: 67,
    },
  ];

  for (const repository of repositories) {
    insertRepo.run(
      repository.id,
      repository.teamSpaceId,
      repository.name,
      repository.provider,
      repository.branch,
      repository.activityScore,
    );
  }

  const agents = [
    {
      id: randomUUID(),
      teamSpaceId: platformSpaceId,
      name: "Control Planner",
      roleSummary: "Routes operational work, watches budgets, and requests approvals.",
      status: "active",
    },
    {
      id: randomUUID(),
      teamSpaceId: releaseSpaceId,
      name: "Release Sweeper",
      roleSummary: "Reviews repository events, release readiness, and deployment notes.",
      status: "active",
    },
  ];

  for (const agent of agents) {
    insertAgent.run(
      agent.id,
      agent.teamSpaceId,
      agent.name,
      agent.roleSummary,
      agent.status,
    );
  }

  const developers = [
    {
      id: randomUUID(),
      teamSpaceId: platformSpaceId,
      name: "Ming",
      focus: "Platform orchestration",
      lastActiveAt: new Date().toISOString(),
    },
    {
      id: randomUUID(),
      teamSpaceId: releaseSpaceId,
      name: "Ada",
      focus: "Release operations",
      lastActiveAt: nowPlus(-2),
    },
  ];

  for (const developer of developers) {
    insertDeveloper.run(
      developer.id,
      developer.teamSpaceId,
      developer.name,
      developer.focus,
      developer.lastActiveAt,
    );
  }

  const tasks = [
    {
      id: randomUUID(),
      teamSpaceId: platformSpaceId,
      name: "Daily incident triage",
      triggerMode: "scheduled",
      runtimePolicy: "prefer-healthy-runtime",
      harnessProfileId: harnesses[0].id,
      instruction:
        "Review incident indicators, summarize the operational picture, and ask for approval before taking write actions.",
      inputSchemaJson: JSON.stringify({ type: "object", properties: { windowHours: { type: "number" } } }),
      defaultPriority: 90,
      isEnabled: 1,
      nextRunAt: nowPlus(2),
    },
    {
      id: randomUUID(),
      teamSpaceId: releaseSpaceId,
      name: "PR webhook review",
      triggerMode: "webhook",
      runtimePolicy: "prefer-repo-affinity",
      harnessProfileId: harnesses[1].id,
      instruction:
        "Review repository change payloads, summarize risk, and stop before any merge-like action.",
      inputSchemaJson: JSON.stringify({ type: "object", properties: { prNumber: { type: "number" } } }),
      defaultPriority: 82,
      isEnabled: 1,
      nextRunAt: null,
    },
    {
      id: randomUUID(),
      teamSpaceId: platformSpaceId,
      name: "Runtime inventory refresh",
      triggerMode: "manual",
      runtimePolicy: "prefer-any-healthy",
      harnessProfileId: harnesses[0].id,
      instruction:
        "Refresh runtime catalogs, verify health, and summarize changes.",
      inputSchemaJson: JSON.stringify({ type: "object", properties: {} }),
      defaultPriority: 64,
      isEnabled: 1,
      nextRunAt: null,
    },
  ];

  for (const task of tasks) {
    insertTask.run(
      task.id,
      task.teamSpaceId,
      task.name,
      task.triggerMode,
      task.runtimePolicy,
      task.harnessProfileId,
      task.instruction,
      task.inputSchemaJson,
      task.defaultPriority,
      task.isEnabled,
      task.nextRunAt,
    );
  }

  const runs = [
    {
      id: randomUUID(),
      teamSpaceId: platformSpaceId,
      taskDefinitionId: tasks[0].id,
      runtimeEndpointId: runtimes[0].id,
      agentProfileId: agents[0].id,
      repositoryProfileId: repositories[2].id,
      harnessProfileId: harnesses[0].id,
      dispatchState: "running",
      invocationState: "streaming",
      resultStatus: "in_progress",
      summary: "Scanning recent incidents and correlating deployment shifts before asking for approval.",
      startedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      finishedAt: null,
      requestedBy: "scheduler",
    },
    {
      id: randomUUID(),
      teamSpaceId: releaseSpaceId,
      taskDefinitionId: tasks[1].id,
      runtimeEndpointId: runtimes[1].id,
      agentProfileId: agents[1].id,
      repositoryProfileId: repositories[0].id,
      harnessProfileId: harnesses[1].id,
      dispatchState: "waiting_human",
      invocationState: "paused",
      resultStatus: "awaiting_human",
      summary: "PR review completed. Waiting for a human decision before repository write-back.",
      startedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
      finishedAt: null,
      requestedBy: "webhook/github",
    },
    {
      id: randomUUID(),
      teamSpaceId: platformSpaceId,
      taskDefinitionId: tasks[2].id,
      runtimeEndpointId: runtimes[0].id,
      agentProfileId: agents[0].id,
      repositoryProfileId: null,
      harnessProfileId: harnesses[0].id,
      dispatchState: "completed",
      invocationState: "completed",
      resultStatus: "success",
      summary: "Runtime discovery sweep completed with one degraded endpoint and no hard failures.",
      startedAt: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
      finishedAt: new Date(Date.now() - 1000 * 60 * 138).toISOString(),
      requestedBy: "Ming",
    },
  ];

  for (const run of runs) {
    insertRun.run(
      run.id,
      run.teamSpaceId,
      run.taskDefinitionId,
      run.runtimeEndpointId,
      run.agentProfileId,
      run.repositoryProfileId,
      run.harnessProfileId,
      run.dispatchState,
      run.invocationState,
      run.resultStatus,
      run.summary,
      run.startedAt,
      run.finishedAt,
      run.requestedBy,
    );
  }

  const events = [
    {
      taskRunId: runs[0].id,
      phase: "thinking",
      foldGroup: "Thinking",
      title: "Situation scan",
      content:
        "Compared alert spikes against deployment timing and identified two likely correlations worth checking before writing back.",
    },
    {
      taskRunId: runs[0].id,
      phase: "execution",
      foldGroup: "Execution",
      title: "Query incident ledger",
      content: "Fetched the last 24 hours of incident summaries and deployment annotations.",
    },
    {
      taskRunId: runs[0].id,
      phase: "text",
      foldGroup: "Text Output",
      title: "Operator update",
      content:
        "Current read suggests the checkout latency spike lines up with the config rollout. No write action taken yet.",
    },
    {
      taskRunId: runs[1].id,
      phase: "thinking",
      foldGroup: "Thinking",
      title: "Risk assessment",
      content:
        "The PR adds deployment automation and touches release permissions. This crosses the harness approval threshold.",
    },
    {
      taskRunId: runs[1].id,
      phase: "execution",
      foldGroup: "Execution",
      title: "Inspect repository diff",
      content: "Fetched changed files, commit summaries, and PR metadata from the repository webhook payload.",
    },
    {
      taskRunId: runs[1].id,
      phase: "text",
      foldGroup: "Text Output",
      title: "Human gate opened",
      content:
        "Review finished. Waiting for a maintainer to approve repository write-back before proceeding.",
    },
    {
      taskRunId: runs[2].id,
      phase: "system",
      foldGroup: "System Events",
      title: "Runtime refresh completed",
      content: "Discovered two OpenCode endpoints, one healthy and one degraded.",
    },
  ];

  for (const [index, event] of events.entries()) {
    insertEvent.run(
      randomUUID(),
      event.taskRunId,
      index + 1,
      event.phase,
      event.foldGroup,
      event.title,
      event.content,
      JSON.stringify({ source: "seed" }),
      new Date(Date.now() - index * 1000 * 60 * 4).toISOString(),
    );
  }

  insertSchedule.run(
    randomUUID(),
    tasks[0].id,
    "0 */6 * * *",
    "Asia/Shanghai",
    nowPlus(2),
    0,
    null,
    null,
  );

  insertIntervention.run(
    randomUUID(),
    runs[1].id,
    "Ada",
    "pause_for_approval",
    "Repository write-back requires a maintainer decision.",
    new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  );

  insertWebhook.run(
    randomUUID(),
    releaseSpaceId,
    tasks[1].id,
    "GitHub PR intake",
    "github-pr",
    "POST",
    JSON.stringify({
      required: ["repository", "pull_request", "action"],
      type: "object",
    }),
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
