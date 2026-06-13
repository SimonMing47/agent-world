import { createHash, createPublicKey, createVerify, randomBytes } from "node:crypto";
import { addMinutes } from "date-fns";
import { getAuthAdapter } from "@/server/auth-adapter-core";
import {
  getIdentityAccessSettings,
  listAuthProviderConfigs,
  signInWithEnterpriseIdentity,
  type EnterpriseIdentityInput,
  type EnterpriseIdentityTeamMembership,
} from "@/server/auth-core";
import { execute, queryOne, type AuthProviderConfig, type AuthSsoState } from "@/server/db";
import { resolveSecretRef } from "@/server/plugin-sdk-core";

type OidcMetadata = {
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  issuer?: string;
};

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  refresh_token?: string;
  [key: string]: unknown;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type Jwks = {
  keys?: Array<Record<string, unknown>>;
};

const DEFAULT_SCOPES = ["openid", "profile", "email"];

function nowIso() {
  return new Date().toISOString();
}

function randomBase64Url(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}

function normalizeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/overview";
  const pathname = value.split("?")[0];
  if (pathname === "/signin" || pathname === "/change-password") return "/overview";
  return value;
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

function parseJsonArray(value: string | null | undefined, fallback: string[] = []) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : fallback;
  } catch {
    return fallback;
  }
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["1", "true", "yes", "admin"].includes(value.trim().toLowerCase());
  if (typeof value === "number") return value === 1;
  return false;
}

function claimValue(claims: Record<string, unknown>, path: unknown) {
  if (typeof path !== "string" || !path.trim()) return undefined;
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[part];
  }, claims);
}

function claimString(claims: Record<string, unknown>, path: unknown, fallback = "") {
  const value = claimValue(claims, path);
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number") return String(value);
  return fallback;
}

function decodeJwtSegment(segment: string) {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
}

function decodeJwt(token: string) {
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart) {
    throw new Error("identityAccess.sso.errors.invalidIdToken");
  }
  return {
    header: decodeJwtSegment(headerPart) as JwtHeader,
    payload: decodeJwtSegment(payloadPart),
    signingInput: `${headerPart}.${payloadPart}`,
    signature: Buffer.from(signaturePart, "base64url"),
  };
}

function verifyJwtSignature(args: {
  header: JwtHeader;
  signingInput: string;
  signature: Buffer;
  jwks: Jwks;
}) {
  const algToHash: Record<string, string> = {
    RS256: "RSA-SHA256",
    RS384: "RSA-SHA384",
    RS512: "RSA-SHA512",
  };
  const hash = args.header.alg ? algToHash[args.header.alg] : null;
  if (!hash) throw new Error("identityAccess.sso.errors.unsupportedJwtAlgorithm");
  const key = args.jwks.keys?.find((candidate) => {
    const kid = candidate.kid;
    return typeof kid === "string" ? kid === args.header.kid : true;
  });
  if (!key) throw new Error("identityAccess.sso.errors.jwksKeyNotFound");
  const publicKey = createPublicKey({ key: key as JsonWebKey, format: "jwk" });
  const verifier = createVerify(hash);
  verifier.update(args.signingInput);
  verifier.end();
  if (!verifier.verify(publicKey, args.signature)) {
    throw new Error("identityAccess.sso.errors.invalidIdTokenSignature");
  }
}

function validateIdTokenClaims(args: {
  claims: Record<string, unknown>;
  provider: AuthProviderConfig;
  issuer: string;
  nonce: string;
}) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = typeof args.claims.exp === "number" ? args.claims.exp : Number(args.claims.exp);
  if (!Number.isFinite(exp) || exp <= nowSeconds) throw new Error("identityAccess.sso.errors.idTokenExpired");
  const nbf = typeof args.claims.nbf === "number" ? args.claims.nbf : Number(args.claims.nbf);
  if (Number.isFinite(nbf) && nbf > nowSeconds + 60) throw new Error("identityAccess.sso.errors.idTokenNotYetValid");
  if (args.issuer && args.claims.iss !== args.issuer) throw new Error("identityAccess.sso.errors.issuerMismatch");
  const aud = args.claims.aud;
  const audienceMatches = Array.isArray(aud)
    ? aud.map(String).includes(args.provider.clientId)
    : String(aud) === args.provider.clientId;
  if (!audienceMatches) throw new Error("identityAccess.sso.errors.audienceMismatch");
  if (args.claims.nonce !== args.nonce) throw new Error("identityAccess.sso.errors.nonceMismatch");
}

async function resolveOidcMetadata(provider: AuthProviderConfig) {
  const config = parseJsonRecord(provider.configJson);
  const configuredMetadata = config.oidcMetadata;
  let metadata: OidcMetadata = configuredMetadata && typeof configuredMetadata === "object"
    ? configuredMetadata as OidcMetadata
    : {};

  if ((!provider.authorizeUrl || !provider.tokenUrl || !provider.jwksUrl) && provider.issuerUrl) {
    const issuer = provider.issuerUrl.replace(/\/+$/, "");
    const response = await fetch(`${issuer}/.well-known/openid-configuration`, { cache: "no-store" });
    if (response.ok) metadata = { ...metadata, ...((await response.json()) as OidcMetadata) };
  }

  return {
    issuer: provider.issuerUrl || metadata.issuer || "",
    authorizeUrl: provider.authorizeUrl || metadata.authorization_endpoint || "",
    tokenUrl: provider.tokenUrl || metadata.token_endpoint || "",
    userinfoUrl: provider.userinfoUrl || metadata.userinfo_endpoint || "",
    jwksUrl: provider.jwksUrl || metadata.jwks_uri || "",
    config,
  };
}

function selectProvider(adapterId: string, providerId?: string | null) {
  const providers = listAuthProviderConfigs().filter((provider) => provider.status === "active");
  if (providerId) {
    return providers.find((provider) => provider.id === providerId && provider.adapterKey === adapterId) ?? null;
  }
  return providers.find((provider) => provider.adapterKey === adapterId) ?? null;
}

function insertSsoState(args: {
  state: string;
  adapterKey: string;
  authProviderConfigId: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
  nextPath: string;
}) {
  const now = nowIso();
  execute(
    "INSERT INTO auth_sso_states (state, adapter_key, auth_provider_config_id, nonce, code_verifier, redirect_uri, next_path, status, created_at, expires_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args.state,
    args.adapterKey,
    args.authProviderConfigId,
    args.nonce,
    args.codeVerifier,
    args.redirectUri,
    args.nextPath,
    "pending",
    now,
    addMinutes(new Date(), 10).toISOString(),
    now,
  );
}

function consumeSsoState(adapterId: string, state: string) {
  const row = queryOne<AuthSsoState>(
    "SELECT * FROM auth_sso_states WHERE state = ? AND adapter_key = ? LIMIT 1",
    state,
    adapterId,
  );
  if (!row || row.status !== "pending") throw new Error("identityAccess.sso.errors.invalidState");
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    execute("UPDATE auth_sso_states SET status = 'expired', updated_at = ? WHERE state = ?", nowIso(), state);
    throw new Error("identityAccess.sso.errors.expiredState");
  }
  execute("UPDATE auth_sso_states SET status = 'used', updated_at = ? WHERE state = ?", nowIso(), state);
  return row;
}

async function verifyAndReadIdToken(args: {
  token: string;
  provider: AuthProviderConfig;
  metadata: Awaited<ReturnType<typeof resolveOidcMetadata>>;
  nonce: string;
}) {
  const decoded = decodeJwt(args.token);
  if (!args.metadata.jwksUrl) throw new Error("identityAccess.sso.errors.jwksRequired");
  const response = await fetch(args.metadata.jwksUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("identityAccess.sso.errors.jwksFetchFailed");
  const jwks = (await response.json()) as Jwks;
  verifyJwtSignature({ ...decoded, jwks });
  validateIdTokenClaims({
    claims: decoded.payload,
    provider: args.provider,
    issuer: args.metadata.issuer,
    nonce: args.nonce,
  });
  return decoded.payload;
}

async function fetchUserinfo(metadata: Awaited<ReturnType<typeof resolveOidcMetadata>>, accessToken: string | undefined) {
  if (!metadata.userinfoUrl || !accessToken) return {};
  const response = await fetch(metadata.userinfoUrl, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) return {};
  const parsed = (await response.json()) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

function teamMembershipsFromClaims(
  claims: Record<string, unknown>,
  mapping: Record<string, unknown>,
) {
  const teamClaims = Array.isArray(mapping.teamClaims) ? mapping.teamClaims : [];
  const memberships: EnterpriseIdentityTeamMembership[] = [];
  for (const claimPath of teamClaims) {
    const value = claimValue(claims, claimPath);
    const items = Array.isArray(value) ? value : value ? [value] : [];
    for (const item of items) {
      if (typeof item === "string") {
        memberships.push({ teamSlug: item, teamName: item });
      } else if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        memberships.push({
          businessTeamId: readString(record.businessTeamId) || readString(record.id) || null,
          teamSlug: readString(record.teamSlug) || readString(record.slug) || null,
          teamName: readString(record.teamName) || readString(record.name) || null,
          roleTitle: readString(record.roleTitle) || readString(record.title) || null,
          isPrimary: readBoolean(record.isPrimary),
        });
      }
    }
  }
  return memberships;
}

function buildEnterpriseIdentity(args: {
  provider: AuthProviderConfig;
  claims: Record<string, unknown>;
  tokens: TokenResponse;
}): EnterpriseIdentityInput {
  const mapping = {
    idClaim: "sub",
    nameClaim: "name",
    emailClaim: "email",
    avatarClaim: "picture",
    titleClaim: "title",
    employeeNoClaim: "employee_no",
    adminClaim: "is_admin",
    teamClaims: [],
    ...parseJsonRecord(args.provider.mappingJson),
  };
  const externalUserId = claimString(args.claims, mapping.idClaim) || claimString(args.claims, "sub");
  const adminClaim = claimValue(args.claims, mapping.adminClaim);
  return {
    authProviderConfigId: args.provider.id,
    externalUserId,
    employeeNo: claimString(args.claims, mapping.employeeNoClaim, externalUserId),
    email: claimString(args.claims, mapping.emailClaim),
    name: claimString(args.claims, mapping.nameClaim) || claimString(args.claims, mapping.emailClaim),
    avatarUrl: claimString(args.claims, mapping.avatarClaim),
    title: claimString(args.claims, mapping.titleClaim),
    isSystemAdmin: readBoolean(adminClaim),
    teamMemberships: teamMembershipsFromClaims(args.claims, mapping),
    profile: {
      ssoClaims: args.claims,
      ssoTokenMeta: {
        tokenType: args.tokens.token_type,
        expiresIn: args.tokens.expires_in,
        scope: args.tokens.scope,
      },
    },
  };
}

export async function startEnterpriseSsoSignIn(adapterId: string, request: Request) {
  const settings = getIdentityAccessSettings();
  if (!settings.ssoLoginEnabled) throw new Error("identityAccess.sso.errors.disabled");
  const adapter = getAuthAdapter(adapterId);
  if (!adapter || adapter.status !== "ready") throw new Error("identityAccess.sso.errors.adapterNotReady");
  if (adapter.protocol !== "oidc") throw new Error("identityAccess.sso.errors.protocolUnsupported");

  const url = new URL(request.url);
  const provider = selectProvider(adapterId, url.searchParams.get("providerId"));
  if (!provider) throw new Error("identityAccess.sso.errors.providerNotFound");
  const metadata = await resolveOidcMetadata(provider);
  if (!metadata.authorizeUrl || !metadata.tokenUrl || !provider.clientId) {
    throw new Error("identityAccess.sso.errors.providerIncomplete");
  }

  const state = randomBase64Url();
  const nonce = randomBase64Url();
  const codeVerifier = randomBase64Url(48);
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const redirectUri = new URL(`/api/auth/plugins/${encodeURIComponent(adapter.key)}/callback`, request.url).toString();
  const nextPath = normalizeNextPath(url.searchParams.get("next"));
  insertSsoState({
    state,
    adapterKey: adapter.key,
    authProviderConfigId: provider.id,
    nonce,
    codeVerifier,
    redirectUri,
    nextPath,
  });

  const scopes = parseJsonArray(provider.scopesJson, DEFAULT_SCOPES);
  const authorizeUrl = new URL(metadata.authorizeUrl);
  authorizeUrl.searchParams.set("client_id", provider.clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", scopes.join(" "));
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("nonce", nonce);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  return { redirectUrl: authorizeUrl.toString(), provider, adapter, state };
}

async function exchangeAuthorizationCode(args: {
  provider: AuthProviderConfig;
  metadata: Awaited<ReturnType<typeof resolveOidcMetadata>>;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}) {
  const config = args.metadata.config;
  const clientAuth = readString(config.clientAuth, "client_secret_post");
  const secret = args.provider.clientSecretRef ? resolveSecretRef(args.provider.clientSecretRef) : null;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirectUri,
    client_id: args.provider.clientId,
    code_verifier: args.codeVerifier,
  });
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (secret && clientAuth === "client_secret_basic") {
    headers.Authorization = `Basic ${Buffer.from(`${args.provider.clientId}:${secret}`).toString("base64")}`;
  } else if (secret) {
    body.set("client_secret", secret);
  }

  const response = await fetch(args.metadata.tokenUrl, {
    method: "POST",
    headers,
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || payload.error || "identityAccess.sso.errors.tokenExchangeFailed");
  }
  return payload;
}

export async function completeEnterpriseSsoSignIn(adapterId: string, request: Request) {
  const adapter = getAuthAdapter(adapterId);
  if (!adapter || adapter.status !== "ready") throw new Error("identityAccess.sso.errors.adapterNotReady");
  if (adapter.protocol !== "oidc") throw new Error("identityAccess.sso.errors.protocolUnsupported");
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) throw new Error(url.searchParams.get("error_description") || error);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) throw new Error("identityAccess.sso.errors.callbackMissingCode");
  const ssoState = consumeSsoState(adapter.key, state);
  const provider = queryOne<AuthProviderConfig>(
    "SELECT * FROM auth_provider_configs WHERE id = ? AND adapter_key = ? AND status = 'active' LIMIT 1",
    ssoState.authProviderConfigId,
    adapter.key,
  );
  if (!provider) throw new Error("identityAccess.sso.errors.providerNotFound");
  const metadata = await resolveOidcMetadata(provider);
  if (!metadata.tokenUrl) throw new Error("identityAccess.sso.errors.providerIncomplete");
  const tokens = await exchangeAuthorizationCode({
    provider,
    metadata,
    code,
    redirectUri: ssoState.redirectUri,
    codeVerifier: ssoState.codeVerifier,
  });
  const config = parseJsonRecord(provider.configJson);
  const idTokenClaims = tokens.id_token
    ? await verifyAndReadIdToken({
        token: tokens.id_token,
        provider,
        metadata,
        nonce: ssoState.nonce,
      })
    : {};
  if (!tokens.id_token && config.allowUserinfoOnly !== true) {
    throw new Error("identityAccess.sso.errors.idTokenRequired");
  }
  const userinfo = await fetchUserinfo(metadata, tokens.access_token);
  const identity = buildEnterpriseIdentity({
    provider,
    claims: {
      ...idTokenClaims,
      ...userinfo,
    },
    tokens,
  });
  const signIn = signInWithEnterpriseIdentity(identity);
  return {
    ...signIn,
    nextPath: normalizeNextPath(ssoState.nextPath),
  };
}
