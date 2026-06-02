import { addDays } from "date-fns";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { listAuthAdapterCatalog } from "@/server/auth-adapter-core";
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
  type LocalAuthCredential,
  type SystemSetting,
} from "@/server/db";
import { listBusinessTeams } from "@/server/queries";

export { listAuthAdapterCatalog } from "@/server/auth-adapter-core";

const AUTH_SESSION_COOKIE = "agentworld_session";
const IDENTITY_ACCESS_SETTINGS_KEY = "identity_access_settings";
const DEFAULT_BOOTSTRAP_USERNAME = "admin";
const DEFAULT_BOOTSTRAP_PASSWORD = "admin";
const LEGACY_BOOTSTRAP_PASSWORDS = ["AgentWorld@123"];

function nowIso() {
  return new Date().toISOString();
}

function requestUsesHttps(request: Pick<Request, "headers" | "url"> | undefined) {
  const override = process.env.AGENTWORLD_AUTH_COOKIE_SECURE;
  if (override === "1" || override?.toLowerCase() === "true") return true;
  if (override === "0" || override?.toLowerCase() === "false") return false;

  const forwardedProto = request?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwardedProto) return forwardedProto === "https";

  const forwarded = request?.headers.get("forwarded") ?? "";
  const forwardedProtocol = forwarded.match(/(?:^|[;,\s])proto=(https?)/i)?.[1]?.toLowerCase();
  if (forwardedProtocol) return forwardedProtocol === "https";

  if (request?.url) {
    try {
      return new URL(request.url).protocol === "https:";
    } catch {
      // Fall through to deployment-level defaults.
    }
  }

  const publicBaseUrl = process.env.AGENTWORLD_PUBLIC_BASE_URL;
  if (publicBaseUrl) {
    try {
      return new URL(publicBaseUrl).protocol === "https:";
    } catch {
      // Fall through to production default.
    }
  }

  return process.env.NODE_ENV === "production";
}
function getCookieValueFromHeader(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.split("=");
    if (rawKey?.trim() !== name) continue;
    const value = rawValue.join("=").trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
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

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const nextHash = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");
  return stored.length === nextHash.length && timingSafeEqual(stored, nextHash);
}

function bootstrapLocalAdminDefaults() {
  return {
    username: normalizeUsername(process.env.AGENTWORLD_BOOTSTRAP_USERNAME || DEFAULT_BOOTSTRAP_USERNAME),
    password: process.env.AGENTWORLD_BOOTSTRAP_PASSWORD || DEFAULT_BOOTSTRAP_PASSWORD,
    email: (process.env.AGENTWORLD_BOOTSTRAP_EMAIL || "admin@agentworld.local").trim().toLowerCase(),
    name: process.env.AGENTWORLD_BOOTSTRAP_NAME || "AgentWorld Administrator",
    title: process.env.AGENTWORLD_BOOTSTRAP_TITLE || "System Administrator",
  };
}

function shouldRequireDefaultAdminPasswordChange(credential: LocalAuthCredential | null | undefined) {
  return credential?.username === DEFAULT_BOOTSTRAP_USERNAME && credential.forcePasswordChange === 1;
}

function shouldCreateDefaultAdminPasswordChange(defaults: ReturnType<typeof bootstrapLocalAdminDefaults>) {
  return defaults.username === DEFAULT_BOOTSTRAP_USERNAME && defaults.password === DEFAULT_BOOTSTRAP_PASSWORD;
}

function migrateLegacyBootstrapPasswordIfNeeded(credential: LocalAuthCredential) {
  const defaults = bootstrapLocalAdminDefaults();
  if (!shouldCreateDefaultAdminPasswordChange(defaults)) return credential;
  if (!shouldRequireDefaultAdminPasswordChange(credential)) return credential;
  if (verifyPassword(DEFAULT_BOOTSTRAP_PASSWORD, credential.passwordHash)) return credential;
  if (!LEGACY_BOOTSTRAP_PASSWORDS.some((password) => verifyPassword(password, credential.passwordHash))) {
    return credential;
  }

  execute(
    "UPDATE local_auth_credentials SET password_hash = ?, updated_at = ? WHERE id = ?",
    hashPassword(DEFAULT_BOOTSTRAP_PASSWORD),
    nowIso(),
    credential.id,
  );
  const user = queryOne<IdentityUser>("SELECT * FROM identity_users WHERE id = ? LIMIT 1", credential.userId);
  execute(
    "UPDATE identity_users SET profile_json = ?, updated_at = ? WHERE id = ?",
    normalizeJson({ ...parseJsonRecord(user?.profileJson), passwordChangeRequired: true }, {}),
    nowIso(),
    credential.userId,
  );

  return queryOne<LocalAuthCredential>("SELECT * FROM local_auth_credentials WHERE id = ?", credential.id) ?? credential;
}

export type IdentityAccessSettings = {
  adminContactEmail: string;
  requestMessage: string;
  passwordLoginEnabled: boolean;
  registrationEnabled: boolean;
  ssoLoginEnabled: boolean;
  ssoPluginId: string;
  ssoButtonLabel: string;
  ssoButtonLogoUrl: string;
  ssoButtonHref: string;
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
  mustChangePassword: boolean;
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
    passwordLoginEnabled: typeof parsed.passwordLoginEnabled === "boolean" ? parsed.passwordLoginEnabled : true,
    registrationEnabled: typeof parsed.registrationEnabled === "boolean" ? parsed.registrationEnabled : true,
    ssoLoginEnabled: typeof parsed.ssoLoginEnabled === "boolean" ? parsed.ssoLoginEnabled : false,
    ssoPluginId: typeof parsed.ssoPluginId === "string" ? parsed.ssoPluginId : "",
    ssoButtonLabel:
      typeof parsed.ssoButtonLabel === "string" && parsed.ssoButtonLabel.trim()
        ? parsed.ssoButtonLabel
        : "identityAccess.signIn.sso.defaultLabel",
    ssoButtonLogoUrl: typeof parsed.ssoButtonLogoUrl === "string" ? parsed.ssoButtonLogoUrl : "",
    ssoButtonHref: typeof parsed.ssoButtonHref === "string" ? parsed.ssoButtonHref : "",
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
        passwordLoginEnabled: input.passwordLoginEnabled ?? current.passwordLoginEnabled,
        registrationEnabled: input.registrationEnabled ?? current.registrationEnabled,
        ssoLoginEnabled: input.ssoLoginEnabled ?? current.ssoLoginEnabled,
        ssoPluginId: input.ssoPluginId ?? current.ssoPluginId,
        ssoButtonLabel: input.ssoButtonLabel ?? current.ssoButtonLabel,
        ssoButtonLogoUrl: input.ssoButtonLogoUrl ?? current.ssoButtonLogoUrl,
        ssoButtonHref: input.ssoButtonHref ?? current.ssoButtonHref,
      },
      {},
    ),
    updatedBy,
    nowIso(),
  );
  return getIdentityAccessSettings();
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
    return { allowed: true, reason: "whitelist_missing" as const, accessibleBusinessTeamIds: args.teams.map((team) => team.id) };
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

function createAuthSession(userId: string, authProviderConfigId: string | null = null) {
  const sessionId = randomUUID();
  const sessionToken = randomUUID();
  execute(
    "INSERT INTO auth_sessions (id, user_id, auth_provider_config_id, session_token, status, expires_at, created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    sessionId,
    userId,
    authProviderConfigId,
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

export function ensureBootstrapLocalAdmin() {
  const existingCredential = queryOne<LocalAuthCredential>(
    "SELECT * FROM local_auth_credentials WHERE status = 'active' ORDER BY created_at ASC LIMIT 1",
  );
  if (existingCredential) return migrateLegacyBootstrapPasswordIfNeeded(existingCredential);

  const defaults = bootstrapLocalAdminDefaults();
  const forcePasswordChange = shouldCreateDefaultAdminPasswordChange(defaults) ? 1 : 0;
  const existingAdmin = queryOne<IdentityUser>(
    "SELECT * FROM identity_users WHERE is_system_admin = 1 AND status <> 'deleted' ORDER BY created_at ASC LIMIT 1",
  );
  const userId = existingAdmin?.id ?? randomUUID();
  const createdAt = existingAdmin?.createdAt ?? nowIso();
  const adminProfile = parseJsonRecord(existingAdmin?.profileJson);

  execute(
    "INSERT OR REPLACE INTO identity_users (id, tenant_space_id, auth_provider_config_id, external_user_id, employee_no, email, name, avatar_url, title, status, is_system_admin, primary_business_team_id, profile_json, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    userId,
    existingAdmin?.tenantSpaceId ?? null,
    existingAdmin?.authProviderConfigId ?? null,
    existingAdmin?.externalUserId ?? defaults.username,
    existingAdmin?.employeeNo ?? "BOOTSTRAP-ADMIN",
    existingAdmin?.email ?? defaults.email,
    existingAdmin?.name ?? defaults.name,
    existingAdmin?.avatarUrl ?? "",
    existingAdmin?.title ?? defaults.title,
    "active",
    1,
    existingAdmin?.primaryBusinessTeamId ?? null,
    normalizeJson(
      {
        ...adminProfile,
        localAuthSource: "bootstrap_local_account",
        passwordChangeRequired: forcePasswordChange === 1,
      },
      {},
    ),
    createdAt,
    nowIso(),
    existingAdmin?.lastLoginAt ?? nowIso(),
  );

  const credentialId = randomUUID();
  execute(
    "INSERT INTO local_auth_credentials (id, user_id, username, password_hash, force_password_change, status, created_at, updated_at, last_password_change_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    credentialId,
    userId,
    defaults.username,
    hashPassword(defaults.password),
    forcePasswordChange,
    "active",
    nowIso(),
    nowIso(),
    null,
  );

  return queryOne<LocalAuthCredential>("SELECT * FROM local_auth_credentials WHERE id = ?", credentialId)!;
}

export function getLocalAuthCredentialForUser(userId: string) {
  return queryOne<LocalAuthCredential>(
    "SELECT * FROM local_auth_credentials WHERE user_id = ? AND status = 'active' LIMIT 1",
    userId,
  );
}

export function signInWithPassword(input: { username: string; password: string }) {
  const settings = getIdentityAccessSettings();
  if (!settings.passwordLoginEnabled) {
    throw new Error("identityAccess.signIn.errors.passwordDisabled");
  }

  ensureBootstrapLocalAdmin();
  const username = normalizeUsername(input.username);
  const credential = queryOne<LocalAuthCredential>(
    "SELECT * FROM local_auth_credentials WHERE username = ? AND status = 'active' LIMIT 1",
    username,
  );
  if (!credential || !verifyPassword(input.password, credential.passwordHash)) {
    throw new Error("identityAccess.signIn.errors.invalidCredentials");
  }

  const user = queryOne<IdentityUser>("SELECT * FROM identity_users WHERE id = ? AND status = 'active' LIMIT 1", credential.userId);
  if (!user) {
    throw new Error("identityAccess.signIn.errors.invalidCredentials");
  }

  execute(
    "UPDATE identity_users SET last_login_at = ?, updated_at = ? WHERE id = ?",
    nowIso(),
    nowIso(),
    user.id,
  );

  return createAuthSession(user.id, user.authProviderConfigId);
}

export function registerWithPassword(input: {
  username: string;
  password: string;
  name: string;
  email: string;
}) {
  const settings = getIdentityAccessSettings();
  if (!settings.passwordLoginEnabled || !settings.registrationEnabled) {
    throw new Error("identityAccess.register.errors.disabled");
  }

  const username = normalizeUsername(input.username);
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  if (!username || !name || !email || !password) {
    throw new Error("identityAccess.register.errors.required");
  }
  if (username.length < 3) {
    throw new Error("identityAccess.register.errors.usernameTooShort");
  }
  const existingCredential = queryOne<LocalAuthCredential>(
    "SELECT * FROM local_auth_credentials WHERE username = ? AND status = 'active' LIMIT 1",
    username,
  );
  if (existingCredential) {
    throw new Error("identityAccess.register.errors.usernameExists");
  }
  const existingUser = queryOne<IdentityUser>(
    "SELECT * FROM identity_users WHERE email = ? AND status <> 'deleted' LIMIT 1",
    email,
  );
  if (existingUser) {
    throw new Error("identityAccess.register.errors.emailExists");
  }

  const userId = randomUUID();
  const now = nowIso();
  execute(
    "INSERT INTO identity_users (id, tenant_space_id, auth_provider_config_id, external_user_id, employee_no, email, name, avatar_url, title, status, is_system_admin, primary_business_team_id, profile_json, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    userId,
    null,
    null,
    username,
    username,
    email,
    name,
    "",
    "",
    "active",
    0,
    null,
    normalizeJson({ localAuthSource: "self_registration" }, {}),
    now,
    now,
    now,
  );
  execute(
    "INSERT INTO local_auth_credentials (id, user_id, username, password_hash, force_password_change, status, created_at, updated_at, last_password_change_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    randomUUID(),
    userId,
    username,
    hashPassword(password),
    0,
    "active",
    now,
    now,
    now,
  );

  return createAuthSession(userId, null);
}

export function changeCurrentUserPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}) {
  const credential = getLocalAuthCredentialForUser(input.userId);
  if (!credential || !verifyPassword(input.currentPassword, credential.passwordHash)) {
    throw new Error("identityAccess.password.errors.currentInvalid");
  }
  if (!shouldRequireDefaultAdminPasswordChange(credential)) {
    throw new Error("identityAccess.password.errors.notRequired");
  }
  const newPassword = input.newPassword.trim();
  if (!newPassword) {
    throw new Error("identityAccess.password.errors.required");
  }
  if (input.currentPassword === newPassword) {
    throw new Error("identityAccess.password.errors.samePassword");
  }

  execute(
    "UPDATE local_auth_credentials SET password_hash = ?, force_password_change = 0, updated_at = ?, last_password_change_at = ? WHERE id = ?",
    hashPassword(newPassword),
    nowIso(),
    nowIso(),
    credential.id,
  );
  const user = queryOne<IdentityUser>("SELECT * FROM identity_users WHERE id = ? LIMIT 1", input.userId);
  execute(
    "UPDATE identity_users SET profile_json = ?, updated_at = ? WHERE id = ?",
    normalizeJson({ ...parseJsonRecord(user?.profileJson), passwordChangeRequired: false }, {}),
    nowIso(),
    input.userId,
  );
  return { ok: true };
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
  const localCredential = getLocalAuthCredentialForUser(user.id);
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
    mustChangePassword: shouldRequireDefaultAdminPasswordChange(localCredential),
    settings: getIdentityAccessSettings(),
  };
}

export async function getRequestAuthContext(request?: Pick<Request, "headers">) {
  const sessionToken = request
    ? getCookieValueFromHeader(request.headers.get("cookie"), AUTH_SESSION_COOKIE)
    : (await cookies()).get(AUTH_SESSION_COOKIE)?.value;
  return getAuthContextBySessionToken(sessionToken);
}

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

export function buildAuthSessionCookieValue(sessionToken: string, request?: Pick<Request, "headers" | "url">) {
  return {
    name: AUTH_SESSION_COOKIE,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: requestUsesHttps(request),
    expires: addDays(new Date(), 7),
  };
}

export function clearAuthSessionCookie(request?: Pick<Request, "headers" | "url">) {
  return {
    name: AUTH_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: requestUsesHttps(request),
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
