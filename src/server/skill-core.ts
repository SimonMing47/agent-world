import { randomUUID } from "node:crypto";
import { completeSimple, type AssistantMessage } from "@earendil-works/pi-ai";
import {
  execute,
  queryAll,
  queryOne,
  type CodeReviewSkill,
  type ProviderProfile,
  type ProviderRuntimeBinding,
} from "@/server/db";
import { buildPiModel, resolveProviderApiKey } from "@/server/runtime-provider-config";
import { writeLayeredKnowledge } from "@/server/openviking-core";
import { uiText } from "@/lib/language-pack";

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
  return queryAll<CodeReviewSkill>("SELECT * FROM code_review_skills ORDER BY layer ASC, name ASC");
}

export function upsertSkill(input: SkillDraft) {
  const id = input.id || randomUUID();
  const current = queryOne<CodeReviewSkill>("SELECT * FROM code_review_skills WHERE id = ?", id);
  const createdAt = current?.createdAt ?? nowIso();
  const heuristics = JSON.stringify(parseJsonRecord(input.heuristicsJson), null, 2);
  execute(
    "INSERT OR REPLACE INTO code_review_skills (id, owner_business_team_id, name, layer, description, tags_json, visibility, viking_uri, is_enabled, prompt_md, heuristics_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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

  return queryOne<CodeReviewSkill>("SELECT * FROM code_review_skills WHERE id = ?", id);
}

export async function syncSkillToOpenViking(skillId: string) {
  const skill = queryOne<CodeReviewSkill>("SELECT * FROM code_review_skills WHERE id = ?", skillId);
  if (!skill) throw new Error(uiText("ui.generated.cd4fe99088a"));

  const result = await writeLayeredKnowledge({
    layer: skill.layer,
    scopeKey: `skills/${skill.id}`,
    skillId: skill.id,
    title: `Skill: ${skill.name}`,
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

  execute("UPDATE code_review_skills SET viking_uri = ?, updated_at = ? WHERE id = ?", result.vikingUri, nowIso(), skill.id);
  return { ...result, skill: queryOne<CodeReviewSkill>("SELECT * FROM code_review_skills WHERE id = ?", skill.id) };
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

