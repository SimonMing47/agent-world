import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { normalizeKnowledgeUri, replaceLegacyKnowledgeUriText } from "@/lib/knowledge-uri";
import {
  execute,
  queryAll,
  queryOne,
  type InspectionSkill,
  type KnowledgeLayer,
  type KnowledgeSpace,
  type KnowledgeSpaceBinding,
  type KnowledgeEntryRecord,
  type KnowledgeEntryVersionRecord,
} from "@/server/db";
import { uiText } from "@/lib/language-pack";
import { getKnowledgeBaseSettings } from "@/server/knowledge-base-settings";

const KNOWLEDGE_ROOT = path.join("data", "knowledge-engine");
const SHADOW_ROOT = path.join(KNOWLEDGE_ROOT, "shadow");
const LOCAL_INDEXED_STATUS = "local_indexed";

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

type LocalIndexResult = {
  status: string;
  error: string | null;
  response?: unknown;
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

export class KnowledgeEntryConflictError extends Error {
  currentEntry: KnowledgeEntryRecord | null;

  constructor(currentEntry: KnowledgeEntryRecord | null) {
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

function layerFallback(layer: string) {
  const safeLayer = slugify(layer);
  if (layer.startsWith("feedback/")) {
    return `agentworld://knowledge/user/memories/code-inspection/${safeLayer}`;
  }
  if (["security", "quality/test", "data-interface"].includes(layer)) {
    return `agentworld://knowledge/agent/skills/code-inspection/${safeLayer}`;
  }

  return `agentworld://knowledge/resources/code-inspection/${safeLayer}`;
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

function buildKnowledgeUri(layer: string, scopeKey: string, id: string, knowledgeSpaceId?: string | null) {
  const root = getKnowledgeSpace(knowledgeSpaceId)?.vikingUri ?? getLayer(layer)?.vikingUri ?? layerFallback(layer);
  return `${normalizeKnowledgeUri(root)}/${slugify(scopeKey)}/${id}.md`;
}

function normalizeKnowledgeLayerRecord<T extends KnowledgeLayer>(layer: T): T {
  return {
    ...layer,
    vikingUri: normalizeKnowledgeUri(layer.vikingUri),
    parentUri: layer.parentUri ? normalizeKnowledgeUri(layer.parentUri) : null,
    retentionPolicyJson: replaceLegacyKnowledgeUriText(layer.retentionPolicyJson),
  };
}

function normalizeKnowledgeEntryRecord<T extends KnowledgeEntryRecord>(entry: T): T {
  return {
    ...entry,
    vikingUri: normalizeKnowledgeUri(entry.vikingUri),
    contentMd: replaceLegacyKnowledgeUriText(entry.contentMd),
    metadataJson: replaceLegacyKnowledgeUriText(entry.metadataJson),
  };
}

function shadowFilePath(layer: string, scopeKey: string, id: string) {
  return path.join(SHADOW_ROOT, slugify(layer), slugify(scopeKey), `${id}.md`);
}

async function indexLocalKnowledge(uri: string, contentMd: string): Promise<LocalIndexResult> {
  if (!getKnowledgeBaseSettings().enabled) {
    return { status: "local_disabled", error: "Knowledge engine is disabled" };
  }
  return {
    status: LOCAL_INDEXED_STATUS,
    error: null,
    response: {
      uri,
      bytes: Buffer.byteLength(contentMd, "utf8"),
      indexedAt: new Date().toISOString(),
    },
  };
}

function updateKnowledgeEntrySyncState(id: string, syncResult: LocalIndexResult) {
  execute(
    "UPDATE knowledge_entries SET sync_status = ?, sync_error = ? WHERE id = ?",
    syncResult.status,
    syncResult.error,
    id,
  );
}

export async function retryPendingKnowledgeSyncs(limit = 5) {
  const entries = queryAll<KnowledgeEntryRecord>(
    "SELECT * FROM knowledge_entries WHERE sync_status <> ? ORDER BY updated_at ASC LIMIT ?",
    LOCAL_INDEXED_STATUS,
    limit,
  );

  for (const entry of entries) {
    updateKnowledgeEntrySyncState(entry.id, await indexLocalKnowledge(entry.vikingUri, entry.contentMd));
  }

  return entries.length;
}

export async function writeLayeredKnowledge(input: KnowledgeInput) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const layer = getLayer(input.layer);
  const knowledgeSpace = getKnowledgeSpace(input.knowledgeSpaceId);
  const vikingUri = buildKnowledgeUri(input.layer, input.scopeKey, id, input.knowledgeSpaceId);
  const filePath = shadowFilePath(input.layer, input.scopeKey, id);
  const metadata: Record<string, unknown> = {
    ...input.metadata,
    vikingUri,
    layer: input.layer,
    scopeKey: input.scopeKey,
    sourceType: input.sourceType,
    knowledgeScope: layer?.scope ?? null,
    knowledgeLayerRoot: layer?.vikingUri ? normalizeKnowledgeUri(layer.vikingUri) : null,
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
    `- Knowledge URI: ${vikingUri}`,
    "",
    input.contentMd,
  ]
    .filter(Boolean)
    .join("\n");

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");

  const syncResult = await indexLocalKnowledge(vikingUri, content);
  metadata.sourceMutationPolicy = "mutable_versioned";
  metadata.knowledgeLifecycle = {
    sourceMutability: "mutable_versioned",
    previousRevision: null,
    currentRevision: 1,
    indexStatus: syncResult.status,
    saveReason: null,
  };

  execute(
    "INSERT INTO knowledge_entries (id, knowledge_space_id, layer, scope_key, skill_id, viking_uri, title, content_md, metadata_json, source_type, sync_status, sync_error, created_at, updated_at, updated_by, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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

function knowledgeEntryChanged(existing: KnowledgeEntryRecord, input: KnowledgeEntryInput, knowledgeSpaceId: string | null) {
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

function createKnowledgeEntryVersion(entry: KnowledgeEntryRecord, createdBy?: string | null) {
  execute(
    "INSERT OR IGNORE INTO knowledge_entry_versions (id, entry_id, revision, knowledge_space_id, layer, scope_key, skill_id, viking_uri, title, content_md, metadata_json, source_type, sync_status, sync_error, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
    "DELETE FROM knowledge_entry_versions WHERE entry_id = ? AND id NOT IN (SELECT id FROM knowledge_entry_versions WHERE entry_id = ? ORDER BY revision DESC, created_at DESC LIMIT 3)",
    entry.id,
    entry.id,
  );
}

export async function upsertKnowledgeEntry(input: KnowledgeEntryInput) {
  const existing = input.id
    ? queryOne<KnowledgeEntryRecord>("SELECT * FROM knowledge_entries WHERE id = ?", input.id)
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

  const vikingUri = buildKnowledgeUri(input.layer, input.scopeKey, id, input.knowledgeSpaceId);
  const filePath = shadowFilePath(input.layer, input.scopeKey, id);
  const nextRevision = existing ? existing.revision + 1 : 1;
  if (existing) createKnowledgeEntryVersion(existing, input.updatedBy);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, input.contentMd, "utf8");
  const syncResult = await indexLocalKnowledge(vikingUri, input.contentMd);
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
    sourceMutationPolicy: "mutable_versioned",
    knowledgeLifecycle: {
      sourceMutability: "mutable_versioned",
      previousRevision: existing?.revision ?? null,
      currentRevision: nextRevision,
      indexStatus: syncResult.status,
      saveReason: input.saveReason ?? null,
    },
  };

  if (existing) {
    execute(
      "UPDATE knowledge_entries SET knowledge_space_id = ?, layer = ?, scope_key = ?, skill_id = ?, viking_uri = ?, title = ?, content_md = ?, metadata_json = ?, source_type = ?, sync_status = ?, sync_error = ?, updated_at = ?, updated_by = ?, revision = ? WHERE id = ?",
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
      "INSERT INTO knowledge_entries (id, knowledge_space_id, layer, scope_key, skill_id, viking_uri, title, content_md, metadata_json, source_type, sync_status, sync_error, created_at, updated_at, updated_by, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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

  return queryOne<KnowledgeEntryRecord>("SELECT * FROM knowledge_entries WHERE id = ?", id);
}

export function listKnowledgeEntryVersions(entryId: string) {
  return queryAll<KnowledgeEntryVersionRecord>(
    "SELECT * FROM knowledge_entry_versions WHERE entry_id = ? ORDER BY revision DESC, created_at DESC LIMIT 3",
    entryId,
  );
}

export function getKnowledgeEntry(id: string) {
  return queryOne<KnowledgeEntryRecord>("SELECT * FROM knowledge_entries WHERE id = ?", id);
}

export function getKnowledgeEntryVersion(entryId: string, versionId: string) {
  return queryOne<KnowledgeEntryVersionRecord>(
    "SELECT * FROM knowledge_entry_versions WHERE entry_id = ? AND id = ?",
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
  execute("DELETE FROM knowledge_entry_versions WHERE entry_id = ?", id);
  execute("DELETE FROM knowledge_entries WHERE id = ?", id);
  return { ok: true };
}

export function listKnowledgeLayers() {
  return queryAll<KnowledgeLayer>(
    "SELECT * FROM knowledge_layers WHERE is_enabled = 1 ORDER BY load_order ASC",
  ).map(normalizeKnowledgeLayerRecord);
}

export function listLayeredKnowledge(limit = 50) {
  return queryAll<KnowledgeEntryRecord>(
    "SELECT * FROM knowledge_entries ORDER BY created_at DESC LIMIT ?",
    limit,
  ).map(normalizeKnowledgeEntryRecord);
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeUriForCompare(uri: string) {
  return normalizeKnowledgeUri(uri).replace(/\/+$/, "");
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

function buildRetrievalSpaceIndex(entries: KnowledgeEntryRecord[]) {
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

function outlineForContent(title: string, content: string) {
  const outline = markdownOutlineForRetrieval(content);
  const plain = compactWhitespace(stripMarkdownForRetrieval(content));
  return [`## ${title}`, outline || plain.slice(0, 1000)].filter(Boolean).join("\n");
}

function aggregateTitleFromUri(uri: string) {
  const normalized = normalizeUriForCompare(uri);
  const segments = normalized.split("/").filter(Boolean);
  return segments.at(-1)?.replace(/[-_]+/g, " ") || "Knowledge";
}

function entryMatchesUri(entry: KnowledgeEntryRecord, uri: string) {
  const target = normalizeUriForCompare(uri);
  const entryUri = normalizeUriForCompare(entry.vikingUri);
  return entryUri === target || entryUri.startsWith(`${target}/`);
}

function entriesForUri(uri: string) {
  const entries = queryAll<KnowledgeEntryRecord>(
    "SELECT * FROM knowledge_entries ORDER BY updated_at DESC, created_at DESC",
  ).map(normalizeKnowledgeEntryRecord);
  const normalized = normalizeUriForCompare(uri);
  return entries.filter((entry) => entryMatchesUri(entry, normalized));
}

function exactEntryForUri(uri: string) {
  const normalized = normalizeUriForCompare(uri);
  return queryAll<KnowledgeEntryRecord>("SELECT * FROM knowledge_entries")
    .map(normalizeKnowledgeEntryRecord)
    .find((entry) => normalizeUriForCompare(entry.vikingUri) === normalized) ?? null;
}

function readEntryLevel(entry: KnowledgeEntryRecord, level: "L0" | "L1" | "L2") {
  if (level === "L2") return entry.contentMd;
  const plain = compactWhitespace(stripMarkdownForRetrieval(entry.contentMd));
  if (level === "L0") {
    return [`# ${entry.title}`, "", plain.slice(0, 700)].join("\n");
  }
  return [`# ${entry.title}`, "", outlineForContent(entry.title, entry.contentMd), "", "## Metadata", entry.metadataJson].join("\n");
}

function readAggregateLevel(uri: string, entries: KnowledgeEntryRecord[], level: "L0" | "L1" | "L2") {
  const title = aggregateTitleFromUri(uri);
  if (!entries.length) return `# ${title}\n\nNo local knowledge entries found.`;
  if (level === "L0") {
    return [
      `# ${title}`,
      "",
      ...entries.slice(0, 20).map((entry) => {
        const plain = compactWhitespace(stripMarkdownForRetrieval(entry.contentMd));
        return `- ${entry.title}: ${plain.slice(0, 180)}`;
      }),
    ].join("\n");
  }
  if (level === "L1") {
    return [
      `# ${title}`,
      "",
      ...entries.slice(0, 30).map((entry) => outlineForContent(entry.title, entry.contentMd)),
    ].join("\n\n");
  }
  return [
    `# ${title}`,
    "",
    ...entries.map((entry) => [`## ${entry.title}`, entry.contentMd].join("\n\n")),
  ].join("\n\n");
}

function retrievalLevelsForEntry(
  entry: KnowledgeEntryRecord,
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
      label: uiText("ui.server.knowledgeEngine.retrievalLevels.l0.label", "Space abstract index recall"),
      purpose: uiText(
        "ui.server.knowledgeEngine.retrievalLevels.l0.purpose",
        "Abstract: one global knowledge-space summary for vector recall, quick filtering, and space-level list awareness.",
      ),
      score: scoreTerms(entry.title, queryTerms, 6) + scoreTerms(l0Text, queryTerms, 1),
      excerpt: buildExcerpt(l0Text, query),
      editable: false,
    },
    {
      level: "L1",
      label: uiText("ui.server.knowledgeEngine.retrievalLevels.l1.label", "Space overview index rerank"),
      purpose: uiText(
        "ui.server.knowledgeEngine.retrievalLevels.l1.purpose",
        "Overview: one global knowledge-space overview for understanding space structure, recursive directories, and reranking refinement.",
      ),
      score: scoreTerms(entry.title, queryTerms, 4) + scoreTerms(l1Text, queryTerms, 2),
      excerpt: buildExcerpt(l1Text, query),
      editable: false,
    },
    {
      level: "L2",
      label: uiText("ui.server.knowledgeEngine.retrievalLevels.l2.label", "Original knowledge read"),
      purpose: uiText(
        "ui.server.knowledgeEngine.retrievalLevels.l2.purpose",
        "Details: versioned mutable Markdown source, read on demand and editable.",
      ),
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

  const entries = queryAll<KnowledgeEntryRecord>(
    "SELECT * FROM knowledge_entries WHERE knowledge_space_id = ? ORDER BY created_at DESC LIMIT 200",
    input.knowledgeSpaceId,
  ).map(normalizeKnowledgeEntryRecord);

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

export async function getKnowledgeEngineHealth() {
  const setting = getKnowledgeBaseSettings();
  if (!setting.enabled) {
    return {
      ok: false,
      baseUrl: "local://agentworld-knowledge",
      body: null,
      error: "Knowledge engine is disabled",
    };
  }
  const entryCount = queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM knowledge_entries")?.count ?? 0;
  const spaceCount = queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM knowledge_spaces WHERE status <> 'deleted'")?.count ?? 0;
  return {
    ok: true,
    baseUrl: "local://agentworld-knowledge",
    body: {
      status: "ok",
      healthy: true,
      provider: "agentworld-native",
      capabilities: ["L0", "L1", "L2", "tree", "retrieval", "versioning", "mutable-source", "skill-sync", "local-shadow"],
      spaces: spaceCount,
      entries: entryCount,
    },
    error: null,
  };
}

export async function getKnowledgeEngineTree(uri = "agentworld://knowledge/resources", maxDepth = 4) {
  const rootUri = normalizeUriForCompare(uri);
  const entries = entriesForUri(rootUri);
  const nodes = new Map<string, { uri: string; name: string; type: "directory" | "file"; depth: number; children: string[] }>();

  function ensureNode(nodeUri: string, type: "directory" | "file") {
    const normalized = normalizeUriForCompare(nodeUri);
    const existing = nodes.get(normalized);
    if (existing) {
      if (type === "file") existing.type = "file";
      return existing;
    }
    const relative = normalized.slice(rootUri.length).replace(/^\/+/, "");
    const depth = relative ? relative.split("/").length : 0;
    const name = relative ? relative.split("/").at(-1) ?? normalized : aggregateTitleFromUri(rootUri);
    const node = { uri: normalized, name, type, depth, children: [] as string[] };
    nodes.set(normalized, node);
    return node;
  }

  ensureNode(rootUri, "directory");
  for (const entry of entries) {
    const normalizedEntryUri = normalizeUriForCompare(entry.vikingUri);
    const relative = normalizedEntryUri.slice(rootUri.length).replace(/^\/+/, "");
    if (!relative) continue;
    const segments = relative.split("/");
    let parentUri = rootUri;
    for (let index = 0; index < segments.length; index += 1) {
      const currentUri = `${parentUri}/${segments[index]}`;
      const isFile = index === segments.length - 1;
      const current = ensureNode(currentUri, isFile ? "file" : "directory");
      const parent = ensureNode(parentUri, "directory");
      if (!parent.children.includes(current.uri)) parent.children.push(current.uri);
      parentUri = currentUri;
    }
  }

  return Array.from(nodes.values())
    .filter((node) => node.depth <= maxDepth)
    .sort((left, right) => left.uri.localeCompare(right.uri))
    .map((node) => ({
      uri: node.uri,
      name: node.name,
      type: node.type,
      depth: node.depth,
      children: node.children,
    }));
}

export async function readKnowledgeContent(uri: string, level: "L0" | "L1" | "L2" = "L2") {
  const normalizedUri = normalizeUriForCompare(uri);
  const entry = exactEntryForUri(normalizedUri);
  if (entry) return readEntryLevel(entry, level);
  return readAggregateLevel(normalizedUri, entriesForUri(normalizedUri), level);
}

export async function syncInspectionSkillsToKnowledgeEngine() {
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
  const knowledgeEngineProcess = await import("@/server/knowledge-engine-process");
  const processStatus = await knowledgeEngineProcess.ensureKnowledgeEngineStarted("knowledge-snapshot");
  const [health, layers, entries, spaces, bindings] = await Promise.all([
    getKnowledgeEngineHealth(),
    Promise.resolve(listKnowledgeLayers()),
    Promise.resolve(listLayeredKnowledge(12)),
    Promise.resolve(queryAll<KnowledgeSpace>("SELECT * FROM knowledge_spaces ORDER BY name ASC")),
    Promise.resolve(queryAll<KnowledgeSpaceBinding>("SELECT * FROM knowledge_space_bindings ORDER BY load_order ASC, created_at ASC")),
  ]);
  const skills = listKnowledgeSkills();

  let tree: Array<Record<string, unknown>> = [];
  if (health.ok) {
    tree = await getKnowledgeEngineTree().catch(() => []);
  }

  return {
    process: {
      ...knowledgeEngineProcess.getKnowledgeEngineProcessStatus(),
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
