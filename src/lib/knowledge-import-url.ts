const markdownUrlPattern = /!?\[[^\]\n]*\]\(\s*<?(https?:\/\/[^\s<>"')]+)>?(?:\s+["'][^"']*["'])?\s*\)/gi;
const bareUrlPattern = /https?:\/\/[^\s<>"'`,)\]]+/gi;

function stripUrlBoundary(value: string) {
  return value
    .trim()
    .replace(/^<+/, "")
    .replace(/[>.,;:!?]+$/g, "");
}

type UrlCandidate = {
  index: number;
  value: string;
};

function addUrlCandidate(candidate: string, urls: string[], seen: Set<string>) {
  const normalized = stripUrlBoundary(candidate);
  if (!normalized) return;
  try {
    const url = new URL(normalized);
    if (!["http:", "https:"].includes(url.protocol)) return;
    const key = url.toString();
    if (seen.has(key)) return;
    seen.add(key);
    urls.push(key);
  } catch {
    // Ignore non-URL text such as Markdown link labels.
  }
}

export function extractKnowledgeImportUrls(value: string) {
  const candidates: UrlCandidate[] = [];
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const match of value.matchAll(markdownUrlPattern)) {
    candidates.push({ index: match.index ?? value.length, value: match[1] ?? "" });
  }
  for (const match of value.matchAll(bareUrlPattern)) {
    candidates.push({ index: match.index ?? value.length, value: match[0] ?? "" });
  }

  for (const candidate of candidates.sort((left, right) => left.index - right.index)) {
    addUrlCandidate(candidate.value, urls, seen);
  }

  return urls;
}

export function normalizeKnowledgeImportUrl(value: string) {
  const candidate = extractKnowledgeImportUrls(value)[0] ?? stripUrlBoundary(value);
  const url = new URL(candidate);
  if (!["http:", "https:"].includes(url.protocol)) throw new TypeError("Only http/https URLs are supported.");
  return url;
}

export function resolveKnowledgeImportFetchUrl(url: URL) {
  if (url.hostname !== "gist.github.com") return url;
  const [owner, gistId] = url.pathname.split("/").filter(Boolean);
  if (!owner || !gistId) return url;
  return new URL(`https://gist.githubusercontent.com/${owner}/${gistId}/raw`);
}
