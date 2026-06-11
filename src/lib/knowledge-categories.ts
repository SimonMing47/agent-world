export const knowledgeCategoryValues = ["global", "domain", "codebase"] as const;

export type KnowledgeCategory = (typeof knowledgeCategoryValues)[number];

const knowledgeCategoryAlias: Record<string, KnowledgeCategory> = {
  global: "global",
  public: "global",
  common: "global",
  shared: "global",
  skill: "global",
  knowledge: "global",
  domain: "domain",
  field: "domain",
  business: "domain",
  codebase: "codebase",
  code: "codebase",
  repository: "codebase",
  repository_name: "codebase",
  repo: "codebase",
};

function normalizeKnowledgeCategoryValue(value: string | undefined | null): KnowledgeCategory | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return knowledgeCategoryAlias[normalized] ?? null;
}

export function normalizeKnowledgeCategory(value: unknown): KnowledgeCategory {
  return normalizeKnowledgeCategoryValue(typeof value === "string" ? value : null) ?? "domain";
}

export function normalizeKnowledgeCategories(value: unknown): KnowledgeCategory[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [value];
  const normalized = values
    .flatMap((item) => (typeof item === "string" ? item.split(",") : []))
    .map((item) => normalizeKnowledgeCategoryValue(item))
    .filter((item): item is KnowledgeCategory => Boolean(item));

  return [...new Set(normalized)];
}

export function isKnowledgeCategory(value: unknown): value is KnowledgeCategory {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return knowledgeCategoryValues.includes(normalized as KnowledgeCategory);
}

export function isCodebaseKnowledgeCategory(value: unknown) {
  return normalizeKnowledgeCategory(value) === "codebase";
}
