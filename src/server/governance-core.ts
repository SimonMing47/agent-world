import { randomUUID } from "node:crypto";
import {
  execute,
  queryAll,
  queryOne,
  type CodebaseOperatorToken,
  type CodebaseProfile,
  type ConnectorProfile,
  type McpServerProfile,
  type TeamAssetGrant,
  type TeamMember,
  type TeamPermissionGrant,
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
  return queryAll<TeamMember>("SELECT * FROM team_members ORDER BY business_team_id ASC, name ASC");
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
  return queryAll<McpServerProfile>("SELECT * FROM mcp_servers ORDER BY status ASC, name ASC");
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
  return queryAll<ConnectorProfile>("SELECT * FROM connector_profiles ORDER BY connector_type ASC, name ASC");
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
  return queryAll<CodebaseProfile>("SELECT * FROM codebase_profiles ORDER BY business_team_id ASC, name ASC");
}

export function listCodebaseOperatorTokens(codebaseId?: string) {
  return codebaseId
    ? queryAll<CodebaseOperatorToken>(
        "SELECT * FROM codebase_operator_tokens WHERE codebase_id = ? ORDER BY operator_name ASC",
        codebaseId,
      )
    : queryAll<CodebaseOperatorToken>(
        "SELECT * FROM codebase_operator_tokens ORDER BY codebase_id ASC, operator_name ASC",
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

