import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  execute,
  queryAll,
  queryOne,
  type CodeReviewSkill,
  type KnowledgeLayer,
  type OpenVikingKnowledgeEntry,
} from "@/server/db";

const SHADOW_ROOT = path.join(process.cwd(), "data", "openviking-shadow");
const DEFAULT_OPENVIKING_BASE_URL = "http://127.0.0.1:1933";

type KnowledgeInput = {
  layer: string;
  scopeKey: string;
  title: string;
  contentMd: string;
  metadata?: Record<string, unknown>;
  sourceType: "review_context" | "review_finding" | "review_feedback" | "skill" | "manual";
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

  return headers;
}

function layerFallback(layer: string) {
  const safeLayer = slugify(layer);
  if (layer.startsWith("feedback/")) {
    return `viking://user/memories/agentworld/code-review/${safeLayer}`;
  }
  if (["security", "quality/test", "data-interface"].includes(layer)) {
    return `viking://agent/skills/agentworld/code-review/${safeLayer}`;
  }

  return `viking://resources/agentworld/code-review/${safeLayer}`;
}

function getLayer(layerKey: string) {
  return queryOne<KnowledgeLayer>(
    "SELECT * FROM knowledge_layers WHERE layer_key = ? AND is_enabled = 1",
    layerKey,
  );
}

function buildVikingUri(layer: string, scopeKey: string, id: string) {
  const root = getLayer(layer)?.vikingUri ?? layerFallback(layer);
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
  const vikingUri = buildVikingUri(input.layer, input.scopeKey, id);
  const filePath = shadowFilePath(input.layer, input.scopeKey, id);
  const metadata = {
    ...input.metadata,
    vikingUri,
    layer: input.layer,
    scopeKey: input.scopeKey,
    sourceType: input.sourceType,
    openVikingScope: layer?.scope ?? null,
    openVikingLayerRoot: layer?.vikingUri ?? null,
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
    "INSERT INTO openviking_knowledge_entries (id, layer, scope_key, skill_id, viking_uri, title, content_md, metadata_json, source_type, sync_status, sync_error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
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
  return queryAll<CodeReviewSkill>(
    "SELECT * FROM code_review_skills WHERE is_enabled = 1 ORDER BY layer ASC, name ASC",
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
  const current = queryOne<CodeReviewSkill>("SELECT * FROM code_review_skills WHERE id = ?", skillId);
  if (!current) throw new Error("Skill 不存在。");

  execute(
    "UPDATE code_review_skills SET name = ?, layer = ?, description = ?, is_enabled = ?, prompt_md = ?, heuristics_json = ?, updated_at = ? WHERE id = ?",
    input.name ?? current.name,
    input.layer ?? current.layer,
    input.description ?? current.description,
    input.isEnabled === undefined ? current.isEnabled : input.isEnabled ? 1 : 0,
    input.promptMd ?? current.promptMd,
    JSON.stringify(input.heuristics ?? JSON.parse(current.heuristicsJson)),
    new Date().toISOString(),
    skillId,
  );

  return queryOne<CodeReviewSkill>("SELECT * FROM code_review_skills WHERE id = ?", skillId);
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

export async function syncReviewSkillsToOpenViking() {
  const skills = queryAll<CodeReviewSkill>(
    "SELECT * FROM code_review_skills WHERE is_enabled = 1 ORDER BY layer ASC, name ASC",
  );

  const results = [];
  for (const skill of skills) {
    results.push(
      await writeLayeredKnowledge({
        layer: skill.layer,
        scopeKey: `skills/${skill.id}`,
        skillId: skill.id,
        title: `Review Skill: ${skill.name}`,
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
  const [health, layers, entries] = await Promise.all([
    getOpenVikingHealth(),
    Promise.resolve(listKnowledgeLayers()),
    Promise.resolve(listLayeredKnowledge(12)),
  ]);
  const skills = listKnowledgeSkills();

  let tree: Array<Record<string, unknown>> = [];
  if (health.ok) {
    tree = await getOpenVikingTree().catch(() => []);
  }

  return {
    health,
    layers,
    entries,
    skills,
    tree,
  };
}
