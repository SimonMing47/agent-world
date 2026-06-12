import {
  queryAll,
  queryOne,
  type AgentDefinition,
  type AgentTeamMember,
  type InspectionSkill,
} from "@/server/db";
import { normalizeKnowledgeUri } from "@/lib/knowledge-uri";

type JsonRecord = Record<string, unknown>;

export type AgentSkillLoadout = {
  agentTeamMemberId: string | null;
  agentDefinitionId: string | null;
  skills: Array<{
    id: string;
    name: string;
    layer: string;
    description: string;
    tags: string[];
    visibility: string;
    vikingUri: string | null;
  }>;
  scopeUris: string[];
  rules: JsonRecord[];
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseRecord(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,，\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeSkillRef(value: unknown, allowRawId = false) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("knowledge:")) return trimmed.slice("knowledge:".length).trim();
  if (trimmed.startsWith("skill:")) return trimmed.slice("skill:".length).trim();
  if (trimmed.startsWith("inspection-skill:")) {
    return trimmed.slice("inspection-skill:".length).trim();
  }
  if (trimmed.startsWith("agentworld://knowledge/")) return normalizeKnowledgeUri(trimmed);
  if (allowRawId && /^[A-Za-z0-9._-]+$/.test(trimmed)) return trimmed;
  return null;
}

function collectSkillRefs(value: unknown, refs: Set<string>, allowRawIds = false) {
  if (typeof value === "string") {
    const normalized = normalizeSkillRef(value, allowRawIds);
    if (normalized) refs.add(normalized);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectSkillRefs(item, refs, allowRawIds));
    return;
  }
  if (!isRecord(value)) return;

  for (const key of ["id", "knowledgeId", "knowledgeRef", "skillId", "skillRef", "vikingUri", "uri"]) {
    const normalized = normalizeSkillRef(value[key], key === "id" || key === "knowledgeId" || key === "skillId");
    if (normalized) refs.add(normalized);
  }
  for (const key of ["knowledge", "knowledgeRefs", "knowledgeIds", "skills", "skillRefs", "skillIds", "inspectionSkills"]) {
    collectSkillRefs(value[key], refs, true);
  }
}

function collectSkillRefsFromText(value: string | null | undefined, refs: Set<string>) {
  if (!value) return;
  for (const match of value.matchAll(/\b(?:knowledge|skill|inspection-skill):([A-Za-z0-9._:/-]+)/g)) {
    const normalized = normalizeSkillRef(`${match[0].split(":")[0]}:${match[1]}`);
    if (normalized) refs.add(normalized);
  }
}

function extractSkillRules(skill: InspectionSkill) {
  const heuristics = parseRecord(skill.heuristicsJson);
  const rawRules = Array.isArray(heuristics.rules) ? heuristics.rules : [];
  const skillRefs = [skill.id, skill.vikingUri ? normalizeKnowledgeUri(skill.vikingUri) : ""].filter(Boolean);
  return rawRules.filter(isRecord).map((rule) => ({
    ...rule,
    skillRefs: [...new Set([...parseStringArray(rule.skillRefs), ...skillRefs])],
    knowledgeRefs: [...new Set([...parseStringArray(rule.knowledgeRefs), ...parseStringArray(rule.skillRefs), ...skillRefs])],
    sourceAgent: typeof rule.sourceAgent === "string" && rule.sourceAgent.trim()
      ? rule.sourceAgent.trim()
      : skill.name,
  }));
}

function emptyLoadout(agentTeamMemberId: string | null, agentDefinitionId: string | null): AgentSkillLoadout {
  return {
    agentTeamMemberId,
    agentDefinitionId,
    skills: [],
    scopeUris: [],
    rules: [],
  };
}

export function buildAgentSkillLoadout(agentTeamMemberId: string | null | undefined): AgentSkillLoadout {
  if (!agentTeamMemberId) return emptyLoadout(null, null);

  const member = queryOne<AgentTeamMember>(
    "SELECT * FROM agent_team_members WHERE id = ?",
    agentTeamMemberId,
  );
  if (!member) return emptyLoadout(agentTeamMemberId, null);

  const definition = queryOne<AgentDefinition>(
    "SELECT * FROM agent_definitions WHERE id = ? AND status <> 'deleted'",
    member.agentDefinitionId,
  );
  if (!definition) return emptyLoadout(member.id, member.agentDefinitionId);

  const refs = new Set<string>();
  collectSkillRefs(parseArray(definition.toolBindingsJson), refs);
  collectSkillRefs(parseRecord(definition.capabilityProfileJson), refs);
  collectSkillRefsFromText(member.workInstruction, refs);
  collectSkillRefsFromText(definition.systemPrompt, refs);
  if (refs.size === 0) return emptyLoadout(member.id, definition.id);

  const activeSkills = queryAll<InspectionSkill>(
    "SELECT * FROM inspection_skills WHERE is_enabled = 1 ORDER BY layer ASC, name ASC",
  );
  const skills = activeSkills.filter((skill) => {
    const uri = skill.vikingUri ? normalizeKnowledgeUri(skill.vikingUri) : "";
    return refs.has(skill.id) || (uri ? refs.has(uri) : false);
  });
  const scopeUris = [
    ...new Set(
      skills
        .map((skill) => (skill.vikingUri ? normalizeKnowledgeUri(skill.vikingUri) : ""))
        .filter(Boolean),
    ),
  ];
  return {
    agentTeamMemberId: member.id,
    agentDefinitionId: definition.id,
    skills: skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      layer: skill.layer,
      description: skill.description,
      tags: parseStringArray(parseArray(skill.tagsJson)),
      visibility: skill.visibility,
      vikingUri: skill.vikingUri ? normalizeKnowledgeUri(skill.vikingUri) : null,
    })),
    scopeUris,
    rules: skills.flatMap(extractSkillRules),
  };
}
