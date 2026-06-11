import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  execute,
  queryAll,
  queryOne,
  type Finding,
  type InspectionFeedback,
  type KnowledgeSpace,
  type TaskRun,
} from "@/server/db";
import { createKnowledgeSpace } from "@/server/knowledge-core";
import { upsertKnowledgeEntry } from "@/server/knowledge-engine";
import { uiText } from "@/lib/language-pack";
import { buildRepositoryNameAliases } from "@/lib/repository-identity";

export type FindingFeedbackVerdict = "accurate" | "inaccurate" | "unclear";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseRecord(value: string | null | undefined): JsonRecord {
  try {
    const parsed = JSON.parse(value ?? "{}") as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeVerdict(value: unknown): FindingFeedbackVerdict {
  if (value === "accurate" || value === "inaccurate" || value === "unclear") return value;
  return "unclear";
}

function tokenDigest(finding: Finding) {
  return createHash("sha256")
    .update([finding.id, finding.taskRunId, finding.fingerprint, finding.createdAt].join(":"))
    .digest("hex")
    .slice(0, 32);
}

export function buildFindingFeedbackToken(finding: Finding) {
  return `${finding.id}.${tokenDigest(finding)}`;
}

export function buildFindingFeedbackPath(finding: Finding) {
  return `/finding-feedback/${encodeURIComponent(buildFindingFeedbackToken(finding))}`;
}

export function buildFindingFeedbackUrl(finding: Finding, baseUrl?: string | null) {
  const path = buildFindingFeedbackPath(finding);
  const normalizedBaseUrl = baseUrl?.trim();
  if (!normalizedBaseUrl) return path;

  try {
    return new URL(path, normalizedBaseUrl.endsWith("/") ? normalizedBaseUrl : `${normalizedBaseUrl}/`).toString();
  } catch {
    return path;
  }
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function resolveFindingFeedbackToken(token: string) {
  const normalized = token.trim();
  const separator = normalized.lastIndexOf(".");
  if (separator <= 0) return null;
  const findingId = normalized.slice(0, separator);
  const digest = normalized.slice(separator + 1);
  const finding = queryOne<Finding>("SELECT * FROM findings WHERE id = ? AND status <> 'deleted'", findingId);
  if (!finding) return null;
  if (!safeCompare(digest, tokenDigest(finding))) return null;
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", finding.taskRunId);
  if (!taskRun) return null;
  const existingFeedback = queryOne<InspectionFeedback>(
    "SELECT * FROM inspection_feedback WHERE token = ? ORDER BY created_at DESC LIMIT 1",
    normalized,
  );
  return { token: normalized, finding, taskRun, existingFeedback };
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "repository";
}

function resolveKnowledgeSpaceForFeedback(taskRun: TaskRun) {
  const input = parseRecord(taskRun.inputPayloadJson);
  const repositoryName = firstString(input.codebase_name, input.repo_id, input.repositoryName, input.repository_name);
  const repositoryAliases = buildRepositoryNameAliases(
    repositoryName,
    firstString(input.repo_url, input.repositoryUrl, input.repository_url),
  );
  if (repositoryAliases.length) {
    const existing = queryAll<KnowledgeSpace>(
      "SELECT * FROM knowledge_spaces WHERE status <> 'deleted' AND knowledge_category IN ('codebase', 'code', 'repository') ORDER BY updated_at DESC",
    ).find((space) => {
      const spaceAliases = buildRepositoryNameAliases(space.repositoryName, space.projectKey, space.slug);
      return spaceAliases.some((alias) => repositoryAliases.includes(alias));
    });
    if (existing) return existing;
  }

  return createKnowledgeSpace({
    tenantSpaceId: taskRun.tenantSpaceId,
    businessTeamId: taskRun.businessTeamId,
    name: uiText("findingFeedback.knowledge.spaceName", undefined, {
      repository: repositoryName || taskRun.sourceRef || taskRun.id,
    }),
    slug: `finding-feedback-${slugify(repositoryName || taskRun.sourceRef || taskRun.id)}`,
    spaceType: "project",
    projectKey: slugify(repositoryName || taskRun.sourceRef || taskRun.id),
    knowledgeCategory: "codebase",
    repositoryName: repositoryName || undefined,
    description: uiText("findingFeedback.knowledge.spaceDescription"),
    visibility: "team",
  });
}

export function getFindingFeedbackContext(token: string) {
  const resolved = resolveFindingFeedbackToken(token);
  if (!resolved) return null;
  const evidence = parseRecord(resolved.finding.evidenceJson);
  return {
    token: resolved.token,
    finding: resolved.finding,
    taskRun: resolved.taskRun,
    evidence,
    existingFeedback: resolved.existingFeedback,
  };
}

export async function recordFindingFeedback(input: {
  token: string;
  verdict: unknown;
  note?: string | null;
  sourceIp?: string | null;
  writeKnowledge?: boolean;
  knowledgeLayer?: string;
  knowledgeScopePrefix?: string;
}) {
  const resolved = resolveFindingFeedbackToken(input.token);
  if (!resolved) throw new Error(uiText("findingFeedback.errors.invalidToken"));

  const verdict = normalizeVerdict(input.verdict);
  const note = input.note?.trim() || null;
  const now = new Date().toISOString();
  const existing = queryOne<InspectionFeedback>(
    "SELECT * FROM inspection_feedback WHERE token = ? ORDER BY created_at DESC LIMIT 1",
    resolved.token,
  );

  execute(
    "INSERT OR REPLACE INTO inspection_feedback (id, finding_id, inspection_id, token, verdict, note, source_ip, knowledge_uri, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    existing?.id ?? randomUUID(),
    resolved.finding.id,
    resolved.taskRun.id,
    resolved.token,
    verdict,
    note,
    input.sourceIp ?? null,
    null,
    existing?.createdAt ?? now,
  );

  execute(
    "UPDATE findings SET status = ?, updated_at = ? WHERE id = ?",
    verdict === "inaccurate" ? "false_positive" : resolved.finding.status,
    now,
    resolved.finding.id,
  );

  let knowledgeUri: string | null = null;
  if (input.writeKnowledge !== false) {
    const space = resolveKnowledgeSpaceForFeedback(resolved.taskRun);
    const layer = input.knowledgeLayer?.trim() || "feedback/finding";
    const scopePrefix = input.knowledgeScopePrefix?.trim() || "finding-feedback";
    const entry = await upsertKnowledgeEntry({
      knowledgeSpaceId: space?.id ?? null,
      layer,
      scopeKey: `${scopePrefix}/${resolved.finding.id}`,
      title: uiText("findingFeedback.knowledge.entryTitle", undefined, {
        verdict,
        title: resolved.finding.title,
      }),
      contentMd: [
        `# ${resolved.finding.title}`,
        "",
        uiText("findingFeedback.knowledge.verdictLine", undefined, { verdict }),
        note ? uiText("findingFeedback.knowledge.noteLine", undefined, { note }) : null,
        "",
        resolved.finding.description,
        "",
        resolved.finding.recommendation,
      ]
        .filter(Boolean)
        .join("\n"),
      metadataJson: JSON.stringify({
        findingId: resolved.finding.id,
        taskRunId: resolved.taskRun.id,
        verdict,
        source: "finding_feedback",
      }),
      sourceType: "inspection_feedback",
      updatedBy: "public-feedback",
      saveReason: "finding_feedback",
    });
    knowledgeUri = entry?.vikingUri ?? null;
    execute(
      "UPDATE inspection_feedback SET knowledge_uri = ? WHERE token = ?",
      knowledgeUri,
      resolved.token,
    );
  }

  return {
    ok: true,
    token: resolved.token,
    findingId: resolved.finding.id,
    taskRunId: resolved.taskRun.id,
    verdict,
    knowledgeUri,
  };
}
