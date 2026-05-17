import { randomUUID } from "node:crypto";
import {
  execute,
  queryAll,
  queryOne,
  type AccessGrant,
  type BusinessTeam,
  type CodebaseOperatorToken,
  type CodebaseProfile,
  type ConnectorProfile,
  type ExecutionPolicy,
  type McpServerProfile,
  type ServiceCatalogListing,
  type TeamAssetGrant,
  type TeamMember,
  type TeamPermissionGrant,
  type TenantSpace,
} from "@/server/db";

function nowIso() {
  return new Date().toISOString();
}

function normalizeJson(value: unknown, fallback: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return JSON.stringify(fallback);
    }
  }
  return JSON.stringify(value ?? fallback, null, 2);
}

export function listTeamMembers() {
  return queryAll<TeamMember>(
    "SELECT * FROM team_members WHERE status <> 'deleted' ORDER BY business_team_id ASC, name ASC",
  );
}

export function upsertTenantSpace(input: Partial<TenantSpace> & Pick<TenantSpace, "name" | "slug" | "ownerUserId">) {
  const id = input.id || randomUUID();
  const current = queryOne<TenantSpace>("SELECT * FROM tenant_spaces WHERE id = ?", id);
  execute(
    "INSERT OR REPLACE INTO tenant_spaces (id, slug, name, owner_user_id, status, quota_limit_json, model_whitelist_json, global_guardrails_json, default_execution_policy_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.slug,
    input.name,
    input.ownerUserId,
    input.status ?? current?.status ?? "active",
    normalizeJson(input.quotaLimitJson ?? current?.quotaLimitJson, {}),
    normalizeJson(input.modelWhitelistJson ?? current?.modelWhitelistJson, []),
    normalizeJson(input.globalGuardrailsJson ?? current?.globalGuardrailsJson, {}),
    input.defaultExecutionPolicyId ?? current?.defaultExecutionPolicyId ?? null,
    current?.createdAt ?? nowIso(),
  );
  return queryOne<TenantSpace>("SELECT * FROM tenant_spaces WHERE id = ?", id);
}

export function upsertBusinessTeam(input: Partial<BusinessTeam> & Pick<BusinessTeam, "tenantSpaceId" | "name" | "slug">) {
  const id = input.id || randomUUID();
  const current = queryOne<BusinessTeam>("SELECT * FROM business_teams WHERE id = ?", id);
  execute(
    "INSERT OR REPLACE INTO business_teams (id, tenant_space_id, slug, name, owner_user_id, status, balance, credit_limit, private_tool_refs_json, private_memory_namespace, policy_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.tenantSpaceId,
    input.slug,
    input.name,
    input.ownerUserId ?? current?.ownerUserId ?? "console",
    input.status ?? current?.status ?? "active",
    input.balance ?? current?.balance ?? 0,
    input.creditLimit ?? current?.creditLimit ?? 1000,
    normalizeJson(input.privateToolRefsJson ?? current?.privateToolRefsJson, []),
    input.privateMemoryNamespace ?? current?.privateMemoryNamespace ?? `viking://teams/${input.slug}/`,
    normalizeJson(input.policyJson ?? current?.policyJson, {}),
    current?.createdAt ?? nowIso(),
  );
  return queryOne<BusinessTeam>("SELECT * FROM business_teams WHERE id = ?", id);
}

export function upsertExecutionPolicy(input: Partial<ExecutionPolicy> & Pick<ExecutionPolicy, "name">) {
  const id = input.id || randomUUID();
  const current = queryOne<ExecutionPolicy>("SELECT * FROM execution_policies WHERE id = ?", id);
  execute(
    "INSERT OR REPLACE INTO execution_policies (id, tenant_space_id, business_team_id, team_id, name, system_instruction, tool_policy_json, approval_policy_json, budget_policy_json, output_policy_json, security_policy_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.tenantSpaceId ?? current?.tenantSpaceId ?? null,
    input.businessTeamId ?? current?.businessTeamId ?? null,
    input.teamId ?? current?.teamId ?? null,
    input.name,
    input.systemInstruction ?? current?.systemInstruction ?? "",
    normalizeJson(input.toolPolicyJson ?? current?.toolPolicyJson, { allow: [], deny: [] }),
    normalizeJson(input.approvalPolicyJson ?? current?.approvalPolicyJson, { mode: "ask" }),
    normalizeJson(input.budgetPolicyJson ?? current?.budgetPolicyJson, { maxRuntimeMinutes: 30, maxSteps: 20, maxToolCalls: 50 }),
    normalizeJson(input.outputPolicyJson ?? current?.outputPolicyJson, {}),
    normalizeJson(input.securityPolicyJson ?? current?.securityPolicyJson, {}),
    current?.createdAt ?? nowIso(),
  );
  return queryOne<ExecutionPolicy>("SELECT * FROM execution_policies WHERE id = ?", id);
}

export function upsertServiceCatalogListing(
  input: Partial<ServiceCatalogListing> & Pick<ServiceCatalogListing, "teamId" | "recruitmentMode">,
) {
  const id = input.id || randomUUID();
  const current = queryOne<ServiceCatalogListing>("SELECT * FROM service_catalog_listings WHERE id = ?", id);
  execute(
    "INSERT OR REPLACE INTO service_catalog_listings (id, team_id, resume_json, recruitment_mode, tags_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    id,
    input.teamId,
    normalizeJson(input.resumeJson ?? current?.resumeJson, { successRate: 0, avgLatencyMs: 0, avgCostUsd: 0 }),
    input.recruitmentMode,
    normalizeJson(input.tagsJson ?? current?.tagsJson, []),
    input.status ?? current?.status ?? "active",
    current?.createdAt ?? nowIso(),
  );
  return queryOne<ServiceCatalogListing>("SELECT * FROM service_catalog_listings WHERE id = ?", id);
}

export function upsertAccessGrant(
  input: Partial<AccessGrant> & Pick<AccessGrant, "providerTeamId" | "consumerBusinessTeamId" | "serviceAccountRef">,
) {
  const id = input.id || randomUUID();
  const current = queryOne<AccessGrant>("SELECT * FROM access_grants WHERE id = ?", id);
  execute(
    "INSERT OR REPLACE INTO access_grants (id, provider_team_id, consumer_business_team_id, pricing_model_json, sla_json, access_scope_json, service_account_ref, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.providerTeamId,
    input.consumerBusinessTeamId,
    normalizeJson(input.pricingModelJson ?? current?.pricingModelJson, { baseUsd: 0, tokenMultiplier: 1 }),
    normalizeJson(input.slaJson ?? current?.slaJson, { responseSeconds: 60, successRateFloor: 0.95 }),
    normalizeJson(input.accessScopeJson ?? current?.accessScopeJson, {}),
    input.serviceAccountRef,
    input.status ?? current?.status ?? "active",
    current?.createdAt ?? nowIso(),
  );
  return queryOne<AccessGrant>("SELECT * FROM access_grants WHERE id = ?", id);
}

export function upsertTeamMember(input: Partial<TeamMember> & Pick<TeamMember, "tenantSpaceId" | "businessTeamId" | "name">) {
  const id = input.id || randomUUID();
  const current = queryOne<TeamMember>("SELECT * FROM team_members WHERE id = ?", id);
  const createdAt = current?.createdAt ?? nowIso();
  execute(
    "INSERT OR REPLACE INTO team_members (id, tenant_space_id, business_team_id, employee_no, name, email, role, title, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.tenantSpaceId,
    input.businessTeamId,
    input.employeeNo ?? current?.employeeNo ?? "",
    input.name,
    input.email ?? current?.email ?? "",
    input.role ?? current?.role ?? "member",
    input.title ?? current?.title ?? "",
    input.status ?? current?.status ?? "active",
    input.source ?? current?.source ?? "manual",
    createdAt,
    nowIso(),
  );
  return queryOne<TeamMember>("SELECT * FROM team_members WHERE id = ?", id);
}

export function importTeamMembersFromRows(args: {
  tenantSpaceId: string;
  businessTeamId: string;
  rows: string;
}) {
  const rows = args.rows
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split(/\t|,/).map((cell) => cell.trim()));

  return rows.map((row) =>
    upsertTeamMember({
      tenantSpaceId: args.tenantSpaceId,
      businessTeamId: args.businessTeamId,
      employeeNo: row[0] ?? "",
      name: row[1] ?? row[0] ?? "未命名成员",
      email: row[2] ?? "",
      role: row[3] ?? "member",
      title: row[4] ?? "",
      status: "active",
      source: "excel_import",
    }),
  );
}

export function listTeamPermissionGrants() {
  return queryAll<TeamPermissionGrant>(
    "SELECT * FROM team_permission_grants ORDER BY business_team_id ASC, resource_type ASC, role_key ASC",
  );
}

export function upsertTeamPermissionGrant(
  input: Partial<TeamPermissionGrant> & Pick<TeamPermissionGrant, "businessTeamId" | "roleKey" | "resourceType" | "resourceScope">,
) {
  const id = input.id || randomUUID();
  const current = queryOne<TeamPermissionGrant>("SELECT * FROM team_permission_grants WHERE id = ?", id);
  const createdAt = current?.createdAt ?? nowIso();
  execute(
    "INSERT OR REPLACE INTO team_permission_grants (id, business_team_id, member_id, principal_type, role_key, resource_type, resource_scope, actions_json, effect, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.businessTeamId,
    input.memberId ?? current?.memberId ?? null,
    input.principalType ?? current?.principalType ?? "team_role",
    input.roleKey,
    input.resourceType,
    input.resourceScope,
    normalizeJson(input.actionsJson ?? current?.actionsJson, []),
    input.effect ?? current?.effect ?? "allow",
    input.status ?? current?.status ?? "active",
    createdAt,
    nowIso(),
  );
  return queryOne<TeamPermissionGrant>("SELECT * FROM team_permission_grants WHERE id = ?", id);
}

export function listTeamAssetGrants() {
  return queryAll<TeamAssetGrant>(
    "SELECT * FROM team_asset_grants ORDER BY business_team_id ASC, asset_type ASC, asset_name ASC",
  );
}

export function upsertTeamAssetGrant(
  input: Partial<TeamAssetGrant> & Pick<TeamAssetGrant, "businessTeamId" | "assetType" | "assetId" | "assetName">,
) {
  const id = input.id || randomUUID();
  const current = queryOne<TeamAssetGrant>("SELECT * FROM team_asset_grants WHERE id = ?", id);
  const createdAt = current?.createdAt ?? nowIso();
  execute(
    "INSERT OR REPLACE INTO team_asset_grants (id, business_team_id, member_id, asset_type, asset_id, asset_name, permission_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.businessTeamId,
    input.memberId ?? current?.memberId ?? null,
    input.assetType,
    input.assetId,
    input.assetName,
    normalizeJson(input.permissionJson ?? current?.permissionJson, {}),
    input.status ?? current?.status ?? "active",
    createdAt,
    nowIso(),
  );
  return queryOne<TeamAssetGrant>("SELECT * FROM team_asset_grants WHERE id = ?", id);
}

export function listMcpServers() {
  return queryAll<McpServerProfile>("SELECT * FROM mcp_servers WHERE status <> 'deleted' ORDER BY status ASC, name ASC");
}

export function upsertMcpServer(input: Partial<McpServerProfile> & Pick<McpServerProfile, "name" | "transport">) {
  const id = input.id || randomUUID();
  const current = queryOne<McpServerProfile>("SELECT * FROM mcp_servers WHERE id = ?", id);
  const createdAt = current?.createdAt ?? nowIso();
  execute(
    "INSERT OR REPLACE INTO mcp_servers (id, business_team_id, name, transport, command, url, auth_ref, tool_allowlist_json, status, last_health_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.businessTeamId ?? current?.businessTeamId ?? null,
    input.name,
    input.transport,
    input.command ?? current?.command ?? "",
    input.url ?? current?.url ?? "",
    input.authRef ?? current?.authRef ?? "",
    normalizeJson(input.toolAllowlistJson ?? current?.toolAllowlistJson, []),
    input.status ?? current?.status ?? "active",
    input.lastHealthStatus ?? current?.lastHealthStatus ?? "unknown",
    createdAt,
    nowIso(),
  );
  return queryOne<McpServerProfile>("SELECT * FROM mcp_servers WHERE id = ?", id);
}

export function listConnectors() {
  return queryAll<ConnectorProfile>(
    "SELECT * FROM connector_profiles WHERE status <> 'deleted' ORDER BY connector_type ASC, name ASC",
  );
}

export function upsertConnector(input: Partial<ConnectorProfile> & Pick<ConnectorProfile, "name" | "connectorType" | "provider">) {
  const id = input.id || randomUUID();
  const current = queryOne<ConnectorProfile>("SELECT * FROM connector_profiles WHERE id = ?", id);
  const createdAt = current?.createdAt ?? nowIso();
  execute(
    "INSERT OR REPLACE INTO connector_profiles (id, business_team_id, name, connector_type, provider, endpoint, secret_ref, capabilities_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.businessTeamId ?? current?.businessTeamId ?? null,
    input.name,
    input.connectorType,
    input.provider,
    input.endpoint ?? current?.endpoint ?? "",
    input.secretRef ?? current?.secretRef ?? "",
    normalizeJson(input.capabilitiesJson ?? current?.capabilitiesJson, []),
    input.status ?? current?.status ?? "active",
    createdAt,
    nowIso(),
  );
  return queryOne<ConnectorProfile>("SELECT * FROM connector_profiles WHERE id = ?", id);
}

export function listCodebases() {
  return queryAll<CodebaseProfile>(
    "SELECT * FROM codebase_profiles WHERE status <> 'deleted' ORDER BY business_team_id ASC, name ASC",
  );
}

export function listCodebaseOperatorTokens(codebaseId?: string) {
  return codebaseId
    ? queryAll<CodebaseOperatorToken>(
        "SELECT * FROM codebase_operator_tokens WHERE codebase_id = ? AND status <> 'deleted' ORDER BY operator_name ASC",
        codebaseId,
      )
    : queryAll<CodebaseOperatorToken>(
        "SELECT * FROM codebase_operator_tokens WHERE status <> 'deleted' ORDER BY codebase_id ASC, operator_name ASC",
      );
}

export function upsertCodebase(input: Partial<CodebaseProfile> & Pick<CodebaseProfile, "businessTeamId" | "name" | "repositoryUrl">) {
  const id = input.id || randomUUID();
  const current = queryOne<CodebaseProfile>("SELECT * FROM codebase_profiles WHERE id = ?", id);
  const createdAt = current?.createdAt ?? nowIso();
  execute(
    "INSERT OR REPLACE INTO codebase_profiles (id, business_team_id, name, provider, repository_url, default_branch, visibility, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.businessTeamId,
    input.name,
    input.provider ?? current?.provider ?? "git",
    input.repositoryUrl,
    input.defaultBranch ?? current?.defaultBranch ?? "main",
    input.visibility ?? current?.visibility ?? "team",
    input.description ?? current?.description ?? "",
    input.status ?? current?.status ?? "active",
    createdAt,
    nowIso(),
  );
  return queryOne<CodebaseProfile>("SELECT * FROM codebase_profiles WHERE id = ?", id);
}

export function upsertCodebaseOperatorToken(
  input: Partial<CodebaseOperatorToken> & Pick<CodebaseOperatorToken, "codebaseId" | "operatorName" | "tokenRef" | "role">,
) {
  const id = input.id || randomUUID();
  const current = queryOne<CodebaseOperatorToken>("SELECT * FROM codebase_operator_tokens WHERE id = ?", id);
  const createdAt = current?.createdAt ?? nowIso();
  execute(
    "INSERT OR REPLACE INTO codebase_operator_tokens (id, codebase_id, operator_name, token_ref, role, permission_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.codebaseId,
    input.operatorName,
    input.tokenRef,
    input.role,
    normalizeJson(input.permissionJson ?? current?.permissionJson, []),
    input.status ?? current?.status ?? "active",
    createdAt,
    nowIso(),
  );
  return queryOne<CodebaseOperatorToken>("SELECT * FROM codebase_operator_tokens WHERE id = ?", id);
}

export function deleteManagedResource(input: { type: string; id: string }) {
  switch (input.type) {
    case "tenant-space":
      execute("UPDATE tenant_spaces SET status = 'deleted' WHERE id = ?", input.id);
      break;
    case "business-team":
      execute("UPDATE business_teams SET status = 'deleted' WHERE id = ?", input.id);
      break;
    case "team-member":
      execute("DELETE FROM team_members WHERE id = ?", input.id);
      break;
    case "team-permission":
      execute("DELETE FROM team_permission_grants WHERE id = ?", input.id);
      break;
    case "team-asset":
      execute("DELETE FROM team_asset_grants WHERE id = ?", input.id);
      break;
    case "mcp-server":
      execute("UPDATE mcp_servers SET status = 'deleted', updated_at = ? WHERE id = ?", nowIso(), input.id);
      break;
    case "connector":
      execute("UPDATE connector_profiles SET status = 'deleted', updated_at = ? WHERE id = ?", nowIso(), input.id);
      break;
    case "codebase":
      execute("UPDATE codebase_profiles SET status = 'deleted', updated_at = ? WHERE id = ?", nowIso(), input.id);
      break;
    case "codebase-token":
      execute("UPDATE codebase_operator_tokens SET status = 'deleted', updated_at = ? WHERE id = ?", nowIso(), input.id);
      break;
    case "skill":
      execute("DELETE FROM code_review_skills WHERE id = ?", input.id);
      break;
    case "provider-profile":
      execute("DELETE FROM provider_profiles WHERE id = ?", input.id);
      break;
    case "execution-policy":
      execute("DELETE FROM execution_policies WHERE id = ?", input.id);
      break;
    case "service-catalog":
      execute("UPDATE service_catalog_listings SET status = 'deleted' WHERE id = ?", input.id);
      break;
    case "access-grant":
      execute("UPDATE access_grants SET status = 'deleted' WHERE id = ?", input.id);
      break;
    case "agent-definition":
      execute("UPDATE agent_definitions SET status = 'deleted', updated_at = ? WHERE id = ?", nowIso(), input.id);
      break;
    case "agent-team":
      execute("DELETE FROM agent_team_members WHERE team_id = ?", input.id);
      execute("DELETE FROM agent_team_shares WHERE agent_team_id = ?", input.id);
      execute("DELETE FROM agent_teams WHERE id = ?", input.id);
      break;
    case "task-blueprint":
      execute("UPDATE task_blueprints SET status = 'deleted', updated_at = ? WHERE id = ?", nowIso(), input.id);
      break;
    default:
      throw new Error(`不支持删除的资源类型: ${input.type}`);
  }
  return { ok: true };
}
