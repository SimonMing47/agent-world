export const schemaSql = `
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

CREATE TABLE IF NOT EXISTS auth_provider_configs (
  id TEXT PRIMARY KEY,
  tenant_space_id TEXT,
  name TEXT NOT NULL,
  adapter_key TEXT NOT NULL,
  status TEXT NOT NULL,
  issuer_url TEXT NOT NULL,
  authorize_url TEXT NOT NULL,
  token_url TEXT NOT NULL,
  userinfo_url TEXT NOT NULL,
  jwks_url TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret_ref TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  mapping_json TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_users (
  id TEXT PRIMARY KEY,
  tenant_space_id TEXT,
  auth_provider_config_id TEXT,
  external_user_id TEXT NOT NULL,
  employee_no TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  is_system_admin INTEGER NOT NULL,
  primary_business_team_id TEXT,
  profile_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS local_auth_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  force_password_change INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_password_change_at TEXT
);

CREATE TABLE IF NOT EXISTS identity_user_business_team_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  business_team_id TEXT NOT NULL,
  membership_source TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  role_title TEXT NOT NULL,
  is_primary INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  auth_provider_config_id TEXT,
  session_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_whitelist_rules (
  id TEXT PRIMARY KEY,
  tenant_space_id TEXT,
  business_team_id TEXT NOT NULL,
  allow_descendants INTEGER NOT NULL,
  note TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  auth_provider_config_id TEXT,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  requested_business_team_hint TEXT NOT NULL,
  request_note TEXT NOT NULL,
  status TEXT NOT NULL,
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
  avatar_config_json TEXT NOT NULL DEFAULT '{}',
  capability_profile_json TEXT NOT NULL DEFAULT '{}',
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

CREATE TABLE IF NOT EXISTS knowledge_entries (
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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  revision INTEGER NOT NULL DEFAULT 1
);

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
  knowledge_category TEXT NOT NULL DEFAULT 'domain',
  repository_name TEXT,
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

CREATE TABLE IF NOT EXISTS knowledge_api_tokens (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL,
  expires_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;
