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
} from "@/server/db";
import { uiText } from "@/lib/language-pack";

const SHADOW_ROOT = path.join("data", "openviking-shadow");
const DEFAULT_OPENVIKING_BASE_URL = "http://127.0.0.1:1933";

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
};

type RemoteSyncResult = {
  status: string;
  error: string | null;
  response?: unknown;
};

type OpenVikingApiResult<T> = {
  status?: string;
  ok?: boolean;
  result?: T;
  error?: { code?: string; message?: string } | string | null;
};

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "default";
}

function getOpenVikingBaseUrl() {
  return (process.env.OPENVIKING_BASE_URL ?? DEFAULT_OPENVIKING_BASE_URL).replace(/\/+$/, "");
}

function getOpenVikingHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.OPENVIKING_API_KEY;
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (process.env.OPENVIKING_ACCOUNT) headers["X-OpenViking-Account"] = process.env.OPENVIKING_ACCOUNT;
  if (process.env.OPENVIKING_USER) headers["X-OpenViking-User"] = process.env.OPENVIKING_USER;

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

async function syncRemote(uri: string, contentMd: string): Promise<RemoteSyncResult> {
  const attempts = [
    { mode: "create", status: "remote_created" },
    { mode: "replace", status: "remote_replaced" },
  ];

  let lastError = "OpenViking remote sync failed";
  for (const attempt of attempts) {
    for (let retry = 0; retry < 4; retry += 1) {
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
          await delay(600 + retry * 400);
          continue;
        }

        if (attempt.mode === "create" && isAlreadyExistsError(message)) break;

        break;
      }
    }
  }

  return { status: "remote_failed_local_shadow", error: lastError };
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
    "INSERT INTO openviking_knowledge_entries (id, knowledge_space_id, layer, scope_key, skill_id, viking_uri, title, content_md, metadata_json, source_type, sync_status, sync_error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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

export async function upsertKnowledgeEntry(input: KnowledgeEntryInput) {
  const existing = input.id
    ? queryOne<OpenVikingKnowledgeEntry>("SELECT * FROM openviking_knowledge_entries WHERE id = ?", input.id)
    : null;
  const id = input.id || randomUUID();
  const createdAt = existing?.createdAt ?? new Date().toISOString();
  const knowledgeSpace = getKnowledgeSpace(input.knowledgeSpaceId);
  const vikingUri = buildVikingUri(input.layer, input.scopeKey, id, input.knowledgeSpaceId);
  const filePath = shadowFilePath(input.layer, input.scopeKey, id);
  const metadata = {
    ...parseMetadataJson(input.metadataJson),
    vikingUri,
    layer: input.layer,
    scopeKey: input.scopeKey,
    sourceType: input.sourceType,
    knowledgeSpaceId: knowledgeSpace?.id ?? null,
    knowledgeSpaceName: knowledgeSpace?.name ?? null,
    updatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, input.contentMd, "utf8");
  const syncResult = await syncRemote(vikingUri, input.contentMd);

  if (existing) {
    execute(
      "UPDATE openviking_knowledge_entries SET knowledge_space_id = ?, layer = ?, scope_key = ?, skill_id = ?, viking_uri = ?, title = ?, content_md = ?, metadata_json = ?, source_type = ?, sync_status = ?, sync_error = ? WHERE id = ?",
      knowledgeSpace?.id ?? null,
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
      id,
    );
  } else {
    execute(
      "INSERT INTO openviking_knowledge_entries (id, knowledge_space_id, layer, scope_key, skill_id, viking_uri, title, content_md, metadata_json, source_type, sync_status, sync_error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      knowledgeSpace?.id ?? null,
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
    );
  }

  return queryOne<OpenVikingKnowledgeEntry>("SELECT * FROM openviking_knowledge_entries WHERE id = ?", id);
}

export function deleteKnowledgeEntry(id: string) {
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
  const baseUrl = getOpenVikingBaseUrl();
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
