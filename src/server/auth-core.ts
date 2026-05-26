import { addDays } from "date-fns";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { getAuthAdapter, listAuthAdapterCatalog, type NormalizedEnterpriseIdentity } from "@/server/auth-adapter-core";
import {
  execute,
  queryAll,
  queryOne,
  type AccessRequest,
  type AccessWhitelistRule,
  type AuthProviderConfig,
  type AuthSession,
  type BusinessTeam,
  type IdentityUser,
  type IdentityUserBusinessTeamMembership,
  type SystemSetting,
} from "@/server/db";
import { listBusinessTeams } from "@/server/queries";

export { listAuthAdapterCatalog } from "@/server/auth-adapter-core";

const AUTH_SESSION_COOKIE = "agentworld_session";
const IDENTITY_ACCESS_SETTINGS_KEY = "identity_access_settings";
const DEVELOPMENT_ACCESS_SETTINGS_KEY = "development_access_settings";

function nowIso() {
  return new Date().toISOString();
}

function normalizeJson(value: unknown, fallback: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return JSON.stringify(fallback, null, 2);
    }
  }
  return JSON.stringify(value ?? fallback, null, 2);
}

function parseJsonRecord(value: string | null | undefined) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value: string | null | undefined) {
  if (!value) return [] as unknown[];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export type IdentityAccessSettings = {
  adminContactEmail: string;
  requestMessage: string;
};

export type DevelopmentAccessSettings = {
  enabled: boolean;
  autoEnter: boolean;
  name: string;
  email: string;
  title: string;
};

export type AuthContext = {
  session: AuthSession;
  user: IdentityUser;
  memberships: IdentityUserBusinessTeamMembership[];
  accessibleBusinessTeamIds: string[];
  accessibleBusinessTeams: BusinessTeam[];
  primaryBusinessTeam: BusinessTeam | null;
  whitelistRules: AccessWhitelistRule[];
  access: {
    allowed: boolean;
    reason: "system_admin" | "whitelist_match" | "not_signed_in" | "not_whitelisted" | "whitelist_missing";
  };
  settings: IdentityAccessSettings;
};

export function listAuthProviderConfigs() {
  return queryAll<AuthProviderConfig>(
    "SELECT * FROM auth_provider_configs WHERE status <> 'deleted' ORDER BY updated_at DESC, name ASC",
  );
}

export function upsertAuthProviderConfig(
  input: Partial<AuthProviderConfig> &
    Pick<AuthProviderConfig, "name" | "adapterKey" | "status">,
) {
  const id = input.id || randomUUID();
  const current = queryOne<AuthProviderConfig>("SELECT * FROM auth_provider_configs WHERE id = ?", id);
  const createdAt = current?.createdAt ?? nowIso();
  execute(
    "INSERT OR REPLACE INTO auth_provider_configs (id, tenant_space_id, name, adapter_key, status, issuer_url, authorize_url, token_url, userinfo_url, jwks_url, client_id, client_secret_ref, scopes_json, mapping_json, config_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.tenantSpaceId ?? current?.tenantSpaceId ?? null,
    input.name,
    input.adapterKey,
    input.status,
    input.issuerUrl ?? current?.issuerUrl ?? "",
    input.authorizeUrl ?? current?.authorizeUrl ?? "",
    input.tokenUrl ?? current?.tokenUrl ?? "",
    input.userinfoUrl ?? current?.userinfoUrl ?? "",
    input.jwksUrl ?? current?.jwksUrl ?? "",
    input.clientId ?? current?.clientId ?? "",
    input.clientSecretRef ?? current?.clientSecretRef ?? "",
    normalizeJson(input.scopesJson ?? current?.scopesJson, ["openid", "profile", "email"]),
    normalizeJson(
      input.mappingJson ?? current?.mappingJson,
      {
        idClaim: "sub",
        nameClaim: "name",
        emailClaim: "email",
        avatarClaim: "picture",
        titleClaim: "title",
        employeeNoClaim: "employee_no",
        adminClaim: "is_admin",
        teamClaims: [],
      },
    ),
    normalizeJson(input.configJson ?? current?.configJson, {}),
    createdAt,
    nowIso(),
  );
  return queryOne<AuthProviderConfig>("SELECT * FROM auth_provider_configs WHERE id = ?", id);
}

export function deleteAuthProviderConfig(id: string) {
  execute("UPDATE auth_provider_configs SET status = 'deleted', updated_at = ? WHERE id = ?", nowIso(), id);
  return { ok: true };
}

export function listIdentityUsers() {
  return queryAll<IdentityUser>(
    "SELECT * FROM identity_users WHERE status <> 'deleted' ORDER BY last_login_at DESC, name ASC",
  );
}

export function listIdentityUserMemberships(userId?: string) {
  return userId
    ? queryAll<IdentityUserBusinessTeamMembership>(
        "SELECT * FROM identity_user_business_team_memberships WHERE user_id = ? ORDER BY is_primary DESC, updated_at DESC",
        userId,
      )
    : queryAll<IdentityUserBusinessTeamMembership>(
        "SELECT * FROM identity_user_business_team_memberships ORDER BY updated_at DESC",
      );
}

export function listAccessWhitelistRules() {
  return queryAll<AccessWhitelistRule>(
    "SELECT * FROM access_whitelist_rules WHERE status <> 'deleted' ORDER BY updated_at DESC, created_at DESC",
  );
}

export function upsertAccessWhitelistRule(
  input: Partial<AccessWhitelistRule> & Pick<AccessWhitelistRule, "businessTeamId">,
) {
  const id = input.id || randomUUID();
  const current = queryOne<AccessWhitelistRule>("SELECT * FROM access_whitelist_rules WHERE id = ?", id);
  const createdAt = current?.createdAt ?? nowIso();
  execute(
    "INSERT OR REPLACE INTO access_whitelist_rules (id, tenant_space_id, business_team_id, allow_descendants, note, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.tenantSpaceId ?? current?.tenantSpaceId ?? null,
    input.businessTeamId,
    input.allowDescendants ?? current?.allowDescendants ?? 1,
    input.note ?? current?.note ?? "",
    input.status ?? current?.status ?? "active",
    createdAt,
    nowIso(),
  );
  return queryOne<AccessWhitelistRule>("SELECT * FROM access_whitelist_rules WHERE id = ?", id);
}

export function deleteAccessWhitelistRule(id: string) {
  execute("UPDATE access_whitelist_rules SET status = 'deleted', updated_at = ? WHERE id = ?", nowIso(), id);
  return { ok: true };
}

export function listAccessRequests() {
  return queryAll<AccessRequest>(
    "SELECT * FROM access_requests ORDER BY updated_at DESC, created_at DESC",
  );
}

export function upsertAccessRequest(input: Partial<AccessRequest> & Pick<AccessRequest, "email" | "name">) {
  const id = input.id || randomUUID();
  const current = queryOne<AccessRequest>("SELECT * FROM access_requests WHERE id = ?", id);
  const createdAt = current?.createdAt ?? nowIso();
  execute(
    "INSERT OR REPLACE INTO access_requests (id, auth_provider_config_id, email, name, requested_business_team_hint, request_note, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.authProviderConfigId ?? current?.authProviderConfigId ?? null,
    input.email,
    input.name,
    input.requestedBusinessTeamHint ?? current?.requestedBusinessTeamHint ?? "",
    input.requestNote ?? current?.requestNote ?? "",
    input.status ?? current?.status ?? "open",
    createdAt,
    nowIso(),
  );
  return queryOne<AccessRequest>("SELECT * FROM access_requests WHERE id = ?", id);
}

export function getIdentityAccessSettings(): IdentityAccessSettings {
  const current = queryOne<SystemSetting>("SELECT * FROM system_settings WHERE key = ?", IDENTITY_ACCESS_SETTINGS_KEY);
  const parsed = parseJsonRecord(current?.valueJson);
  return {
    adminContactEmail: typeof parsed.adminContactEmail === "string" ? parsed.adminContactEmail : "",
    requestMessage:
      typeof parsed.requestMessage === "string"
        ? parsed.requestMessage
        : "identityAccess.settings.defaultRequestMessage",
  };
}

export function upsertIdentityAccessSettings(input: Partial<IdentityAccessSettings>, updatedBy = "system") {
  const current = getIdentityAccessSettings();
  execute(
    "INSERT OR REPLACE INTO system_settings (key, value_json, updated_by, updated_at) VALUES (?, ?, ?, ?)",
    IDENTITY_ACCESS_SETTINGS_KEY,
    normalizeJson(
      {
        adminContactEmail: input.adminContactEmail ?? current.adminContactEmail,
        requestMessage: input.requestMessage ?? current.requestMessage,
      },
      {},
    ),
    updatedBy,
    nowIso(),
  );
  return getIdentityAccessSettings();
}

export function getDevelopmentAccessSettings(): DevelopmentAccessSettings {
  const current = queryOne<SystemSetting>("SELECT * FROM system_settings WHERE key = ?", DEVELOPMENT_ACCESS_SETTINGS_KEY);
  const parsed = parseJsonRecord(current?.valueJson);
  return {
    enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : process.env.NODE_ENV === "development",
    autoEnter: typeof parsed.autoEnter === "boolean" ? parsed.autoEnter : false,
    name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : "Development Administrator",
    email:
      typeof parsed.email === "string" && parsed.email.trim()
        ? parsed.email.trim().toLowerCase()
        : "dev-admin@agentworld.local",
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : "System Administrator",
  };
}

export function upsertDevelopmentAccessSettings(
  input: Partial<DevelopmentAccessSettings>,
  updatedBy = "system",
) {
  const current = getDevelopmentAccessSettings();
  execute(
    "INSERT OR REPLACE INTO system_settings (key, value_json, updated_by, updated_at) VALUES (?, ?, ?, ?)",
    DEVELOPMENT_ACCESS_SETTINGS_KEY,
    normalizeJson(
      {
        enabled: input.enabled ?? current.enabled,
        autoEnter: input.autoEnter ?? current.autoEnter,
        name: input.name ?? current.name,
        email: input.email ?? current.email,
        title: input.title ?? current.title,
      },
      {},
    ),
    updatedBy,
    nowIso(),
  );
  return getDevelopmentAccessSettings();
}

function teamIsWithinRuleScope(args: {
  candidateTeamId: string;
  rule: AccessWhitelistRule;
  teamsById: Map<string, BusinessTeam>;
}) {
  if (args.candidateTeamId === args.rule.businessTeamId) return true;
  if (!args.rule.allowDescendants) return false;
  let current = args.teamsById.get(args.candidateTeamId) ?? null;
  while (current?.parentBusinessTeamId) {
    if (current.parentBusinessTeamId === args.rule.businessTeamId) return true;
    current = args.teamsById.get(current.parentBusinessTeamId) ?? null;
  }
  return false;
}

function evaluateWhitelistAccess(args: {
  user: IdentityUser;
  memberships: IdentityUserBusinessTeamMembership[];
  whitelistRules: AccessWhitelistRule[];
  teams: BusinessTeam[];
}) {
  if (args.user.isSystemAdmin === 1) {
    return { allowed: true, reason: "system_admin" as const, accessibleBusinessTeamIds: args.teams.map((team) => team.id) };
  }
  if (args.whitelistRules.length === 0) {
    return { allowed: false, reason: "whitelist_missing" as const, accessibleBusinessTeamIds: [] as string[] };
  }
  const teamsById = new Map(args.teams.map((team) => [team.id, team]));
  const accessibleBusinessTeamIds = args.memberships
    .map((membership) => membership.businessTeamId)
    .filter((teamId) =>
      args.whitelistRules.some((rule) =>
        teamIsWithinRuleScope({
          candidateTeamId: teamId,
          rule,
          teamsById,
        }),
      ),
    );
  if (accessibleBusinessTeamIds.length > 0) {
    return { allowed: true, reason: "whitelist_match" as const, accessibleBusinessTeamIds };
  }
  return { allowed: false, reason: "not_whitelisted" as const, accessibleBusinessTeamIds: [] as string[] };
}

function resolveExistingIdentity(args: { email: string; externalUserId?: string | null; authProviderConfigId?: string | null }) {
  if (args.authProviderConfigId && args.externalUserId) {
    const direct = queryOne<IdentityUser>(
      "SELECT * FROM identity_users WHERE auth_provider_config_id = ? AND external_user_id = ? LIMIT 1",
      args.authProviderConfigId,
      args.externalUserId,
    );
    if (direct) return direct;
  }
  return queryOne<IdentityUser>("SELECT * FROM identity_users WHERE email = ? LIMIT 1", args.email);
}

export function signInWithDevelopmentIdentity(input: {
  providerConfigId?: string | null;
  email: string;
  name: string;
  employeeNo?: string;
  title?: string;
  avatarUrl?: string;
  isSystemAdmin?: boolean;
  businessTeamIds?: string[];
  primaryBusinessTeamId?: string | null;
  requestedBy?: string;
}) {
  const allowSystemAdmin = input.requestedBy === "development_access";
  const adapter = getAuthAdapter("development_stub");
  const normalizedIdentity: NormalizedEnterpriseIdentity = adapter?.normalizeDevelopmentPayload
    ? adapter.normalizeDevelopmentPayload(input)
    : {
        externalUserId: input.email.trim().toLowerCase(),
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        employeeNo: input.employeeNo?.trim(),
        title: input.title?.trim(),
        avatarUrl: input.avatarUrl?.trim(),
        isSystemAdmin: allowSystemAdmin && Boolean(input.isSystemAdmin),
        primaryBusinessTeamId: input.primaryBusinessTeamId ?? null,
        businessTeamIds: input.businessTeamIds ?? [],
      };
  const normalizedEmail = normalizedIdentity.email;
  const isSystemAdmin = allowSystemAdmin && Boolean(normalizedIdentity.isSystemAdmin);
  const businessTeams = listBusinessTeams();
  const availableTeamIds = new Set(businessTeams.map((team) => team.id));
  const currentMemberships = Array.from(
    new Set(
      (normalizedIdentity.businessTeamIds ?? [])
        .map((teamId) => teamId.trim())
        .filter((teamId) => availableTeamIds.has(teamId)),
    ),
  );
  const primaryBusinessTeamId =
    normalizedIdentity.primaryBusinessTeamId && availableTeamIds.has(normalizedIdentity.primaryBusinessTeamId)
      ? normalizedIdentity.primaryBusinessTeamId
      : currentMemberships[0] ?? null;
  const primaryBusinessTeam = primaryBusinessTeamId
    ? businessTeams.find((team) => team.id === primaryBusinessTeamId) ?? null
    : null;
  const existing = resolveExistingIdentity({
    email: normalizedEmail,
    externalUserId: normalizedEmail,
    authProviderConfigId: input.providerConfigId ?? null,
  });
  const userId = existing?.id ?? randomUUID();
  const createdAt = existing?.createdAt ?? nowIso();
  execute(
    "INSERT OR REPLACE INTO identity_users (id, tenant_space_id, auth_provider_config_id, external_user_id, employee_no, email, name, avatar_url, title, status, is_system_admin, primary_business_team_id, profile_json, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    userId,
    primaryBusinessTeam?.tenantSpaceId ?? existing?.tenantSpaceId ?? null,
    input.providerConfigId ?? existing?.authProviderConfigId ?? null,
    normalizedIdentity.externalUserId,
    normalizedIdentity.employeeNo ?? existing?.employeeNo ?? "",
    normalizedEmail,
    normalizedIdentity.name,
    normalizedIdentity.avatarUrl ?? existing?.avatarUrl ?? "",
    normalizedIdentity.title ?? existing?.title ?? "",
    "active",
    isSystemAdmin ? 1 : 0,
    primaryBusinessTeamId,
    normalizeJson(
      {
        source: input.providerConfigId ? "configured_development_provider" : "builtin_development_provider",
        requestedBy: input.requestedBy ?? "signin",
        attributes: normalizedIdentity.attributes ?? {},
      },
      {},
    ),
    createdAt,
    nowIso(),
    nowIso(),
  );

  execute("DELETE FROM identity_user_business_team_memberships WHERE user_id = ?", userId);
  for (const teamId of currentMemberships) {
    execute(
      "INSERT INTO identity_user_business_team_memberships (id, user_id, business_team_id, membership_source, source_ref, role_title, is_primary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      randomUUID(),
      userId,
      teamId,
      "development_stub",
      input.providerConfigId ?? "builtin",
      normalizedIdentity.title ?? "",
      teamId === primaryBusinessTeamId ? 1 : 0,
      nowIso(),
      nowIso(),
    );
  }

  const sessionId = randomUUID();
  const sessionToken = randomUUID();
  execute(
    "INSERT INTO auth_sessions (id, user_id, auth_provider_config_id, session_token, status, expires_at, created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    sessionId,
    userId,
    input.providerConfigId ?? null,
    sessionToken,
    "active",
    addDays(new Date(), 7).toISOString(),
    nowIso(),
    nowIso(),
    nowIso(),
  );

  const context = getAuthContextBySessionToken(sessionToken);
  if (!context) {
    throw new Error("Failed to establish session");
  }

  return {
    sessionToken,
    context,
  };
}

export function signInWithDevelopmentAccess() {
  const settings = getDevelopmentAccessSettings();
  if (!settings.enabled) {
    throw new Error("developmentAccess.errors.disabled");
  }
  return signInWithDevelopmentIdentity({
    email: settings.email,
    name: settings.name,
    title: settings.title,
    employeeNo: "DEV-ADMIN",
    isSystemAdmin: true,
    businessTeamIds: [],
    primaryBusinessTeamId: null,
    requestedBy: "development_access",
  });
}

export function revokeAuthSession(sessionToken: string) {
  execute(
    "UPDATE auth_sessions SET status = 'revoked', updated_at = ?, last_seen_at = ? WHERE session_token = ?",
    nowIso(),
    nowIso(),
    sessionToken,
  );
  return { ok: true };
}

export function getAuthContextBySessionToken(sessionToken: string | null | undefined): AuthContext | null {
  if (!sessionToken) return null;
  const session = queryOne<AuthSession>(
    "SELECT * FROM auth_sessions WHERE session_token = ? AND status = 'active' LIMIT 1",
    sessionToken,
  );
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    revokeAuthSession(sessionToken);
    return null;
  }
  execute(
    "UPDATE auth_sessions SET updated_at = ?, last_seen_at = ? WHERE id = ?",
    nowIso(),
    nowIso(),
    session.id,
  );
  const user = queryOne<IdentityUser>("SELECT * FROM identity_users WHERE id = ? LIMIT 1", session.userId);
  if (!user || user.status === "deleted") return null;
  const memberships = listIdentityUserMemberships(user.id);
  const whitelistRules = listAccessWhitelistRules().filter((rule) => rule.status === "active");
  const teams = listBusinessTeams().filter((team) => team.status !== "deleted");
  const access = evaluateWhitelistAccess({
    user,
    memberships,
    whitelistRules,
    teams,
  });
  return {
    session,
    user,
    memberships,
    accessibleBusinessTeamIds: access.accessibleBusinessTeamIds,
    accessibleBusinessTeams: teams.filter((team) => access.accessibleBusinessTeamIds.includes(team.id)),
    primaryBusinessTeam: user.primaryBusinessTeamId
      ? teams.find((team) => team.id === user.primaryBusinessTeamId) ?? null
      : null,
    whitelistRules,
    access: { allowed: access.allowed, reason: access.reason },
    settings: getIdentityAccessSettings(),
  };
}

export const getRequestAuthContext = cache(async function getRequestAuthContext() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  return getAuthContextBySessionToken(sessionToken);
});

export function canAccessBusinessTeam(
  authContext: AuthContext | null,
  businessTeamId: string | null | undefined,
  options: { allowGlobal?: boolean } = {},
) {
  if (!authContext?.access.allowed) return false;
  if (authContext.user.isSystemAdmin === 1) return true;
  if (!businessTeamId) return Boolean(options.allowGlobal);
  return authContext.accessibleBusinessTeamIds.includes(businessTeamId);
}

export function filterBusinessTeamsForAuthContext<T extends { id: string }>(
  teams: T[],
  authContext: AuthContext | null,
) {
  if (!authContext?.access.allowed) return [];
  if (authContext.user.isSystemAdmin === 1) return teams;
  const visibleTeamIds = new Set(authContext.accessibleBusinessTeamIds);
  return teams.filter((team) => visibleTeamIds.has(team.id));
}

export function filterByBusinessTeamAccess<T>(
  items: T[],
  authContext: AuthContext | null,
  resolveBusinessTeamId: (item: T) => string | null | undefined,
  options: { allowGlobal?: boolean } = {},
) {
  return items.filter((item) =>
    canAccessBusinessTeam(authContext, resolveBusinessTeamId(item), options),
  );
}

export function requireBusinessTeamAccess(
  authContext: AuthContext | null,
  businessTeamId: string | null | undefined,
  options: { allowGlobal?: boolean; message?: string } = {},
) {
  if (!authContext) {
    throw new Error("Authentication required");
  }
  if (!canAccessBusinessTeam(authContext, businessTeamId, options)) {
    throw new Error(options.message ?? "Business team access denied");
  }
}

export function buildAuthSessionCookieValue(sessionToken: string) {
  return {
    name: AUTH_SESSION_COOKIE,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: addDays(new Date(), 7),
  };
}

export function clearAuthSessionCookie() {
  return {
    name: AUTH_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
  };
}

export function describeProviderConfig(config: AuthProviderConfig) {
  const adapter = listAuthAdapterCatalog().find((item) => item.key === config.adapterKey);
  return {
    ...config,
    adapterName: adapter?.name ?? config.adapterKey,
    scopes: parseJsonArray(config.scopesJson).map(String),
    mappings: parseJsonRecord(config.mappingJson),
    extraConfig: parseJsonRecord(config.configJson),
  };
}
