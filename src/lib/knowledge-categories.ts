export const knowledgeCategoryValues = ["skill", "domain", "code"] as const;

export type KnowledgeCategory = (typeof knowledgeCategoryValues)[number];

const knowledgeCategoryAlias: Record<string, KnowledgeCategory> = {
  skill: "skill",
  public: "skill",
  domain: "domain",
  code: "code",
  repository: "code",
  repository_name: "code",
  repo: "code",
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
  return normalizeKnowledgeCategoryValue(typeof value === "string" ? value : null) !== null;
}
