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

type MarkdownLineKind = "plain" | "heading" | "quote" | "list" | "table" | "rule" | "code";

function isFenceLine(line: string) {
  return /^(\s*)(```|~~~)/.test(line);
}

function markdownLineKind(line: string): MarkdownLineKind {
  const trimmed = line.trim();
  if (isFenceLine(trimmed)) return "code";
  if (/^#{1,6}\s+\S/.test(trimmed)) return "heading";
  if (/^>/.test(trimmed)) return "quote";
  if (/^([-*+]|\d+[.)])\s+\S/.test(trimmed)) return "list";
  if (/^\|.*\|$/.test(trimmed) || /^:?-{3,}:?(\s*\|\s*:?-{3,}:?)+$/.test(trimmed)) return "table";
  if (/^([-*_])(?:\s*\1){2,}$/.test(trimmed)) return "rule";
  return "plain";
}

function shouldKeepImportBlank(previousLine: string | undefined, nextLine: string) {
  if (!previousLine) return false;
  const previousKind = markdownLineKind(previousLine);
  const nextKind = markdownLineKind(nextLine);
  if (previousKind === "heading" || nextKind === "heading") return true;
  if (previousKind === "code" || nextKind === "code") return true;
  if (previousKind !== "plain" || nextKind !== "plain") return previousKind !== nextKind;
  return false;
}

export function compactDiscoveredKnowledgeContent(value: string) {
  const lines = normalizeKnowledgeImportContent(value).split("\n");
  const compacted: string[] = [];
  let insideFence = false;
  let pendingBlank = false;

  for (const line of lines) {
    const fenceLine = isFenceLine(line);
    if (insideFence) {
      compacted.push(line);
      if (fenceLine) insideFence = false;
      continue;
    }

    const trimmedRight = line.trimEnd();
    if (!trimmedRight.trim()) {
      pendingBlank = compacted.length > 0;
      continue;
    }

    if (pendingBlank && shouldKeepImportBlank(compacted.at(-1), trimmedRight)) {
      compacted.push("");
    }
    pendingBlank = false;
    compacted.push(trimmedRight);

    if (fenceLine) insideFence = true;
  }

  return compacted.join("\n").trim();
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
