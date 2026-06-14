import { createHash, randomBytes, randomUUID } from "node:crypto";
import { normalizeKnowledgeUri } from "@/lib/knowledge-uri";
import { uiText } from "@/lib/language-pack";
import { canAccessBusinessTeam, getRequestAuthContext, type AuthContext } from "@/server/auth-core";
import { execute, queryAll, queryOne, type AgentTeam, type KnowledgeApiToken, type KnowledgeSpace } from "@/server/db";
import { readSecretEnvList } from "@/server/secret-env";

const DEFAULT_TOKEN_TTL_DAYS = 365;

export type ApiTokenDescriptor = {
  id: string;
  label: string;
  source: "database" | "environment";
  createdBy?: string;
  tokenPrefix?: string;
  createdAt?: string;
  expiresAt?: string | null;
};

export type KnowledgeApiAuthContext =
  | { mode: "session"; authContext: AuthContext }
  | {
      mode: "token";
      token: ApiTokenDescriptor;
    };

export function hashApiToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getDefaultKnowledgeApiTokenTTLDays() {
  return DEFAULT_TOKEN_TTL_DAYS;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeToken(value: string) {
  return value.trim();
}

function parseBearerToken(request: Pick<Request, "headers">) {
  const authorization = request.headers.get("authorization")?.trim();
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) return normalizeToken(match[1]);
  }

  const alternateToken = request.headers.get("x-api-token")?.trim() || request.headers.get("x-api-key")?.trim();
  if (alternateToken) {
    return normalizeToken(alternateToken);
  }
  return null;
}

function getConfiguredEnvironmentTokens() {
  return new Set(
    readSecretEnvList([
      "AGENTWORLD_KNOWLEDGE_API_TOKEN",
      "AGENTWORLD_KNOWLEDGE_API_TOKENS",
    ]),
  );
}

function resolveEnvironmentToken(token: string): ApiTokenDescriptor | null {
  if (!token) return null;
  const envTokens = getConfiguredEnvironmentTokens();
  if (!envTokens.has(token)) return null;

  return {
    id: "env",
    label: "environment token",
    source: "environment",
  };
}

function normalizeExpiresAt(value: string | null | undefined) {
  return value ? value.trim() : null;
}

export function sanitizeTokenRecordForResponse(token: KnowledgeApiToken): ApiTokenDescriptor {
  return {
    id: token.id,
    label: token.label,
    source: "database",
    createdBy: token.createdBy,
    tokenPrefix: token.tokenPrefix,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
  };
}

function isExpired(value: string | null) {
  if (!value) return false;
  const expiresAt = Date.parse(value);
  if (Number.isNaN(expiresAt)) return false;
  return expiresAt <= Date.now();
}

export function listKnowledgeApiTokens(includeInactive = false) {
  const sql = includeInactive
    ? "SELECT * FROM knowledge_api_tokens ORDER BY created_at DESC"
    : "SELECT * FROM knowledge_api_tokens WHERE status = 'active' ORDER BY created_at DESC";
  return queryAll<KnowledgeApiToken>(sql).map(sanitizeTokenRecordForResponse);
}

export function createKnowledgeApiToken(input: {
  label: string;
  createdBy: string;
  expiresAt?: string | null;
}) {
  const id = randomUUID();
  const raw = `akw_${randomBytes(32).toString("base64url")}`;
  const tokenHash = hashApiToken(raw);
  const tokenPrefix = raw.slice(0, 8);
  const createdAt = nowIso();

  let expiresAt = normalizeExpiresAt(input.expiresAt);
  if (!expiresAt) {
    const fallback = new Date(Date.now());
    fallback.setDate(fallback.getDate() + DEFAULT_TOKEN_TTL_DAYS);
    expiresAt = fallback.toISOString();
  }

  execute(
    "INSERT INTO knowledge_api_tokens (id, label, token_prefix, token_hash, status, created_by, expires_at, last_used_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)",
    id,
    normalizeToken(input.label) || `knowledge-api-token-${id}`,
    tokenPrefix,
    tokenHash,
    "active",
    input.createdBy,
    expiresAt,
    createdAt,
    createdAt,
  );

  const record = queryOne<KnowledgeApiToken>("SELECT * FROM knowledge_api_tokens WHERE id = ?", id);

  if (!record) {
    throw new Error("Failed to create knowledge API token");
  }

  return {
    token: raw,
    tokenInfo: sanitizeTokenRecordForResponse(record),
  };
}

export function revokeKnowledgeApiToken(id: string) {
  const token = queryOne<KnowledgeApiToken>("SELECT * FROM knowledge_api_tokens WHERE id = ?", id);
  if (!token) return false;
  if (token.status === "revoked") return true;

  execute("UPDATE knowledge_api_tokens SET status = 'revoked', updated_at = ? WHERE id = ?", nowIso(), id);
  return true;
}

function markTokenUsed(tokenId: string) {
  execute("UPDATE knowledge_api_tokens SET last_used_at = ?, updated_at = ? WHERE id = ?", nowIso(), nowIso(), tokenId);
}

function findActiveTokenByValue(token: string) {
  const record = queryOne<KnowledgeApiToken>("SELECT * FROM knowledge_api_tokens WHERE token_hash = ?", hashApiToken(token));
  if (!record) return null;
  if (record.status !== "active") return null;
  if (isExpired(record.expiresAt)) {
    execute("UPDATE knowledge_api_tokens SET status = 'expired', updated_at = ? WHERE id = ?", nowIso(), record.id);
    return null;
  }

  markTokenUsed(record.id);
  return sanitizeTokenRecordForResponse(record);
}

export async function resolveKnowledgeApiAuthContext(
  request: Request,
): Promise<KnowledgeApiAuthContext | null> {
  const sessionAuthContext = await getRequestAuthContext(request);
  if (sessionAuthContext) {
    return {
      mode: "session",
      authContext: sessionAuthContext,
    };
  }

  const token = parseBearerToken(request);
  if (!token) return null;

  const envToken = resolveEnvironmentToken(token);
  if (envToken) {
    return {
      mode: "token",
      token: envToken,
    };
  }

  const dbToken = findActiveTokenByValue(token);
  if (!dbToken) return null;

  return {
    mode: "token",
    token: dbToken,
  };
}

export function requireKnowledgeApiAuthFailure() {
  return {
    ok: false as const,
    status: 401,
    error: uiText("ui.api.errors.knowledgeApiAuthRequired", "Missing or invalid knowledge API token."),
  };
}

function uniqueNonEmptyStrings(value?: string[]) {
  return [...new Set((value ?? []).map((item) => item.trim()).filter(Boolean))];
}

function resolveKnowledgeSpaceBusinessTeamId(
  space: Pick<KnowledgeSpace, "businessTeamId" | "agentTeamId">,
  agentTeamById: Map<string, AgentTeam>,
) {
  if (space.businessTeamId) return space.businessTeamId;
  if (!space.agentTeamId) return null;
  return agentTeamById.get(space.agentTeamId)?.businessTeamId ?? null;
}

export function listVisibleKnowledgeSpaceIds(authContext: AuthContext) {
  const agentTeamById = new Map(queryAll<AgentTeam>("SELECT * FROM agent_teams").map((team) => [team.id, team]));
  return queryAll<KnowledgeSpace>(
    "SELECT * FROM knowledge_spaces WHERE status <> 'deleted'",
  )
    .filter((space) =>
      canAccessBusinessTeam(
        authContext,
        resolveKnowledgeSpaceBusinessTeamId(space, agentTeamById),
        { allowGlobal: space.visibility === "global" || space.spaceType === "global" },
      ),
    )
    .map((space) => space.id);
}

export function resolveKnowledgeApiSearchAccess(
  auth: KnowledgeApiAuthContext,
  requestedKnowledgeSpaceIds?: string[],
) {
  const requestedIds = uniqueNonEmptyStrings(requestedKnowledgeSpaceIds);
  if (auth.mode === "token") {
    return {
      allowedKnowledgeSpaceIds: undefined,
      knowledgeSpaceIds: requestedIds.length ? requestedIds : undefined,
    };
  }

  const visibleIds = new Set(listVisibleKnowledgeSpaceIds(auth.authContext));
  const scopedVisibleIds = requestedIds.length
    ? requestedIds.filter((id) => visibleIds.has(id))
    : [...visibleIds];
  return {
    allowedKnowledgeSpaceIds: scopedVisibleIds,
    knowledgeSpaceIds: requestedIds.length ? scopedVisibleIds : undefined,
  };
}

export function canReadKnowledgeUri(auth: KnowledgeApiAuthContext, uri: string) {
  if (auth.mode === "token") return true;
  const searchAccess = resolveKnowledgeApiSearchAccess(auth);
  if (!searchAccess.allowedKnowledgeSpaceIds?.length) return false;
  const normalizedUri = normalizeKnowledgeUri(uri);
  const entries = queryAll<{ knowledgeSpaceId: string | null }>(
    "SELECT knowledge_space_id FROM knowledge_entries WHERE viking_uri = ? OR viking_uri LIKE ? LIMIT 1",
    normalizedUri,
    `${normalizedUri.replace(/\/+$/, "")}/%`,
  );
  return entries.some((entry) =>
    Boolean(entry.knowledgeSpaceId && searchAccess.allowedKnowledgeSpaceIds?.includes(entry.knowledgeSpaceId)),
  );
}
