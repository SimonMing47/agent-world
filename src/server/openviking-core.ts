import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  execute,
  queryAll,
  queryOne,
  type InspectionSkill,
  type KnowledgeLayer,
  type KnowledgeSpace,
  type KnowledgeSpaceBinding,
  type OpenVikingKnowledgeEntry,
  type OpenVikingKnowledgeEntryVersion,
} from "@/server/db";
import { uiText } from "@/lib/language-pack";
import { getKnowledgeBaseSettings } from "@/server/knowledge-base-settings";

const SHADOW_ROOT = path.join("data", "openviking-shadow");
const REMOTE_PENDING_RETRY_STATUS = "remote_pending_retry";
const INTERACTIVE_BUSY_RETRY_DELAYS_MS = [600, 1200, 2400];
const BACKGROUND_BUSY_RETRY_DELAYS_MS = [2500, 8000, 20000, 45000];
const remoteSyncRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const remoteSyncRetryAttempts = new Map<string, number>();

type KnowledgeInput = {
  knowledgeSpaceId?: string | null;
  layer: string;
  scopeKey: string;
  title: string;
  contentMd: string;
  metadata?: Record<string, unknown>;
  sourceType: "inspection_context" | "inspection_finding" | "inspection_feedback" | "skill" | "manual";
  skillId?: string | null;
};

type KnowledgeEntryInput = {
  id?: string;
  knowledgeSpaceId?: string | null;
  layer: string;
  scopeKey: string;
  title: string;
  contentMd: string;
  metadataJson?: string;
  sourceType: "inspection_context" | "inspection_finding" | "inspection_feedback" | "skill" | "manual";
  skillId?: string | null;
  baseRevision?: number | null;
  updatedBy?: string | null;
  saveReason?: string | null;
};

type RemoteSyncResult = {
  status: string;
  error: string | null;
  response?: unknown;
};

type SyncRemoteOptions = {
  busyRetryDelaysMs?: number[];
  pendingOnBusy?: boolean;
};

export type KnowledgeRetrievalTestHit = {
  id: string;
  title: string;
  vikingUri: string;
  syncStatus: string;
  layer: string;
  score: number;
  excerpt: string;
  levels: KnowledgeRetrievalTestLevelHit[];
};

export type KnowledgeRetrievalTestLevelHit = {
  level: "L0" | "L1" | "L2";
  label: string;
  purpose: string;
  score: number;
  excerpt: string;
  editable: boolean;
};

type OpenVikingApiResult<T> = {
  status?: string;
  ok?: boolean;
  result?: T;
  error?: { code?: string; message?: string } | string | null;
};

export class KnowledgeEntryConflictError extends Error {
  currentEntry: OpenVikingKnowledgeEntry | null;

  constructor(currentEntry: OpenVikingKnowledgeEntry | null) {
    super("Knowledge entry was modified by another editor");
    this.name = "KnowledgeEntryConflictError";
    this.currentEntry = currentEntry;
  }
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "default";
}

function getOpenVikingBaseUrl() {
  return getKnowledgeBaseSettings().baseUrl.replace(/\/+$/, "");
}

function getOpenVikingHeaders() {
  const setting = getKnowledgeBaseSettings();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = setting.apiKey;
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (setting.account) headers["X-OpenViking-Account"] = setting.account;
  if (setting.user) headers["X-OpenViking-User"] = setting.user;

  return headers;
}

function layerFallback(layer: string) {
  const safeLayer = slugify(layer);
  if (layer.startsWith("feedback/")) {
    return `viking://user/memories/agentworld/code-inspection/${safeLayer}`;
  }
  if (["security", "quality/test", "data-interface"].includes(layer)) {
    return `viking://agent/skills/agentworld/code-inspection/${safeLayer}`;
  }

  return `viking://resources/agentworld/code-inspection/${safeLayer}`;
}

function getLayer(layerKey: string) {
  return queryOne<KnowledgeLayer>(
    "SELECT * FROM knowledge_layers WHERE layer_key = ? AND is_enabled = 1",
    layerKey,
  );
}

function getKnowledgeSpace(spaceId: string | null | undefined) {
  if (!spaceId) return null;
  return queryOne<KnowledgeSpace>(
    "SELECT * FROM knowledge_spaces WHERE id = ? AND status = ?",
    spaceId,
    "active",
  );
}

function buildVikingUri(layer: string, scopeKey: string, id: string, knowledgeSpaceId?: string | null) {
  const root = getKnowledgeSpace(knowledgeSpaceId)?.vikingUri ?? getLayer(layer)?.vikingUri ?? layerFallback(layer);
  return `${root}/${slugify(scopeKey)}/${id}.md`;
}

function shadowFilePath(layer: string, scopeKey: string, id: string) {
  return path.join(SHADOW_ROOT, slugify(layer), slugify(scopeKey), `${id}.md`);
}

function errorMessage(body: OpenVikingApiResult<unknown>, responseStatus?: string) {
  if (typeof body.error === "string") return body.error;
  if (body.error?.message) return body.error.message;
  return responseStatus ?? "OpenViking request failed";
}

async function openVikingRequest<T>(pathName: string, init?: RequestInit) {
  const setting = getKnowledgeBaseSettings();
  if (!setting.enabled) {
    throw new Error("OpenViking knowledge base is disabled");
  }
  const baseUrl = getOpenVikingBaseUrl();
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...init,
    headers: {
      ...getOpenVikingHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as OpenVikingApiResult<T>;

  if (!response.ok || body.status === "error" || body.ok === false) {
    throw new Error(errorMessage(body, `${response.status} ${response.statusText}`));
  }

  return body.result as T;
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isBusyError(message: string) {
  return message.toLowerCase().includes("resource is busy");
}

function isAlreadyExistsError(message: string) {
  return message.toLowerCase().includes("already exists");
}

async function syncRemote(uri: string, contentMd: string, options: SyncRemoteOptions = {}): Promise<RemoteSyncResult> {
  const attempts = [
    { mode: "create", status: "remote_created" },
    { mode: "replace", status: "remote_replaced" },
  ];
  const busyRetryDelaysMs = options.busyRetryDelaysMs ?? INTERACTIVE_BUSY_RETRY_DELAYS_MS;
  let stoppedOnBusy = false;

  let lastError = "OpenViking remote sync failed";
  for (const attempt of attempts) {
    for (let retry = 0; retry <= busyRetryDelaysMs.length; retry += 1) {
      try {
        const result = await openVikingRequest<unknown>("/api/v1/content/write", {
          method: "POST",
          body: JSON.stringify({ uri, content: contentMd, mode: attempt.mode }),
        });

        return { status: attempt.status, error: null, response: result };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lastError = message;

        if (isBusyError(message)) {
          stoppedOnBusy = true;
          const retryDelay = busyRetryDelaysMs[retry];
          if (retryDelay === undefined) break;
          await delay(retryDelay);
          continue;
        }

        if (attempt.mode === "create" && isAlreadyExistsError(message)) break;

        break;
      }
    }
  }

  if (stoppedOnBusy && options.pendingOnBusy !== false) {
    return { status: REMOTE_PENDING_RETRY_STATUS, error: null };
  }

  return { status: "remote_failed_local_shadow", error: lastError };
}

function shouldRetryRemoteSync(status: string, error: string | null) {
  return status === REMOTE_PENDING_RETRY_STATUS || (status === "remote_failed_local_shadow" && Boolean(error && isBusyError(error)));
}

function updateKnowledgeEntryRemoteSyncState(id: string, syncResult: RemoteSyncResult) {
  execute(
    "UPDATE openviking_knowledge_entries SET sync_status = ?, sync_error = ? WHERE id = ?",
    syncResult.status,
    syncResult.error,
    id,
  );
}

async function retryKnowledgeEntryRemoteSync(entryId: string) {
  const entry = queryOne<OpenVikingKnowledgeEntry>("SELECT * FROM openviking_knowledge_entries WHERE id = ?", entryId);
  if (!entry || !shouldRetryRemoteSync(entry.syncStatus, entry.syncError)) {
    remoteSyncRetryAttempts.delete(entryId);
    return;
  }

  const syncResult = await syncRemote(entry.vikingUri, entry.contentMd, {
    busyRetryDelaysMs: [800, 1600],
    pendingOnBusy: true,
  });
  updateKnowledgeEntryRemoteSyncState(entry.id, syncResult);

  if (shouldRetryRemoteSync(syncResult.status, syncResult.error)) {
    const attempt = remoteSyncRetryAttempts.get(entry.id) ?? 0;
    const delayMs = BACKGROUND_BUSY_RETRY_DELAYS_MS[attempt];
    if (delayMs === undefined) {
      remoteSyncRetryAttempts.delete(entry.id);
      return;
    }
    remoteSyncRetryAttempts.set(entry.id, attempt + 1);
    queueKnowledgeEntryRemoteSyncRetry(entry.id, delayMs);
    return;
  }

  remoteSyncRetryAttempts.delete(entry.id);
}

function queueKnowledgeEntryRemoteSyncRetry(entryId: string, delayMs = BACKGROUND_BUSY_RETRY_DELAYS_MS[0]) {
  if (remoteSyncRetryTimers.has(entryId)) return;
  const timer = setTimeout(() => {
    remoteSyncRetryTimers.delete(entryId);
    void retryKnowledgeEntryRemoteSync(entryId).catch(() => undefined);
  }, delayMs);
  (timer as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.();
  remoteSyncRetryTimers.set(entryId, timer);
}

export async function retryPendingKnowledgeSyncs(limit = 5) {
  const entries = queryAll<OpenVikingKnowledgeEntry>(
    "SELECT * FROM openviking_knowledge_entries WHERE sync_status = ? OR (sync_status = ? AND lower(sync_error) LIKE ?) ORDER BY updated_at ASC LIMIT ?",
    REMOTE_PENDING_RETRY_STATUS,
    "remote_failed_local_shadow",
    "%resource is busy%",
    limit,
  );

  for (const entry of entries) {
    const syncResult = await syncRemote(entry.vikingUri, entry.contentMd, {
      busyRetryDelaysMs: [500],
      pendingOnBusy: true,
    });
    updateKnowledgeEntryRemoteSyncState(entry.id, syncResult);
    if (shouldRetryRemoteSync(syncResult.status, syncResult.error)) {
      queueKnowledgeEntryRemoteSyncRetry(entry.id);
    }
  }

  return entries.length;
}

export async function writeLayeredKnowledge(input: KnowledgeInput) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const layer = getLayer(input.layer);
  const knowledgeSpace = getKnowledgeSpace(input.knowledgeSpaceId);
  const vikingUri = buildVikingUri(input.layer, input.scopeKey, id, input.knowledgeSpaceId);
  const filePath = shadowFilePath(input.layer, input.scopeKey, id);
  const metadata = {
    ...input.metadata,
    vikingUri,
    layer: input.layer,
    scopeKey: input.scopeKey,
    sourceType: input.sourceType,
    openVikingScope: layer?.scope ?? null,
    openVikingLayerRoot: layer?.vikingUri ?? null,
    knowledgeSpaceId: knowledgeSpace?.id ?? null,
    knowledgeSpaceName: knowledgeSpace?.name ?? null,
    createdAt,
  };
  const content = [
    `# ${input.title}`,
    "",
    `- Layer: ${input.layer}`,
    `- Scope: ${input.scopeKey}`,
    `- Source: ${input.sourceType}`,
    input.skillId ? `- Skill: ${input.skillId}` : null,
    `- Viking URI: ${vikingUri}`,
    "",
    input.contentMd,
  ]
    .filter(Boolean)
    .join("\n");

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");

  const syncResult = await syncRemote(vikingUri, content);

  execute(
    "INSERT INTO openviking_knowledge_entries (id, knowledge_space_id, layer, scope_key, skill_id, viking_uri, title, content_md, metadata_json, source_type, sync_status, sync_error, created_at, updated_at, updated_by, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    knowledgeSpace?.id ?? null,
    input.layer,
    input.scopeKey,
    input.skillId ?? null,
    vikingUri,
    input.title,
    content,
    JSON.stringify(metadata),
    input.sourceType,
    syncResult.status,
    syncResult.error,
    createdAt,
    createdAt,
    null,
    1,
  );

  if (shouldRetryRemoteSync(syncResult.status, syncResult.error)) {
    remoteSyncRetryAttempts.set(id, 0);
    queueKnowledgeEntryRemoteSyncRetry(id);
  }

  return {
    id,
    vikingUri,
    filePath,
    syncStatus: syncResult.status,
    syncError: syncResult.error,
  };
}

function parseMetadataJson(value: string | undefined) {
  if (!value) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("metadataJson must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function comparableMetadata(value: string | undefined) {
  const metadata = parseMetadataJson(value);
  for (const key of [
    "vikingUri",
    "layer",
    "scopeKey",
    "sourceType",
    "knowledgeSpaceId",
    "knowledgeSpaceName",
    "updatedAt",
    "updatedBy",
    "revision",
  ]) {
    delete metadata[key];
  }
  return JSON.stringify(metadata);
}

function knowledgeEntryChanged(existing: OpenVikingKnowledgeEntry, input: KnowledgeEntryInput, knowledgeSpaceId: string | null) {
  return (
    existing.knowledgeSpaceId !== knowledgeSpaceId ||
    existing.layer !== input.layer ||
    existing.scopeKey !== input.scopeKey ||
    existing.skillId !== (input.skillId ?? null) ||
    existing.title !== input.title ||
    existing.contentMd !== input.contentMd ||
    existing.sourceType !== input.sourceType ||
    comparableMetadata(existing.metadataJson) !== comparableMetadata(input.metadataJson)
  );
}

function createKnowledgeEntryVersion(entry: OpenVikingKnowledgeEntry, createdBy?: string | null) {
  execute(
    "INSERT OR IGNORE INTO openviking_knowledge_entry_versions (id, entry_id, revision, knowledge_space_id, layer, scope_key, skill_id, viking_uri, title, content_md, metadata_json, source_type, sync_status, sync_error, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    randomUUID(),
    entry.id,
    entry.revision,
    entry.knowledgeSpaceId,
    entry.layer,
    entry.scopeKey,
    entry.skillId,
    entry.vikingUri,
    entry.title,
    entry.contentMd,
    entry.metadataJson,
    entry.sourceType,
    entry.syncStatus,
    entry.syncError,
    new Date().toISOString(),
    createdBy ?? entry.updatedBy ?? null,
  );
  execute(
    "DELETE FROM openviking_knowledge_entry_versions WHERE entry_id = ? AND id NOT IN (SELECT id FROM openviking_knowledge_entry_versions WHERE entry_id = ? ORDER BY revision DESC, created_at DESC LIMIT 3)",
    entry.id,
    entry.id,
  );
}

export async function upsertKnowledgeEntry(input: KnowledgeEntryInput) {
  const existing = input.id
    ? queryOne<OpenVikingKnowledgeEntry>("SELECT * FROM openviking_knowledge_entries WHERE id = ?", input.id)
    : null;
  const id = input.id || randomUUID();
  const createdAt = existing?.createdAt ?? new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const knowledgeSpace = getKnowledgeSpace(input.knowledgeSpaceId);
  const knowledgeSpaceId = knowledgeSpace?.id ?? null;

  if (existing && input.baseRevision != null && existing.revision !== input.baseRevision) {
    throw new KnowledgeEntryConflictError(existing);
  }

  if (existing && !knowledgeEntryChanged(existing, input, knowledgeSpaceId)) {
    return existing;
  }

  const vikingUri = buildVikingUri(input.layer, input.scopeKey, id, input.knowledgeSpaceId);
  const filePath = shadowFilePath(input.layer, input.scopeKey, id);
  const nextRevision = existing ? existing.revision + 1 : 1;
  const metadata = {
    ...parseMetadataJson(input.metadataJson),
    vikingUri,
    layer: input.layer,
    scopeKey: input.scopeKey,
    sourceType: input.sourceType,
    knowledgeSpaceId,
    knowledgeSpaceName: knowledgeSpace?.name ?? null,
    updatedAt,
    updatedBy: input.updatedBy ?? null,
    revision: nextRevision,
  };

  if (existing) createKnowledgeEntryVersion(existing, input.updatedBy);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, input.contentMd, "utf8");
  const syncResult = await syncRemote(vikingUri, input.contentMd);

  if (existing) {
    execute(
      "UPDATE openviking_knowledge_entries SET knowledge_space_id = ?, layer = ?, scope_key = ?, skill_id = ?, viking_uri = ?, title = ?, content_md = ?, metadata_json = ?, source_type = ?, sync_status = ?, sync_error = ?, updated_at = ?, updated_by = ?, revision = ? WHERE id = ?",
      knowledgeSpaceId,
      input.layer,
      input.scopeKey,
      input.skillId ?? null,
      vikingUri,
      input.title,
      input.contentMd,
      JSON.stringify(metadata),
      input.sourceType,
      syncResult.status,
      syncResult.error,
      updatedAt,
      input.updatedBy ?? null,
      nextRevision,
      id,
    );
  } else {
    execute(
      "INSERT INTO openviking_knowledge_entries (id, knowledge_space_id, layer, scope_key, skill_id, viking_uri, title, content_md, metadata_json, source_type, sync_status, sync_error, created_at, updated_at, updated_by, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      knowledgeSpaceId,
      input.layer,
      input.scopeKey,
      input.skillId ?? null,
      vikingUri,
      input.title,
      input.contentMd,
      JSON.stringify(metadata),
      input.sourceType,
      syncResult.status,
      syncResult.error,
      createdAt,
      updatedAt,
      input.updatedBy ?? null,
      nextRevision,
    );
  }

  if (shouldRetryRemoteSync(syncResult.status, syncResult.error)) {
    remoteSyncRetryAttempts.set(id, 0);
    queueKnowledgeEntryRemoteSyncRetry(id);
  }

  return queryOne<OpenVikingKnowledgeEntry>("SELECT * FROM openviking_knowledge_entries WHERE id = ?", id);
}

export function listKnowledgeEntryVersions(entryId: string) {
  return queryAll<OpenVikingKnowledgeEntryVersion>(
    "SELECT * FROM openviking_knowledge_entry_versions WHERE entry_id = ? ORDER BY revision DESC, created_at DESC LIMIT 3",
    entryId,
  );
}

export function getKnowledgeEntry(id: string) {
  return queryOne<OpenVikingKnowledgeEntry>("SELECT * FROM openviking_knowledge_entries WHERE id = ?", id);
}

export function getKnowledgeEntryVersion(entryId: string, versionId: string) {
  return queryOne<OpenVikingKnowledgeEntryVersion>(
    "SELECT * FROM openviking_knowledge_entry_versions WHERE entry_id = ? AND id = ?",
    entryId,
    versionId,
  );
}

export async function restoreKnowledgeEntryVersion(input: {
  entryId: string;
  versionId: string;
  baseRevision?: number | null;
  updatedBy?: string | null;
}) {
  const version = getKnowledgeEntryVersion(input.entryId, input.versionId);
  if (!version) throw new Error("Knowledge entry version not found");
  return upsertKnowledgeEntry({
    id: input.entryId,
    knowledgeSpaceId: version.knowledgeSpaceId,
    layer: version.layer,
    scopeKey: version.scopeKey,
    skillId: version.skillId,
    title: version.title,
    contentMd: version.contentMd,
    metadataJson: version.metadataJson,
    sourceType: version.sourceType as KnowledgeEntryInput["sourceType"],
    baseRevision: input.baseRevision,
    updatedBy: input.updatedBy,
  });
}

export function deleteKnowledgeEntry(id: string) {
  execute("DELETE FROM openviking_knowledge_entry_versions WHERE entry_id = ?", id);
  execute("DELETE FROM openviking_knowledge_entries WHERE id = ?", id);
  return { ok: true };
}

export function listKnowledgeLayers() {
  return queryAll<KnowledgeLayer>(
    "SELECT * FROM knowledge_layers WHERE is_enabled = 1 ORDER BY load_order ASC",
  );
}

export function listLayeredKnowledge(limit = 50) {
  return queryAll<OpenVikingKnowledgeEntry>(
    "SELECT * FROM openviking_knowledge_entries ORDER BY created_at DESC LIMIT ?",
    limit,
  );
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripMarkdownForRetrieval(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+\[[ xX]]\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~>#|]/g, " ");
}

function markdownOutlineForRetrieval(value: string) {
  const headings = value
    .split(/\r?\n/)
    .map((line) => /^#{1,4}\s+(.+)$/.exec(line.trim())?.[1]?.trim())
    .filter((line): line is string => Boolean(line));
  if (headings.length) return headings.slice(0, 10).join(" / ");

  const bullets = value
    .split(/\r?\n/)
    .map((line) => /^\s*[-*+]\s+(?:\[[ xX]]\s+)?(.+)$/.exec(line)?.[1]?.trim())
    .filter((line): line is string => Boolean(line));
  return bullets.slice(0, 10).join(" / ");
}

function buildExcerpt(content: string, query: string) {
  const normalizedContent = compactWhitespace(content);
  const normalizedQuery = compactWhitespace(query);
  if (!normalizedContent) return "";
  const index = normalizedContent.toLowerCase().indexOf(normalizedQuery.toLowerCase());
  if (index < 0) return normalizedContent.slice(0, 180);
  const start = Math.max(0, index - 72);
  const end = Math.min(normalizedContent.length, index + normalizedQuery.length + 96);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalizedContent.length ? "..." : "";
  return `${prefix}${normalizedContent.slice(start, end)}${suffix}`;
}

function scoreTerms(content: string, queryTerms: string[], weight: number) {
  const haystack = compactWhitespace(content).toLowerCase();
  return queryTerms.reduce((score, term) => score + (haystack.includes(term) ? weight : 0), 0);
}

function buildRetrievalSpaceIndex(entries: OpenVikingKnowledgeEntry[]) {
  const notes = entries.filter((entry) => parseMetadataJson(entry.metadataJson).notebookNodeType !== "folder");
  const l0Text = compactWhitespace(
    notes
      .map((entry) => {
        const plainContent = stripMarkdownForRetrieval(entry.contentMd);
        return `${entry.title}: ${plainContent.slice(0, 260)}`;
      })
      .join("\n"),
  );
  const l1Text = compactWhitespace(
    notes
      .map((entry) => {
        const plainContent = stripMarkdownForRetrieval(entry.contentMd);
        const outline = markdownOutlineForRetrieval(entry.contentMd);
        return [`## ${entry.title}`, outline || plainContent.slice(0, 900), entry.metadataJson].filter(Boolean).join("\n");
      })
      .join("\n\n"),
  );
  return { l0Text, l1Text };
}

function retrievalLevelsForEntry(
  entry: OpenVikingKnowledgeEntry,
  query: string,
  queryTerms: string[],
  spaceIndex: ReturnType<typeof buildRetrievalSpaceIndex>,
): KnowledgeRetrievalTestLevelHit[] {
  const plainContent = stripMarkdownForRetrieval(entry.contentMd);
  const l0Text = spaceIndex.l0Text || compactWhitespace([entry.title, plainContent.slice(0, 260), entry.metadataJson].join("\n"));
  const l1Text = spaceIndex.l1Text || compactWhitespace([entry.title, plainContent.slice(0, 1600), entry.metadataJson].join("\n"));
  const l2Text = [entry.title, entry.contentMd, entry.metadataJson].join("\n");

  const levels: KnowledgeRetrievalTestLevelHit[] = [
    {
      level: "L0",
      label: "空间摘要索引召回",
      purpose: "Abstract：知识空间全局一份，用于向量召回、快速过滤和空间级列表感知。",
      score: scoreTerms(entry.title, queryTerms, 6) + scoreTerms(l0Text, queryTerms, 1),
      excerpt: buildExcerpt(l0Text, query),
      editable: false,
    },
    {
      level: "L1",
      label: "空间概览索引重排",
      purpose: "Overview：知识空间全局一份，用于理解空间结构、目录递归和重排细化。",
      score: scoreTerms(entry.title, queryTerms, 4) + scoreTerms(l1Text, queryTerms, 2),
      excerpt: buildExcerpt(l1Text, query),
      editable: false,
    },
    {
      level: "L2",
      label: "原文知识读取",
      purpose: "Details：完整 Markdown 原文，按需读取并允许编辑。",
      score: scoreTerms(entry.title, queryTerms, 5) + scoreTerms(l2Text, queryTerms, 3),
      excerpt: buildExcerpt(entry.contentMd, query),
      editable: true,
    },
  ];

  return levels;
}

export function runKnowledgeRetrievalTest(input: {
  knowledgeSpaceId: string;
  query: string;
  limit?: number;
}) {
  const normalizedQuery = compactWhitespace(input.query);
  if (!normalizedQuery) return [];

  const entries = queryAll<OpenVikingKnowledgeEntry>(
    "SELECT * FROM openviking_knowledge_entries WHERE knowledge_space_id = ? ORDER BY created_at DESC LIMIT 200",
    input.knowledgeSpaceId,
  );

  const queryTerms = normalizedQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const spaceIndex = buildRetrievalSpaceIndex(entries);

  return entries
    .map<KnowledgeRetrievalTestHit | null>((entry) => {
      const levels = retrievalLevelsForEntry(entry, normalizedQuery, queryTerms, spaceIndex);
      const score = levels.reduce((sum, level) => sum + level.score, 0);

      if (!score) return null;

      const bestLevel = [...levels].sort((left, right) => right.score - left.score)[0];

      return {
        id: entry.id,
        title: entry.title,
        vikingUri: entry.vikingUri,
        syncStatus: entry.syncStatus,
        layer: entry.layer,
        score,
        excerpt: bestLevel?.excerpt || buildExcerpt(entry.contentMd, normalizedQuery),
        levels,
      };
    })
    .filter((item): item is KnowledgeRetrievalTestHit => Boolean(item))
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit ?? 8);
}

export function listKnowledgeSkills() {
  return queryAll<InspectionSkill>(
    "SELECT * FROM inspection_skills WHERE is_enabled = 1 ORDER BY layer ASC, name ASC",
  );
}

export function updateKnowledgeSkill(
  skillId: string,
  input: Partial<{
    name: string;
    layer: string;
    description: string;
    isEnabled: boolean;
    promptMd: string;
    heuristics: Record<string, unknown>;
  }>,
) {
  const current = queryOne<InspectionSkill>("SELECT * FROM inspection_skills WHERE id = ?", skillId);
  if (!current) throw new Error(uiText("ui.generated.cd4fe99088a"));

  execute(
    "UPDATE inspection_skills SET name = ?, layer = ?, description = ?, is_enabled = ?, prompt_md = ?, heuristics_json = ?, updated_at = ? WHERE id = ?",
    input.name ?? current.name,
    input.layer ?? current.layer,
    input.description ?? current.description,
    input.isEnabled === undefined ? current.isEnabled : input.isEnabled ? 1 : 0,
    input.promptMd ?? current.promptMd,
    JSON.stringify(input.heuristics ?? JSON.parse(current.heuristicsJson)),
    new Date().toISOString(),
    skillId,
  );

  return queryOne<InspectionSkill>("SELECT * FROM inspection_skills WHERE id = ?", skillId);
}

export async function getOpenVikingHealth() {
  const setting = getKnowledgeBaseSettings();
  const baseUrl = getOpenVikingBaseUrl();
  if (!setting.enabled) {
    return {
      ok: false,
      baseUrl,
      body: null,
      error: "OpenViking knowledge base is disabled",
    };
  }
  try {
    const response = await fetch(`${baseUrl}/health`, { headers: getOpenVikingHeaders() });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    return {
      ok: response.ok,
      baseUrl,
      body,
      error: response.ok ? null : `${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      ok: false,
      baseUrl,
      body: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getOpenVikingTree(uri = "viking://resources/agentworld", maxDepth = 4) {
  const params = new URLSearchParams({ uri, max_depth: String(maxDepth) });
  return openVikingRequest<Array<Record<string, unknown>>>(`/api/v1/fs/tree?${params.toString()}`, {
    method: "GET",
  });
}

export async function readOpenVikingContent(uri: string, level: "L0" | "L1" | "L2" = "L2") {
  const endpoint = level === "L0" ? "abstract" : level === "L1" ? "overview" : "read";
  const params = new URLSearchParams({ uri });
  return openVikingRequest<string>(`/api/v1/content/${endpoint}?${params.toString()}`, {
    method: "GET",
  });
}

export async function syncInspectionSkillsToOpenViking() {
  const skills = queryAll<InspectionSkill>(
    "SELECT * FROM inspection_skills WHERE is_enabled = 1 ORDER BY layer ASC, name ASC",
  );

  const results = [];
  for (const skill of skills) {
    results.push(
      await writeLayeredKnowledge({
        layer: skill.layer,
        scopeKey: `skills/${skill.id}`,
        skillId: skill.id,
        title: `Inspection Skill: ${skill.name}`,
        sourceType: "skill",
        metadata: {
          skillId: skill.id,
          description: skill.description,
          heuristics: JSON.parse(skill.heuristicsJson),
        },
        contentMd: [
          skill.description,
          "",
          "## Prompt",
          skill.promptMd,
          "",
          "## Heuristics",
          "```json",
          JSON.stringify(JSON.parse(skill.heuristicsJson), null, 2),
          "```",
        ].join("\n"),
      }),
    );
  }

  return results;
}

export async function getKnowledgeManagementSnapshot() {
  const openVikingProcess = await import("@/server/openviking-process");
  const processStatus = await openVikingProcess.ensureOpenVikingServerStarted("knowledge-snapshot");
  const [health, layers, entries, spaces, bindings] = await Promise.all([
    getOpenVikingHealth(),
    Promise.resolve(listKnowledgeLayers()),
    Promise.resolve(listLayeredKnowledge(12)),
    Promise.resolve(queryAll<KnowledgeSpace>("SELECT * FROM knowledge_spaces ORDER BY name ASC")),
    Promise.resolve(queryAll<KnowledgeSpaceBinding>("SELECT * FROM knowledge_space_bindings ORDER BY load_order ASC, created_at ASC")),
  ]);
  const skills = listKnowledgeSkills();

  let tree: Array<Record<string, unknown>> = [];
  if (health.ok) {
    tree = await getOpenVikingTree().catch(() => []);
  }

  return {
    process: {
      ...openVikingProcess.getOpenVikingProcessStatus(),
      startup: processStatus,
    },
    health,
    layers,
    spaces,
    bindings,
    entries,
    skills,
    tree,
  };
}
