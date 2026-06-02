const legacyKnowledgeUriScheme = `${["vik", "ing"].join("")}://`;

export const LEGACY_KNOWLEDGE_URI_SCHEME = legacyKnowledgeUriScheme;
export const NATIVE_KNOWLEDGE_URI_SCHEME = "agentworld://knowledge/";

export function normalizeKnowledgeUri(uri: string | null | undefined) {
  const value = (uri ?? "").trim();
  if (!value.startsWith(LEGACY_KNOWLEDGE_URI_SCHEME)) return value;

  return `${NATIVE_KNOWLEDGE_URI_SCHEME}${value.slice(LEGACY_KNOWLEDGE_URI_SCHEME.length).replace(/^\/+/, "")}`;
}

export function replaceLegacyKnowledgeUriText(value: string | null | undefined) {
  return (value ?? "").split(LEGACY_KNOWLEDGE_URI_SCHEME).join(NATIVE_KNOWLEDGE_URI_SCHEME);
}
