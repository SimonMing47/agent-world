import { createHash, randomUUID } from "node:crypto";
import { completeSimple, type AssistantMessage } from "@earendil-works/pi-ai";
import fs from "node:fs";
import path from "node:path";
import { normalizeKnowledgeUri, replaceLegacyKnowledgeUriText } from "@/lib/knowledge-uri";
import {
  execute,
  queryAll,
  queryOne,
  type InspectionSkill,
  type ProviderProfile,
  type KnowledgeLayer,
  type KnowledgeSpace,
  type KnowledgeSpaceBinding,
  type KnowledgeEntryRecord,
  type KnowledgeEntryVersionRecord,
} from "@/server/db";
import { uiText } from "@/lib/language-pack";
import {
  canWriteKnowledgeVlmConfig,
  getKnowledgeBaseSettings,
} from "@/server/knowledge-base-settings";
import { buildPiModel, resolveProviderApiKey } from "@/server/runtime-provider-config";
import {
  type KnowledgeCategory,
  normalizeKnowledgeCategories,
} from "@/lib/knowledge-categories";

const KNOWLEDGE_ROOT = path.join("data", "knowledge-engine");
const SHADOW_ROOT = path.join(KNOWLEDGE_ROOT, "shadow");
const LOCAL_INDEXED_STATUS = "local_indexed";
const KNOWLEDGE_FOUNDATION_VERSION = 1;
const KNOWLEDGE_FOUNDATION_L0_MAX = 2400;
const KNOWLEDGE_FOUNDATION_L1_MAX = 3600;
const SPACE_INDEX_L0_MAX = 12000;
const SPACE_INDEX_L1_MAX = 26000;
const KNOWLEDGE_FOUNDATION_TRUNCATE_SUFFIX = "...";

type KnowledgeFoundationMetadata = {
  v: number;
  source: "heuristic" | "model";
  model?: string;
  generatedAt: string;
  l0: string;
  l1: string;
  digest: string;
};

type KnowledgeFoundationModelDescriptor = {
  providerProfileId: string;
  providerLabel: string;
  model: ReturnType<typeof buildPiModel>;
  apiKey: string;
};

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

export type KnowledgeSearchLevel = "L0" | "L1" | "L2";

export type KnowledgeSearchHit = {
  id: string;
  title: string;
  vikingUri: string;
  syncStatus: string;
  layer: string;
  knowledgeSpaceId: string | null;
  knowledgeSpaceName: string | null;
  score: number;
  excerpt: string;
  bestLevel: KnowledgeSearchLevel;
  levels: KnowledgeRetrievalTestLevelHit[];
  outboundUris: string[];
  matchLevelCount: number;
};

export type KnowledgeSearchResult = {
  query: string;
  scope: {
    knowledgeSpaceIds: string[];
    scopeUris: string[];
    knowledgeCategories: string[];
    repositoryNames: string[];
  };
  totalEntries: number;
  totalCandidates: number;
  hits: KnowledgeSearchHit[];
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
    return `agentworld://knowledge/agent/knowledge/code-inspection/${safeLayer}`;
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

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function compactToLimit(value: string, maxChars: number) {
  if (value.length <= maxChars) return value.trim();
  if (maxChars <= KNOWLEDGE_FOUNDATION_TRUNCATE_SUFFIX.length) return value.slice(0, maxChars);
  return `${value.slice(0, maxChars - KNOWLEDGE_FOUNDATION_TRUNCATE_SUFFIX.length)}${KNOWLEDGE_FOUNDATION_TRUNCATE_SUFFIX}`;
}

function resolveKnowledgeFoundationModel() {
  const setting = getKnowledgeBaseSettings();
  if (!canWriteKnowledgeVlmConfig(setting)) return null;

  const profileById = setting.vlmProviderProfileId
    ? queryOne<ProviderProfile>(
        "SELECT * FROM provider_profiles WHERE id = ? AND is_enabled = 1",
        setting.vlmProviderProfileId,
      )
    : null;
  const profileByModel = !profileById && setting.vlmModel
    ? queryOne<ProviderProfile>(
        "SELECT * FROM provider_profiles WHERE is_enabled = 1 AND lower(default_model) = lower(?) ORDER BY updated_at DESC LIMIT 1",
        setting.vlmModel,
      )
    : null;
  const profileByName = !profileById && !profileByModel && setting.vlmProvider
    ? queryOne<ProviderProfile>(
        "SELECT * FROM provider_profiles WHERE is_enabled = 1 AND lower(name) = lower(?) ORDER BY updated_at DESC LIMIT 1",
        setting.vlmProvider,
      )
    : null;

  const providerProfile = profileById || profileByModel || profileByName;
  if (!providerProfile) return null;
  const apiKey = resolveProviderApiKey(providerProfile);
  if (!apiKey) return null;

  return {
    providerProfileId: providerProfile.id,
    providerLabel: `${providerProfile.name} · ${providerProfile.defaultModel}`,
    model: buildPiModel(providerProfile),
    apiKey,
  } satisfies KnowledgeFoundationModelDescriptor;
}

function readKnowledgeFoundationMetadata(metadataJson: string | undefined): KnowledgeFoundationMetadata | null {
  const parsed = parseMetadataJson(metadataJson);
  const candidate = asRecord(parsed.knowledgeFoundation);
  if (!candidate) return null;
  const source = candidate.source === "model" || candidate.source === "heuristic" ? candidate.source : "heuristic";
  const l0 = typeof candidate.l0 === "string" ? candidate.l0.trim() : "";
  const l1 = typeof candidate.l1 === "string" ? candidate.l1.trim() : "";
  if (!l0 || !l1) return null;

  return {
    v: typeof candidate.v === "number" && Number.isFinite(candidate.v) ? candidate.v : KNOWLEDGE_FOUNDATION_VERSION,
    source,
    model: typeof candidate.model === "string" ? candidate.model : undefined,
    generatedAt: typeof candidate.generatedAt === "string" ? candidate.generatedAt : new Date(0).toISOString(),
    l0,
    l1,
    digest: typeof candidate.digest === "string" ? candidate.digest : "",
  };
}

function isKnowledgeFoundationUpToDate(metadataJson: string | undefined, digest: string) {
  const foundation = readKnowledgeFoundationMetadata(metadataJson);
  return foundation && foundation.v >= KNOWLEDGE_FOUNDATION_VERSION && foundation.digest === digest && foundation.l0 && foundation.l1;
}

function buildKnowledgeFoundationDigest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildHeuristicKnowledgeFoundation({
  title,
  contentMd,
}: {
  title: string;
  contentMd: string;
}) {
  const plain = compactWhitespace(stripMarkdownForRetrieval(contentMd));
  const outline = markdownOutlineForRetrieval(contentMd);
  const source = compactWhitespace([`# ${title}`, outline || plain.slice(0, 3000)].filter(Boolean).join("\n"));
  return {
    source: "heuristic" as const,
    l0: compactToLimit(compactWhitespace([`# ${title}`, plain].filter(Boolean).join(" ")), KNOWLEDGE_FOUNDATION_L0_MAX),
    l1: compactToLimit(
      compactWhitespace(
        [
          `# ${title}`,
          outline ? `Sections: ${outline}` : null,
          `Content: ${source}`,
        ].filter(Boolean).join(" / "),
      ),
      KNOWLEDGE_FOUNDATION_L1_MAX,
    ),
  };
}

async function buildKnowledgeFoundation({
  title,
  contentMd,
  metadataContext,
}: {
  title: string;
  contentMd: string;
  metadataContext: string;
}) {
  const plain = compactWhitespace(stripMarkdownForRetrieval(contentMd));
  const fallback = buildHeuristicKnowledgeFoundation({ title, contentMd });
  const foundationDescriptor = resolveKnowledgeFoundationModel();
  if (!foundationDescriptor) {
    return {
      ...fallback,
      model: undefined,
      source: "heuristic" as const,
      generatedAt: new Date().toISOString(),
      digest: buildKnowledgeFoundationDigest(`${title}\n${contentMd}`),
    };
  }

  const modelPrompt = [
    "Build two retrieval layers for this knowledge entry.",
    "Return strict JSON only with keys l0 and l1.",
    `L0: concise abstract for quick recall with entities, tasks, and conclusions (<=${KNOWLEDGE_FOUNDATION_L0_MAX} chars).`,
    `L1: structural overview for navigation and reranking with sections, dependencies, and examples (<=${KNOWLEDGE_FOUNDATION_L1_MAX} chars).`,
    "Use Chinese if the source text is Chinese, otherwise use English.",
    "Do not include markdown, bullet symbols, or additional fields.",
    `Title: ${title}`,
    `Metadata: ${metadataContext}`,
    `Content:\n${plain}`,
  ];

  try {
    const response = await completeSimple(
      foundationDescriptor.model,
      {
        messages: [
          {
            role: "user",
            timestamp: Date.now(),
            content: modelPrompt.join("\n\n"),
          },
        ],
      },
      {
        apiKey: foundationDescriptor.apiKey,
        maxTokens: 1500,
        reasoning: "low",
      },
    );

    if (response.stopReason === "error") {
      throw new Error(response.errorMessage ?? uiText("ui.generated.cd4fe99088a"));
    }

    const flat = flattenVisibleText(response);
    const parsed = extractJsonObject<{ l0?: unknown; l1?: unknown }>(flat);
    const l0 = compactToLimit(typeof parsed?.l0 === "string" ? parsed.l0.trim() : "", KNOWLEDGE_FOUNDATION_L0_MAX);
    const l1 = compactToLimit(typeof parsed?.l1 === "string" ? parsed.l1.trim() : "", KNOWLEDGE_FOUNDATION_L1_MAX);
    if (l0 && l1) {
      return {
        source: "model" as const,
        model: foundationDescriptor.providerLabel,
        l0,
        l1,
        generatedAt: new Date().toISOString(),
        digest: buildKnowledgeFoundationDigest(`${title}\n${contentMd}`),
      };
    }
  } catch {}

  return {
    ...fallback,
    model: undefined,
    source: "heuristic" as const,
    generatedAt: new Date().toISOString(),
    digest: buildKnowledgeFoundationDigest(`${title}\n${contentMd}`),
  };
}

function flattenVisibleText(message: AssistantMessage | null | undefined) {
  if (!message?.content) return "";
  return (Array.isArray(message.content)
    ? message.content
        .map((chunk) => (chunk.type === "text" ? String(chunk.text ?? "") : ""))
        .join(" ")
    : String((message.content as { text?: string })?.text ?? message.content))
    .trim();
}

function extractJsonObject<T>(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(value.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
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
  const foundation = await buildKnowledgeFoundation({
    title: input.title,
    contentMd: input.contentMd,
    metadataContext: JSON.stringify(input.metadata ?? {}),
  });
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
    knowledgeFoundation: {
      ...foundation,
      v: KNOWLEDGE_FOUNDATION_VERSION,
    },
  };
  const content = [
    `# ${input.title}`,
    "",
    `- Layer: ${input.layer}`,
    `- Scope: ${input.scopeKey}`,
    `- Source: ${input.sourceType}`,
    input.skillId ? `- Knowledge: ${input.skillId}` : null,
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
  try {
    return asRecord(JSON.parse(value)) ?? {};
  } catch {
    return {};
  }
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
  const existingFoundation = readKnowledgeFoundationMetadata(existing?.metadataJson);
  const currentDigest = buildKnowledgeFoundationDigest(`${input.title}\n${input.contentMd}`);
  const shouldRebuildFoundation =
    !existing || !isKnowledgeFoundationUpToDate(existing.metadataJson, currentDigest) || existingFoundation?.l0 == null || existingFoundation?.l1 == null;
  const foundation = shouldRebuildFoundation
    ? await buildKnowledgeFoundation({
        title: input.title,
        contentMd: input.contentMd,
        metadataContext: JSON.stringify(parseMetadataJson(input.metadataJson)),
      })
    : null;
  const existingFoundationForReuse = existingFoundation && !shouldRebuildFoundation ? existingFoundation : null;

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
    knowledgeFoundation: (shouldRebuildFoundation ? foundation : existingFoundationForReuse) ?? {
      ...buildHeuristicKnowledgeFoundation({ title: input.title, contentMd: input.contentMd }),
      source: "heuristic" as const,
      model: undefined,
      generatedAt: new Date().toISOString(),
      digest: currentDigest,
      v: KNOWLEDGE_FOUNDATION_VERSION,
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
  const l0Lines: string[] = [];
  const l1Lines: string[] = [];
  for (const entry of notes) {
    const plainContent = compactWhitespace(stripMarkdownForRetrieval(entry.contentMd));
    const foundation = readKnowledgeFoundationMetadata(entry.metadataJson);
    const l0 = compactToLimit(
      compactWhitespace([`# ${entry.title}`, foundation?.l0 || plainContent].filter(Boolean).join(" | ")),
      KNOWLEDGE_FOUNDATION_L0_MAX,
    );
    const outline = markdownOutlineForRetrieval(entry.contentMd);
    const l1 = compactToLimit(
      compactWhitespace(
        [
          `# ${entry.title}`,
          outline || foundation?.l1 || plainContent,
          foundation ? `Foundation source: ${foundation.source}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
      ),
      KNOWLEDGE_FOUNDATION_L1_MAX,
    );
    l0Lines.push(l0);
    l1Lines.push(l1);
  }
  return {
    l0Text: compactWhitespace(l0Lines.join("\n")).slice(0, SPACE_INDEX_L0_MAX),
    l1Text: compactWhitespace(l1Lines.join("\n")).slice(0, SPACE_INDEX_L1_MAX),
  };
}

function outlineForContent(title: string, content: string) {
  const outline = markdownOutlineForRetrieval(content);
  const plain = compactWhitespace(stripMarkdownForRetrieval(content));
  return compactToLimit([`## ${title}`, outline || plain].filter(Boolean).join("\n"), KNOWLEDGE_FOUNDATION_L1_MAX);
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

function parseKnowledgeSearchScopes(args: {
  knowledgeSpaceIds?: string[];
  scopeUris?: string[];
  knowledgeCategories?: string[];
  repositoryNames?: string[];
}) {
  const knowledgeSpaceIds = [...new Set((args.knowledgeSpaceIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const scopeUris = [...new Set((args.scopeUris ?? []).map((uri) => normalizeUriForCompare(uri)).filter(Boolean))];
  const knowledgeCategories = normalizeKnowledgeCategories(args.knowledgeCategories) as KnowledgeCategory[];
  const repositoryNames = [...new Set(
    (args.repositoryNames ?? [])
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )];
  return { knowledgeSpaceIds, scopeUris, knowledgeCategories, repositoryNames };
}

function filterKnowledgeEntriesForScopes(input: {
  knowledgeSpaceIds: string[];
  scopeUris: string[];
  knowledgeCategories: string[];
  repositoryNames: string[];
  limit?: number;
}) {
  const allEntries = queryAll<KnowledgeEntryRecord>(
    "SELECT * FROM knowledge_entries ORDER BY updated_at DESC, created_at DESC",
  ).map(normalizeKnowledgeEntryRecord);

  if (
    !input.knowledgeSpaceIds.length &&
    !input.scopeUris.length &&
    !input.knowledgeCategories.length &&
    !input.repositoryNames.length
  ) {
    return input.limit ? allEntries.slice(0, input.limit) : allEntries;
  }

  const spaceFilter = new Set(input.knowledgeSpaceIds.filter(Boolean));
  const uriFilter = new Set(input.scopeUris);
  const categoryFilter = new Set(input.knowledgeCategories);
  const repositoryNameFilter = new Set(input.repositoryNames);
  const knowledgeSpaceById = new Map(
    queryAll<{ id: string; knowledge_category: string; repository_name: string | null }>(
      "SELECT id, knowledge_category, repository_name FROM knowledge_spaces",
    ).map((space) => [space.id, space]),
  );

  const matched = allEntries.filter((entry) => {
    const bySpace = spaceFilter.size > 0 && entry.knowledgeSpaceId ? spaceFilter.has(entry.knowledgeSpaceId) : false;
    const byUri = uriFilter.size > 0
      ? [...uriFilter].some((scopeUri) => entryMatchesUri(entry, scopeUri))
      : false;

    const bySpaceFilters = spaceFilter.size || uriFilter.size;
    const byScope = bySpaceFilters ? bySpace || byUri : true;
    if (!byScope) return false;

    if (!categoryFilter.size && !repositoryNameFilter.size) return byScope;
    if (!entry.knowledgeSpaceId) return false;

    const space = knowledgeSpaceById.get(entry.knowledgeSpaceId);
    if (!space) return false;

    const normalizedSpaceCategory = normalizeKnowledgeCategories(space.knowledge_category);
    if (categoryFilter.size > 0 && (!normalizedSpaceCategory[0] || !categoryFilter.has(normalizedSpaceCategory[0]))) {
      return false;
    }
    if (repositoryNameFilter.size > 0) {
      const repositoryName = space.repository_name?.trim().toLowerCase() || "";
      if (!repositoryNameFilter.has(repositoryName)) return false;
    }

    return true;
  });

  if (input.limit) return matched.slice(0, input.limit);
  return matched;
}

function parseKnowledgeSearchLevels(levels?: KnowledgeSearchLevel[]) {
  const valid = new Set<KnowledgeSearchLevel>();
  if (!Array.isArray(levels) || levels.length === 0) {
    return new Set<KnowledgeSearchLevel>(["L0", "L1", "L2"]);
  }
  for (const level of levels) {
    if (level === "L0" || level === "L1" || level === "L2") {
      valid.add(level);
    }
  }
  return valid.size ? valid : new Set<KnowledgeSearchLevel>(["L0", "L1", "L2"]);
}

function extractOutboundKnowledgeUris(contentMd: string) {
  const matches = [...contentMd.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)];
  const outbound = new Set<string>();
  for (const match of matches) {
    const raw = typeof match[1] === "string" ? match[1].trim() : "";
    if (!raw || raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("mailto:")) {
      continue;
    }
    const normalized = normalizeKnowledgeUri(raw);
    if (!normalized) continue;
    if (normalized === "agentworld://knowledge") continue;
    outbound.add(normalized);
  }
  return [...outbound];
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
  const foundation = readKnowledgeFoundationMetadata(entry.metadataJson);
  if (level === "L0") {
    const fallback = compactToLimit(compactWhitespace(stripMarkdownForRetrieval(entry.contentMd)), KNOWLEDGE_FOUNDATION_L0_MAX);
    return compactToLimit([`# ${entry.title}`, "", foundation?.l0 ?? fallback].join("\n"), KNOWLEDGE_FOUNDATION_L0_MAX * 2);
  }
  const fallback = outlineForContent(entry.title, entry.contentMd);
  return compactToLimit([`# ${entry.title}`, "", foundation?.l1 ?? fallback, "", "## Metadata", entry.metadataJson].join("\n"), KNOWLEDGE_FOUNDATION_L1_MAX * 2);
}

function readAggregateLevel(uri: string, entries: KnowledgeEntryRecord[], level: "L0" | "L1" | "L2") {
  const title = aggregateTitleFromUri(uri);
  if (!entries.length) return `# ${title}\n\nNo local knowledge entries found.`;
  if (level === "L0") {
    return [
      `# ${title}`,
      "",
      ...entries.slice(0, 20).map((entry) => {
        const plain = compactToLimit(compactWhitespace(stripMarkdownForRetrieval(entry.contentMd)), KNOWLEDGE_FOUNDATION_L0_MAX);
        const foundation = readKnowledgeFoundationMetadata(entry.metadataJson);
        return `- ${entry.title}: ${foundation?.l0 ?? plain}`;
      }),
    ].join("\n").slice(0, SPACE_INDEX_L0_MAX);
  }
  if (level === "L1") {
    return [
      `# ${title}`,
      "",
      ...entries.slice(0, 30).map((entry) => {
        const foundation = readKnowledgeFoundationMetadata(entry.metadataJson);
        return compactToLimit(foundation?.l1 ?? outlineForContent(entry.title, entry.contentMd), KNOWLEDGE_FOUNDATION_L1_MAX);
      }),
    ].join("\n\n").slice(0, SPACE_INDEX_L1_MAX);
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
  const plainContent = compactWhitespace(stripMarkdownForRetrieval(entry.contentMd));
  const foundation = readKnowledgeFoundationMetadata(entry.metadataJson);
  const entryL0 = compactToLimit(
    compactWhitespace([entry.title, foundation?.l0 || plainContent].join(" | ")),
    KNOWLEDGE_FOUNDATION_L0_MAX,
  );
  const entryL1 = compactToLimit(
    compactWhitespace([entry.title, foundation?.l1 || outlineForContent(entry.title, entry.contentMd)].join(" | ")),
    KNOWLEDGE_FOUNDATION_L1_MAX,
  );
  const l0Text = compactToLimit(`${entryL0}\n\n${spaceIndex.l0Text}`, SPACE_INDEX_L0_MAX);
  const l1Text = compactToLimit(`${entryL1}\n\n${spaceIndex.l1Text}`, SPACE_INDEX_L1_MAX);
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

export function searchKnowledgeEntries(input: {
  query: string;
  knowledgeSpaceIds?: string[];
  scopeUris?: string[];
  knowledgeCategories?: string[];
  repositoryNames?: string[];
  limit?: number;
  levels?: KnowledgeSearchLevel[];
  includeOutboundUris?: boolean;
}): KnowledgeSearchResult {
  const normalizedQuery = compactWhitespace(input.query);
  if (!normalizedQuery) {
    return {
      query: "",
      scope: { knowledgeSpaceIds: [], scopeUris: [], knowledgeCategories: [], repositoryNames: [] },
      totalEntries: 0,
      totalCandidates: 0,
      hits: [],
    };
  }

  const { knowledgeSpaceIds, scopeUris, knowledgeCategories, repositoryNames } = parseKnowledgeSearchScopes({
    knowledgeSpaceIds: input.knowledgeSpaceIds,
    scopeUris: input.scopeUris,
    knowledgeCategories: input.knowledgeCategories,
    repositoryNames: input.repositoryNames,
  });

  const entries = filterKnowledgeEntriesForScopes({
    knowledgeSpaceIds,
    scopeUris,
    knowledgeCategories,
    repositoryNames,
    limit: 300,
  });
  const queryTerms = normalizedQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const spaceIndex = buildRetrievalSpaceIndex(entries);
  const levelFilter = parseKnowledgeSearchLevels(input.levels);
  const knowledgeSpaceNameById = new Map(
    queryAll<{ id: string; name: string }>("SELECT id, name FROM knowledge_spaces").map((space) => [
      space.id,
      space.name,
    ]),
  );

  const sortedHits = entries
    .map<KnowledgeSearchResult["hits"][number] | null>((entry) => {
      const allLevels = retrievalLevelsForEntry(entry, normalizedQuery, queryTerms, spaceIndex);
      const filteredLevels = allLevels.filter((level) => levelFilter.has(level.level));
      const score = filteredLevels.reduce((sum, level) => sum + level.score, 0);
      if (!score) return null;
      const best = [...filteredLevels].sort((left, right) => right.score - left.score)[0] ?? filteredLevels[0];
      if (!best) return null;

      return {
        id: entry.id,
        title: entry.title,
        vikingUri: entry.vikingUri,
        syncStatus: entry.syncStatus,
        layer: entry.layer,
        knowledgeSpaceId: entry.knowledgeSpaceId,
        knowledgeSpaceName: entry.knowledgeSpaceId
          ? knowledgeSpaceNameById.get(entry.knowledgeSpaceId) ?? null
          : null,
        score,
        excerpt: best?.excerpt || buildExcerpt(entry.contentMd, normalizedQuery),
        bestLevel: best.level,
        levels: filteredLevels,
        outboundUris: input.includeOutboundUris ? extractOutboundKnowledgeUris(entry.contentMd).slice(0, 12) : [],
        matchLevelCount: filteredLevels.length,
      };
    })
    .filter((item): item is KnowledgeSearchResult["hits"][number] => Boolean(item))
    .sort((left, right) => right.score - left.score);

  const hits = sortedHits.slice(0, input.limit ?? 8);

  return {
    query: normalizedQuery,
    scope: {
      knowledgeSpaceIds,
      scopeUris,
      knowledgeCategories,
      repositoryNames,
    },
    totalEntries: entries.length,
    totalCandidates: sortedHits.length,
    hits,
  };
}

export function runKnowledgeRetrievalTest(input: {
  knowledgeSpaceId: string;
  query: string;
  limit?: number;
}) {
  const search = searchKnowledgeEntries({
    query: input.query,
    knowledgeSpaceIds: [input.knowledgeSpaceId],
    limit: input.limit,
    includeOutboundUris: false,
  });

  return search.hits.map<KnowledgeRetrievalTestHit>((hit) => ({
    id: hit.id,
    title: hit.title,
    vikingUri: hit.vikingUri,
    syncStatus: hit.syncStatus,
    layer: hit.layer,
    score: hit.score,
    excerpt: hit.excerpt,
    levels: hit.levels,
  }));
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
      capabilities: ["L0", "L1", "L2", "tree", "retrieval", "versioning", "mutable-source", "knowledge-sync", "local-shadow"],
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
        scopeKey: `knowledge/${skill.id}`,
        skillId: skill.id,
        title: `Inspection Knowledge: ${skill.name}`,
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
