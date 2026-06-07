function normalizeRepositoryToken(value: string) {
  return value
    .trim()
    .replace(/^git\+/, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/g, "");
}

function pathSegmentsFromRepositoryValue(value: string) {
  const normalized = normalizeRepositoryToken(value);
  if (!normalized) return [];

  try {
    const parsed = new URL(normalized);
    return parsed.pathname.split("/").filter(Boolean);
  } catch {
    const sshMatch = normalized.match(/^[^@]+@[^:]+:(.+)$/);
    const pathLike = sshMatch?.[1] ?? normalized;
    return pathLike.split("/").filter(Boolean);
  }
}

export function buildRepositoryNameAliases(...values: Array<string | null | undefined>) {
  const aliases = new Set<string>();

  for (const value of values) {
    const raw = value?.trim();
    if (!raw) continue;

    const normalized = normalizeRepositoryToken(raw).toLowerCase();
    if (normalized) aliases.add(normalized);

    const segments = pathSegmentsFromRepositoryValue(raw).map((segment) => normalizeRepositoryToken(segment).toLowerCase());
    const [owner, repo] = segments.slice(-2);
    if (owner && repo) aliases.add(`${owner}/${repo}`);
    if (repo) aliases.add(repo);
  }

  return [...aliases].filter(Boolean);
}
