export function normalizeKnowledgeImportContent(value: string) {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const normalized: string[] = [];
  let insideFence = false;
  let pendingBlank = false;

  for (const line of lines) {
    const fenceMatch = /^(\s*)(```|~~~)/.test(line);
    if (fenceMatch) {
      if (pendingBlank && normalized.length) normalized.push("");
      pendingBlank = false;
      insideFence = !insideFence;
      normalized.push(line.trimEnd());
      continue;
    }

    if (insideFence) {
      normalized.push(line);
      continue;
    }

    const trimmedRight = line.trimEnd();
    if (!trimmedRight.trim()) {
      pendingBlank = normalized.length > 0;
      continue;
    }

    if (pendingBlank) normalized.push("");
    pendingBlank = false;
    normalized.push(trimmedRight);
  }

  return normalized.join("\n").trim();
}

function comparableHeading(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function stripDuplicateKnowledgeImportHeading(value: string, title: string) {
  const match = /^#\s+(.+?)(?:\n+|$)/.exec(value);
  if (!match?.[1]) return value;
  if (comparableHeading(match[1]) !== comparableHeading(title)) return value;
  return value.slice(match[0].length).trimStart();
}
