import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { completeSimple, type AssistantMessage } from "@earendil-works/pi-ai";
import {
  execute,
  queryAll,
  queryOne,
  type InspectionSkill,
  type ProviderProfile,
  type ProviderRuntimeBinding,
} from "@/server/db";
import { buildPiModel, resolveProviderApiKey } from "@/server/runtime-provider-config";
import { writeLayeredKnowledge } from "@/server/knowledge-engine";
import { uiText } from "@/lib/language-pack";
import { normalizeKnowledgeUri } from "@/lib/knowledge-uri";

export type SkillDraft = {
  id?: string;
  ownerBusinessTeamId?: string | null;
  name: string;
  layer: string;
  description: string;
  tags: string[];
  visibility: string;
  promptMd: string;
  heuristicsJson: string;
  isEnabled?: number | boolean;
};

export type SkillImportFile = {
  name: string;
  relativePath?: string;
  content: string;
};

export type SkillImportResult = {
  imported: number;
  skipped: number;
  skills: InspectionSkill[];
  messages: string[];
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeTags(input: unknown) {
  if (Array.isArray(input)) return input.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof input === "string") {
    return input
      .split(/[,，\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "") || "skill";
}

function parseFrontmatter(text: string) {
  if (!text.startsWith("---")) return { meta: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { meta: {}, body: text };
  const rawMeta = text.slice(3, end).trim();
  const meta: Record<string, string> = {};
  for (const line of rawMeta.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    meta[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  return { meta, body: text.slice(end + 4).trim() };
}

function stringFromRecord(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function draftFromJson(value: unknown, fallbackName: string, defaults: Partial<SkillDraft>): SkillDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const name = stringFromRecord(record, ["name", "title"], fallbackName);
  const promptMd = stringFromRecord(record, ["promptMd", "prompt", "content", "body"]);
  if (!name || !promptMd) return null;

  const heuristics = record.heuristics ?? record.heuristicsJson ?? {};
  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : undefined,
    ownerBusinessTeamId: defaults.ownerBusinessTeamId ?? null,
    name,
    layer: stringFromRecord(record, ["layer", "category"], defaults.layer ?? "knowledge/import"),
    description: stringFromRecord(record, ["description", "summary"], name),
    tags: normalizeTags(record.tags ?? defaults.tags ?? []),
    visibility: stringFromRecord(record, ["visibility"], defaults.visibility ?? "team"),
    promptMd,
    heuristicsJson: typeof heuristics === "string" ? heuristics : JSON.stringify(heuristics, null, 2),
    isEnabled: record.isEnabled === false ? 0 : 1,
  };
}

function draftFromMarkdown(file: SkillImportFile, defaults: Partial<SkillDraft>): SkillDraft | null {
  const { meta, body } = parseFrontmatter(file.content.trim());
  const fallbackName = path.basename(file.name || file.relativePath || "Knowledge", path.extname(file.name || ""));
  const firstHeading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim();
  const name = meta.name || meta.title || firstHeading || fallbackName;
  const description = meta.description || body.split(/\r?\n/).find((line) => line.trim() && !line.startsWith("#"))?.trim() || name;
  const promptMd = body.trim();
  if (!promptMd) return null;

  return {
    ownerBusinessTeamId: defaults.ownerBusinessTeamId ?? null,
    name,
    layer: meta.layer || defaults.layer || "knowledge/import",
    description,
    tags: normalizeTags(meta.tags || defaults.tags || []),
    visibility: meta.visibility || defaults.visibility || "team",
    promptMd,
    heuristicsJson: JSON.stringify({
      importedFrom: file.relativePath || file.name,
      source: "knowledge-file",
    }, null, 2),
    isEnabled: 1,
  };
}

function draftFromFile(file: SkillImportFile, defaults: Partial<SkillDraft>) {
  const fileName = file.name || file.relativePath || "skill";
  if (/\.json$/i.test(fileName)) {
    try {
      const parsed = JSON.parse(file.content) as unknown;
      const draft = draftFromJson(parsed, path.basename(fileName, ".json"), defaults);
      if (draft) return draft;
    } catch {
      return null;
    }
  }
  if (/(\.md|SKILL)$/i.test(fileName)) return draftFromMarkdown(file, defaults);
  return null;
}

function isSkillFile(filePath: string) {
  const basename = path.basename(filePath).toLowerCase();
  return basename === "skill.md" || basename === "skill.json" || basename.endsWith(".skill.md") || basename.endsWith(".skill.json");
}

function walkSkillFiles(rootDir: string, limit = 80) {
  const results: string[] = [];
  const ignored = new Set([".git", "node_modules", ".next", "dist", "build", ".venv"]);
  const visit = (dir: string) => {
    if (results.length >= limit) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (results.length >= limit || ignored.has(entry.name)) continue;
      const nextPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(nextPath);
      } else if (entry.isFile() && isSkillFile(nextPath)) {
        results.push(nextPath);
      }
    }
  };
  visit(rootDir);
  return results;
}

function assertSupportedRepoUrl(repoUrl: string) {
  const trimmed = repoUrl.trim();
  if (!trimmed) throw new Error("Knowledge repository URL is required.");
  if (/^(https?:\/\/|git@|ssh:\/\/)/.test(trimmed)) return trimmed;
  throw new Error("Knowledge repository URL must use https, ssh, or git@ format.");
}

function parseJsonRecord(value: string, fallback: Record<string, unknown> = {}) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : fallback;
  } catch {
    return fallback;
  }
}

function flattenVisibleText(message: AssistantMessage) {
  return message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n");
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as {
      name?: string;
      description?: string;
      promptMd?: string;
      tags?: string[];
      heuristics?: Record<string, unknown>;
      notes?: string[];
    };
  } catch {
    return null;
  }
}

function resolveDefaultProviderRuntime() {
  const runtimeBinding = queryOne<ProviderRuntimeBinding>(
    "SELECT * FROM provider_runtime_bindings WHERE is_enabled = 1 ORDER BY updated_at DESC LIMIT 1",
  );
  const providerProfile =
    (runtimeBinding?.defaultProviderProfileId
      ? queryOne<ProviderProfile>(
          "SELECT * FROM provider_profiles WHERE id = ?",
          runtimeBinding.defaultProviderProfileId,
        )
      : null) ??
    queryOne<ProviderProfile>(
      "SELECT * FROM provider_profiles WHERE is_enabled = 1 ORDER BY updated_at DESC LIMIT 1",
    );

  if (!runtimeBinding || !providerProfile) return null;
  const apiKey = resolveProviderApiKey(providerProfile, runtimeBinding);
  if (!apiKey) return null;
  return { runtimeBinding, providerProfile, apiKey };
}

export function listSkills() {
  return queryAll<InspectionSkill>("SELECT * FROM inspection_skills ORDER BY layer ASC, name ASC").map((skill) => ({
    ...skill,
    vikingUri: skill.vikingUri ? normalizeKnowledgeUri(skill.vikingUri) : null,
  }));
}

export function upsertSkill(input: SkillDraft) {
  const id = input.id || randomUUID();
  const current = queryOne<InspectionSkill>("SELECT * FROM inspection_skills WHERE id = ?", id);
  const createdAt = current?.createdAt ?? nowIso();
  const heuristics = JSON.stringify(parseJsonRecord(input.heuristicsJson), null, 2);
  execute(
    "INSERT OR REPLACE INTO inspection_skills (id, owner_business_team_id, name, layer, description, tags_json, visibility, viking_uri, is_enabled, prompt_md, heuristics_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.ownerBusinessTeamId ?? current?.ownerBusinessTeamId ?? null,
    input.name,
    input.layer,
    input.description,
    JSON.stringify(normalizeTags(input.tags)),
    input.visibility || current?.visibility || "team",
    current?.vikingUri ?? null,
    input.isEnabled === false || input.isEnabled === 0 ? 0 : 1,
    input.promptMd,
    heuristics,
    createdAt,
    nowIso(),
  );

  return queryOne<InspectionSkill>("SELECT * FROM inspection_skills WHERE id = ?", id);
}

export function importSkillsFromFiles(files: SkillImportFile[], defaults: Partial<SkillDraft> = {}): SkillImportResult {
  const result: SkillImportResult = { imported: 0, skipped: 0, skills: [], messages: [] };
  for (const file of files) {
    const draft = draftFromFile(file, defaults);
    if (!draft) {
      result.skipped += 1;
      result.messages.push(`Skipped ${file.relativePath || file.name}: unsupported or incomplete knowledge file.`);
      continue;
    }

    const skill = upsertSkill({
      ...draft,
      id: draft.id || `knowledge-${slugify(draft.name)}-${randomUUID().slice(0, 8)}`,
    });
    if (skill) {
      result.imported += 1;
      result.skills.push(skill);
    }
  }
  return result;
}

export function discoverSkillsFromRepository(input: {
  repoUrl: string;
  ownerBusinessTeamId?: string | null;
  visibility?: string;
}) {
  const repoUrl = assertSupportedRepoUrl(input.repoUrl);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentworld-knowledge-"));
  try {
    execFileSync("git", ["clone", "--depth=1", repoUrl, tempDir], {
      stdio: "ignore",
      timeout: 45_000,
    });
    const files = walkSkillFiles(tempDir).map<SkillImportFile>((filePath) => ({
      name: path.basename(filePath),
      relativePath: path.relative(tempDir, filePath),
      content: fs.readFileSync(filePath, "utf8"),
    }));
    return importSkillsFromFiles(files, {
      ownerBusinessTeamId: input.ownerBusinessTeamId ?? null,
      visibility: input.visibility ?? "team",
      layer: "knowledge/repository",
      tags: ["repository-import"],
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function syncSkillToKnowledgeEngine(skillId: string) {
  const skill = queryOne<InspectionSkill>("SELECT * FROM inspection_skills WHERE id = ?", skillId);
  if (!skill) throw new Error(uiText("ui.generated.cd4fe99088a"));

  const result = await writeLayeredKnowledge({
    layer: skill.layer,
    scopeKey: `knowledge/${skill.id}`,
    skillId: skill.id,
    title: `Knowledge: ${skill.name}`,
    sourceType: "skill",
    metadata: {
      skillId: skill.id,
      ownerBusinessTeamId: skill.ownerBusinessTeamId,
      tags: normalizeTags(JSON.parse(skill.tagsJson || "[]")),
      visibility: skill.visibility,
      description: skill.description,
      heuristics: parseJsonRecord(skill.heuristicsJson),
    },
    contentMd: [
      skill.description,
      "",
      "## Prompt",
      skill.promptMd,
      "",
      "## Heuristics",
      "```json",
      JSON.stringify(parseJsonRecord(skill.heuristicsJson), null, 2),
      "```",
    ].join("\n"),
  });

  execute("UPDATE inspection_skills SET viking_uri = ?, updated_at = ? WHERE id = ?", result.vikingUri, nowIso(), skill.id);
  return { ...result, skill: queryOne<InspectionSkill>("SELECT * FROM inspection_skills WHERE id = ?", skill.id) };
}

export async function optimizeSkillDraft(input: { skill: SkillDraft; optimizationGoal?: string }) {
  const resolved = resolveDefaultProviderRuntime();
  if (!resolved) {
    return {
      usedModel: false,
      suggestion: {
        ...input.skill,
        description: input.skill.description.trim(),
        promptMd: [
          input.skill.promptMd.trim(),
          "",
          uiText("ui.generated.c0586838af3"),
          uiText("ui.generated.ca94d6b5839"),
          uiText("ui.generated.c87bbbb5776"),
          uiText("ui.generated.c8f0ea7cbd5"),
        ].join("\n"),
        tags: Array.from(new Set([...normalizeTags(input.skill.tags), uiText("ui.generated.cf381c96b91"), uiText("ui.generated.c41decbbd6e")])),
        notes: [uiText("ui.generated.c6f1aed420b")],
      },
    };
  }

  const model = buildPiModel(resolved.providerProfile, resolved.runtimeBinding);
  const response = await completeSimple(
    model,
    {
      messages: [
        {
          role: "user",
          timestamp: Date.now(),
          content: [
            uiText("ui.generated.c02dd3e809e"),
            uiText("ui.generated.cbc1f6c13ce"),
            'JSON schema: {"name":"string","description":"string","promptMd":"string","tags":["string"],"heuristics":{},"notes":["string"]}',
            `Name: ${input.skill.name}`,
            `Layer: ${input.skill.layer}`,
            `Visibility: ${input.skill.visibility}`,
            `Tags: ${input.skill.tags.join(", ")}`,
            `Description:\n${input.skill.description}`,
            `Prompt:\n${input.skill.promptMd}`,
            `Heuristics:\n${input.skill.heuristicsJson}`,
            input.optimizationGoal ? `Optimization goal:\n${input.optimizationGoal}` : "",
            uiText("ui.generated.ce1ebfa417c"),
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    },
    {
      apiKey: resolved.apiKey,
      maxTokens: 1400,
      reasoning: "medium",
    },
  );

  if (response.stopReason === "error") {
    throw new Error(response.errorMessage ?? uiText("ui.generated.c7449e0571d"));
  }

  const rawText = flattenVisibleText(response);
  const parsed = extractJsonObject(rawText);
  if (!parsed) throw new Error(uiText("ui.generated.c6ce01bd0a3"));

  return {
    usedModel: true,
    suggestion: {
      ...input.skill,
      name: parsed.name ?? input.skill.name,
      description: parsed.description ?? input.skill.description,
      promptMd: parsed.promptMd ?? input.skill.promptMd,
      tags: normalizeTags(parsed.tags ?? input.skill.tags),
      heuristicsJson: JSON.stringify(parsed.heuristics ?? parseJsonRecord(input.skill.heuristicsJson), null, 2),
      notes: parsed.notes ?? [],
    },
    rawText,
    responseModel: response.responseModel ?? response.model,
    usage: response.usage,
  };
}
