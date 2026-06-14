import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  execute,
  queryAll,
  queryOne,
  type Finding,
  type InspectionFeedback,
  type KnowledgeSpace,
  type TaskRun,
} from "@/server/db";
import { uiText } from "@/lib/language-pack";
import { buildRepositoryNameAliases } from "@/lib/repository-identity";
import {
  buildFindingFeedbackDigest,
  parseFindingFeedbackToken,
} from "@/server/finding-feedback-token";
import { updateFinding } from "@/server/finding-core";
import { appendTaskRunEvent } from "@/server/task-run-event-store";

export {
  buildFindingFeedbackPath,
  buildFindingFeedbackToken,
  buildFindingFeedbackUrl,
} from "@/server/finding-feedback-token";

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

function feedbackStatusForVerdict(verdict: FindingFeedbackVerdict, currentStatus: string) {
  if (verdict === "inaccurate") return "false_positive";
  return currentStatus;
}

function normalizeVerdict(value: unknown): FindingFeedbackVerdict {
  if (value === "accurate" || value === "inaccurate" || value === "unclear") return value;
  return "unclear";
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function resolveFindingFeedbackToken(token: string) {
  const parsed = parseFindingFeedbackToken(token);
  if (!parsed) return null;
  const finding = queryOne<Finding>(
    "SELECT * FROM findings WHERE id = ? AND status <> 'deleted'",
    parsed.findingId,
  );
  if (!finding) return null;
  const expectedDigest = buildFindingFeedbackDigest(finding, parsed.version);
  if (!safeCompare(parsed.digest, expectedDigest)) return null;
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", finding.taskRunId);
  if (!taskRun) return null;
  const existingFeedback = queryOne<InspectionFeedback>(
    "SELECT * FROM inspection_feedback WHERE token = ? ORDER BY created_at DESC LIMIT 1",
    parsed.normalized,
  );
  return { token: parsed.normalized, finding, taskRun, existingFeedback };
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

async function resolveKnowledgeSpaceForFeedback(taskRun: TaskRun) {
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

  const { createKnowledgeSpace } = await import("@/server/knowledge-core");
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

  let knowledgeUri: string | null = null;
  if (input.writeKnowledge !== false) {
    const { upsertKnowledgeEntry } = await import("@/server/knowledge-engine");
    const space = await resolveKnowledgeSpaceForFeedback(resolved.taskRun);
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

  const publication = parseRecord(resolved.finding.publicationJson);
  const feedbackHistory = Array.isArray(publication.feedbackHistory)
    ? publication.feedbackHistory.filter((item) => Boolean(item) && typeof item === "object")
    : [];
  const updatedStatus = feedbackStatusForVerdict(verdict, resolved.finding.status);
  updateFinding({
    id: resolved.finding.id,
    status: updatedStatus,
    publicationJson: {
      ...publication,
      feedback: {
        verdict,
        note,
        sourceIp: input.sourceIp ?? null,
        knowledgeUri,
        recordedBy: "public-feedback",
        recordedAt: now,
      },
      feedbackHistory: [
        ...feedbackHistory.slice(-9),
        {
          verdict,
          note,
          sourceIp: input.sourceIp ?? null,
          knowledgeUri,
          recordedBy: "public-feedback",
          recordedAt: now,
          statusAfterFeedback: updatedStatus,
        },
      ],
    },
  });

  appendTaskRunEvent({
    traceId: resolved.taskRun.traceId,
    taskRunId: resolved.taskRun.id,
    phase: "finding_feedback_recorded",
    foldGroup: "Team Actions",
    title: uiText("ui.server.findingFeedback.eventTitle"),
    content: uiText("ui.server.findingFeedback.eventContent", undefined, {
      verdict,
      title: resolved.finding.title,
    }),
    metadata: {
      findingId: resolved.finding.id,
      verdict,
      note,
      sourceIp: input.sourceIp ?? null,
      knowledgeUri,
      previousStatus: resolved.finding.status,
      status: updatedStatus,
    },
  });

  return {
    ok: true,
    token: resolved.token,
    findingId: resolved.finding.id,
    taskRunId: resolved.taskRun.id,
    verdict,
    knowledgeUri,
  };
}
