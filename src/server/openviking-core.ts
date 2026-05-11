import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execute, queryAll, type OpenVikingKnowledgeEntry } from "@/server/db";

const SHADOW_ROOT = path.join(process.cwd(), "data", "openviking-shadow");

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
};

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "default";
}

function buildVikingUri(layer: string, scopeKey: string, id: string) {
  return `viking://agent/resources/code-review/${slugify(layer)}/${slugify(scopeKey)}/${id}.md`;
}

function shadowFilePath(layer: string, scopeKey: string, id: string) {
  return path.join(SHADOW_ROOT, slugify(layer), slugify(scopeKey), `${id}.md`);
}

async function syncRemote(uri: string, filePath: string, contentMd: string): Promise<RemoteSyncResult> {
  const baseUrl = process.env.OPENVIKING_BASE_URL?.replace(/\/+$/, "");

  if (!baseUrl) {
    return { status: "local_shadow", error: null };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.OPENVIKING_API_KEY;
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const attempts = [
    {
      url: `${baseUrl}/api/v1/content/write`,
      body: { uri, content: contentMd },
    },
    {
      url: `${baseUrl}/api/v1/resources/add`,
      body: { uri, url: `file://${filePath}` },
    },
  ];

  let lastError = "OpenViking remote sync failed";
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        method: "POST",
        headers,
        body: JSON.stringify(attempt.body),
      });

      if (response.ok) return { status: "remote_synced", error: null };

      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return { status: "remote_failed_local_shadow", error: lastError };
}

export async function writeLayeredKnowledge(input: KnowledgeInput) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const vikingUri = buildVikingUri(input.layer, input.scopeKey, id);
  const filePath = shadowFilePath(input.layer, input.scopeKey, id);
  const metadata = {
    ...input.metadata,
    vikingUri,
    layer: input.layer,
    scopeKey: input.scopeKey,
    sourceType: input.sourceType,
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

  const syncResult = await syncRemote(vikingUri, filePath, content);

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

export function listLayeredKnowledge(limit = 50) {
  return queryAll<OpenVikingKnowledgeEntry>(
    "SELECT * FROM openviking_knowledge_entries ORDER BY created_at DESC LIMIT ?",
    limit,
  );
}

