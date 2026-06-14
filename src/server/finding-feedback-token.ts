import { createHash, createHmac, randomBytes } from "node:crypto";
import { execute, queryOne } from "@/server/db";
import { readOptionalSecretEnv } from "@/server/secret-env";

type FeedbackFinding = {
  id: string;
  taskRunId: string;
  fingerprint: string | null;
  createdAt: string;
};

type ParsedFindingFeedbackToken = {
  digest: string;
  findingId: string;
  normalized: string;
  version: "legacy" | "v2";
};

const FEEDBACK_TOKEN_SECRET_SETTING_KEY = "finding_feedback_token_secret";

function nowIso() {
  return new Date().toISOString();
}

function readStoredFeedbackTokenSecret() {
  const setting = queryOne<{ valueJson: string }>(
    "SELECT value_json FROM system_settings WHERE key = ?",
    FEEDBACK_TOKEN_SECRET_SETTING_KEY,
  );
  if (!setting?.valueJson) return null;
  try {
    const parsed = JSON.parse(setting.valueJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    return typeof record.secret === "string" ? record.secret : null;
  } catch {
    return null;
  }
}

function getFeedbackTokenSecret() {
  const configured = readOptionalSecretEnv("AGENTWORLD_FEEDBACK_TOKEN_SECRET");
  if (configured) return configured;

  const stored = readStoredFeedbackTokenSecret();
  if (stored) return stored;

  const secret = randomBytes(32).toString("hex");
  execute(
    "INSERT OR REPLACE INTO system_settings (key, value_json, updated_by, updated_at) VALUES (?, ?, ?, ?)",
    FEEDBACK_TOKEN_SECRET_SETTING_KEY,
    JSON.stringify({ secret }),
    "system",
    nowIso(),
  );
  return secret;
}

function feedbackTokenPayload(finding: FeedbackFinding) {
  return [finding.id, finding.taskRunId, finding.fingerprint ?? "", finding.createdAt].join("\0");
}

export function buildLegacyFindingFeedbackToken(finding: FeedbackFinding) {
  const digest = createHash("sha256")
    .update([finding.id, finding.taskRunId, finding.fingerprint, finding.createdAt].join(":"))
    .digest("hex")
    .slice(0, 32);
  return `${finding.id}.${digest}`;
}

export function buildFindingFeedbackToken(finding: FeedbackFinding) {
  const digest = createHmac("sha256", getFeedbackTokenSecret())
    .update(feedbackTokenPayload(finding))
    .digest("hex");
  return `v2.${finding.id}.${digest}`;
}

export function parseFindingFeedbackToken(token: string): ParsedFindingFeedbackToken | null {
  const normalized = token.trim();
  if (normalized.startsWith("v2.")) {
    const separator = normalized.lastIndexOf(".");
    if (separator <= "v2.".length) return null;
    const digest = normalized.slice(separator + 1);
    if (!/^[a-f0-9]{64}$/.test(digest)) return null;
    return {
      digest,
      findingId: normalized.slice("v2.".length, separator),
      normalized,
      version: "v2",
    };
  }

  const separator = normalized.lastIndexOf(".");
  if (separator <= 0) return null;
  const digest = normalized.slice(separator + 1);
  if (!/^[a-f0-9]{32}$/.test(digest)) return null;
  return {
    digest,
    findingId: normalized.slice(0, separator),
    normalized,
    version: "legacy",
  };
}

export function buildFindingFeedbackDigest(finding: FeedbackFinding, version: ParsedFindingFeedbackToken["version"]) {
  if (version === "legacy") {
    return buildLegacyFindingFeedbackToken(finding).slice(finding.id.length + 1);
  }
  return createHmac("sha256", getFeedbackTokenSecret())
    .update(feedbackTokenPayload(finding))
    .digest("hex");
}

export function buildFindingFeedbackPath(finding: FeedbackFinding) {
  return `/finding-feedback/${encodeURIComponent(buildFindingFeedbackToken(finding))}`;
}

export function buildFindingFeedbackUrl(finding: FeedbackFinding, baseUrl?: string | null) {
  const path = buildFindingFeedbackPath(finding);
  const normalizedBaseUrl = baseUrl?.trim();
  if (!normalizedBaseUrl) return path;

  try {
    return new URL(path, normalizedBaseUrl.endsWith("/") ? normalizedBaseUrl : `${normalizedBaseUrl}/`).toString();
  } catch {
    return path;
  }
}
