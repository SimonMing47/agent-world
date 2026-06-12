import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { upsertKnowledgeEntry } from "@/server/knowledge-engine";
import { getRequestAuthContext, requireBusinessTeamAccess } from "@/server/auth-core";
import { listKnowledgeSpaces } from "@/server/knowledge-core";
import { listAgentTeams } from "@/server/queries";
import { uiText } from "@/lib/language-pack";
import {
  compactDiscoveredKnowledgeContent,
  stripDuplicateKnowledgeImportHeading,
} from "@/lib/knowledge-import-content";
import {
  normalizeKnowledgeImportUrl,
  resolveKnowledgeImportFetchUrl,
} from "@/lib/knowledge-import-url";
import {
  isKnowledgeImportBlockedResolvedAddress,
  isKnowledgeImportPrivateAddress,
} from "@/server/knowledge-import-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxFetchedChars = 600_000;
const maxFileChars = 900_000;

type ImportFilePayload = {
  name?: string;
  type?: string;
  size?: number;
  content?: string;
  relativePath?: string;
};

type KnowledgeImportPayload = {
  knowledgeSpaceId?: string;
  parentFolderId?: string | null;
  urls?: string[];
  files?: ImportFilePayload[];
  importMode?: "url" | "files" | "directory";
  preserveTree?: boolean;
};

function resolveSpaceBusinessTeamId(spaceId: string | null | undefined) {
  if (!spaceId) return null;
  const space = listKnowledgeSpaces().find((item) => item.id === spaceId);
  if (space?.businessTeamId) return space.businessTeamId;
  if (space?.agentTeamId) return listAgentTeams().find((team) => team.id === space.agentTeamId)?.businessTeamId ?? null;
  return null;
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCharCode(parseInt(code, 16)));
}

function textFromHtml(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<h1[^>]*>/gi, "\n\n# ")
      .replace(/<h2[^>]*>/gi, "\n\n## ")
      .replace(/<h3[^>]*>/gi, "\n\n### ")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|main|header|footer|tr|table|ul|ol)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractMeta(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(
    `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`,
    "i",
  );
  const match = expression.exec(html);
  return decodeEntities(match?.[1] ?? match?.[2] ?? "").trim();
}

function titleFromHtml(html: string, url: URL) {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const normalized = decodeEntities(title ?? "").replace(/\s+/g, " ").trim();
  if (normalized) return normalized.slice(0, 140);
  const pathName = decodeURIComponent(url.pathname.replace(/\/+$/, "").split("/").filter(Boolean).pop() ?? "");
  return (pathName || url.hostname).slice(0, 140);
}

function titleFromText(value: string, url: URL) {
  const heading = /^#\s+(.+)$/m.exec(value)?.[1]?.trim();
  if (heading) return heading.slice(0, 140);
  return titleFromHtml("", url);
}

function normalizeUrl(value: string) {
  try {
    return normalizeKnowledgeImportUrl(value);
  } catch {
    throw new Error(uiText("ui.knowledgeImport.errors.httpOnly"));
  }
}

async function assertPublicFetchUrl(url: URL) {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error(uiText("ui.knowledgeImport.errors.localhostDenied"));
  }
  if (isIP(hostname) && isKnowledgeImportPrivateAddress(hostname)) {
    throw new Error(uiText("ui.knowledgeImport.errors.privateAddressDenied"));
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((address) => isKnowledgeImportBlockedResolvedAddress(address.address))) {
    throw new Error(uiText("ui.knowledgeImport.errors.privateAddressDenied"));
  }
}

async function fetchPublicUrl(url: URL, init: RequestInit, redirectLimit = 5) {
  let currentUrl = url;
  for (let index = 0; index <= redirectLimit; index += 1) {
    await assertPublicFetchUrl(currentUrl);
    const response = await fetch(currentUrl, { ...init, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, url: currentUrl };
    }

    const location = response.headers.get("location");
    if (!location) throw new Error(uiText("ui.knowledgeImport.errors.redirectMissingLocation"));
    currentUrl = normalizeUrl(new URL(location, currentUrl).toString());
  }

  throw new Error(uiText("ui.knowledgeImport.errors.redirectLimitExceeded"));
}

async function fetchUrlKnowledge(rawUrl: string) {
  const sourceUrl = normalizeUrl(rawUrl);
  const fetchUrl = resolveKnowledgeImportFetchUrl(sourceUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const { response, url: finalUrl } = await fetchPublicUrl(fetchUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.6",
        "User-Agent": "AgentWorld-KnowledgeDiscovery/1.0",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(uiText("ui.knowledgeImport.errors.fetchFailed", undefined, { status: response.status }));
    }
    const contentType = response.headers.get("content-type") ?? "";
    const raw = (await response.text()).slice(0, maxFetchedChars);
    const isHtml = contentType.includes("html") || /<html|<body|<article|<main/i.test(raw);
    const body = compactDiscoveredKnowledgeContent(isHtml ? textFromHtml(raw) : raw);
    if (!body) throw new Error(uiText("ui.knowledgeImport.errors.emptyArchiveBody"));
    const title = isHtml ? titleFromHtml(raw, finalUrl) : titleFromText(body, finalUrl);
    const description = isHtml ? extractMeta(raw, "description") || extractMeta(raw, "og:description") : "";
    return {
      url: sourceUrl.toString(),
      fetchedUrl: finalUrl.toString(),
      title,
      description,
      content: body,
      truncated: raw.length >= maxFetchedChars,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function markdownForUrl(input: Awaited<ReturnType<typeof fetchUrlKnowledge>>) {
  const content = stripDuplicateKnowledgeImportHeading(input.content, input.title);
  const lines = [
    `# ${input.title}`,
    "",
    uiText("ui.knowledgeImport.markdown.source", undefined, { url: input.url }),
    uiText("ui.knowledgeImport.markdown.fetchTime", undefined, { time: new Date().toISOString() }),
  ];
  if (input.description) {
    lines.push(uiText("ui.knowledgeImport.markdown.description", undefined, { description: input.description }));
  }
  if (input.truncated) lines.push(uiText("ui.knowledgeImport.markdown.urlTruncatedRemark"));
  lines.push("", uiText("ui.knowledgeImport.markdown.bodyHeading"), "", content);
  return lines.join("\n");
}

function markdownForFile(file: Required<Pick<ImportFilePayload, "name" | "content">> & ImportFilePayload) {
  const content = file.content.slice(0, maxFileChars);
  return [
    `# ${file.name}`,
    "",
    uiText("ui.knowledgeImport.markdown.sourceFile", undefined, { name: file.name }),
    file.relativePath && file.relativePath !== file.name
      ? uiText("ui.knowledgeImport.markdown.originalPath", undefined, { path: file.relativePath })
      : null,
    uiText("ui.knowledgeImport.markdown.fileType", undefined, { type: file.type || "text/plain" }),
    typeof file.size === "number"
      ? uiText("ui.knowledgeImport.markdown.fileSize", undefined, { size: file.size })
      : null,
    uiText("ui.knowledgeImport.markdown.importTime", undefined, { time: new Date().toISOString() }),
    file.content.length > maxFileChars ? uiText("ui.knowledgeImport.markdown.fileTruncatedRemark") : null,
    "",
    uiText("ui.knowledgeImport.markdown.contentHeading"),
    "",
    content,
  ]
    .filter(Boolean)
    .join("\n");
}

function metadataJson(
  input: Record<string, unknown>,
  parentFolderId: string | null | undefined,
  nodeType: "note" | "folder" = "note",
) {
  return JSON.stringify(
    {
      notebookNodeType: nodeType,
      parentFolderId: parentFolderId || null,
      ...input,
    },
    null,
    2,
  );
}

function cleanTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 140) || uiText("ui.knowledgeImport.defaults.untitledKnowledge");
}

function pathSegments(value: string | null | undefined, fallbackName: string) {
  const normalized = (value || fallbackName)
    .replace(/\\/g, "/")
    .replace(/^[a-z]:/i, "")
    .replace(/^\/+/, "");
  const parts = normalized
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..");
  return parts.length ? parts : [fallbackName];
}

function titleFromFilePath(file: ImportFilePayload) {
  const fallbackName = uiText("ui.knowledgeImport.defaults.droppedKnowledge");
  const parts = pathSegments(file.relativePath, file.name || fallbackName);
  return cleanTitle(parts[parts.length - 1] ?? file.name ?? fallbackName);
}

function scopeFromPath(prefix: string, value: string) {
  return `${prefix}/${value.replace(/\\/g, "/").replace(/[^a-zA-Z0-9\u4e00-\u9fa5/_-]+/g, "-").replace(/\/+/g, "/")}`;
}

async function importDirectoryFiles({
  files,
  knowledgeSpaceId,
  parentFolderId,
  updatedBy,
  importedAt,
}: {
  files: ImportFilePayload[];
  knowledgeSpaceId: string;
  parentFolderId?: string | null;
  updatedBy: string | null;
  importedAt: string;
}) {
  const entries: Awaited<ReturnType<typeof upsertKnowledgeEntry>>[] = [];
  const folderIdsByPath = new Map<string, string>();
  const sortedFiles = files
    .filter((file) => file.content?.trim())
    .sort((left, right) =>
      pathSegments(left.relativePath, left.name || "").join("/").localeCompare(pathSegments(right.relativePath, right.name || "").join("/"), "zh-CN"),
    );

  const ensureFolder = async (segments: string[]) => {
    let currentParentId = parentFolderId || null;
    const currentPath: string[] = [];
    for (const segment of segments) {
      currentPath.push(segment);
      const key = currentPath.join("/");
      const existingId = folderIdsByPath.get(key);
      if (existingId) {
        currentParentId = existingId;
        continue;
      }

      const entry = await upsertKnowledgeEntry({
        knowledgeSpaceId,
        layer: "notebook/folder",
        scopeKey: scopeFromPath("import/directory", key),
        title: cleanTitle(segment),
        contentMd: "",
        metadataJson: metadataJson(
          {
            importKind: "directory",
            originalPath: key,
            importedAt,
          },
          currentParentId,
          "folder",
        ),
        sourceType: "manual",
        updatedBy,
      });
      if (!entry) throw new Error(uiText("ui.knowledgeImport.errors.directoryCreateFailed"));
      entries.push(entry);
      folderIdsByPath.set(key, entry.id);
      currentParentId = entry.id;
    }
    return currentParentId;
  };

  for (const file of sortedFiles) {
    const fallbackName = uiText("ui.knowledgeImport.defaults.droppedKnowledge");
    const parts = pathSegments(file.relativePath, file.name || fallbackName);
    const directoryParts = parts.slice(0, -1);
    const fileName = cleanTitle(parts[parts.length - 1] ?? file.name ?? fallbackName);
    const targetParentId = await ensureFolder(directoryParts);
    const content = file.content?.trim();
    if (!content) continue;

    const entry = await upsertKnowledgeEntry({
      knowledgeSpaceId,
      layer: "knowledge/import",
      scopeKey: scopeFromPath("knowledge/directory", parts.join("/")),
      title: fileName,
      contentMd: markdownForFile({
        ...file,
        name: fileName,
        content,
        relativePath: parts.join("/"),
      }),
      metadataJson: metadataJson(
        {
          importKind: "directory",
          originalPath: parts.join("/"),
          fileName: file.name || fileName,
          fileSize: typeof file.size === "number" ? file.size : null,
          mimeType: file.type || null,
          importedAt,
        },
        targetParentId,
      ),
      sourceType: "skill",
      updatedBy,
    });
    if (!entry) throw new Error(uiText("ui.knowledgeImport.errors.directoryKnowledgeCreateFailed"));
    entries.push(entry);
  }

  return entries;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as KnowledgeImportPayload;
    const knowledgeSpaceId = body.knowledgeSpaceId?.trim();
    if (!knowledgeSpaceId) throw new Error(uiText("ui.knowledgeImport.errors.spaceRequired"));

    const authContext = await getRequestAuthContext(request);
    requireBusinessTeamAccess(authContext, resolveSpaceBusinessTeamId(knowledgeSpaceId));
    const updatedBy = authContext?.user.email || authContext?.user.name || authContext?.user.id || null;
    const importedAt = new Date().toISOString();
    const entries: Awaited<ReturnType<typeof upsertKnowledgeEntry>>[] = [];
    const files = body.files ?? [];
    const shouldPreserveTree =
      body.importMode === "directory" ||
      body.preserveTree === true ||
      files.some((file) => pathSegments(file.relativePath, file.name || "").length > 1);

    for (const rawUrl of body.urls ?? []) {
      if (!rawUrl?.trim()) continue;
      const discovered = await fetchUrlKnowledge(rawUrl);
      const entry = await upsertKnowledgeEntry({
        knowledgeSpaceId,
        layer: "manual",
        scopeKey: "discovery/url",
        title: cleanTitle(discovered.title),
        contentMd: markdownForUrl(discovered),
        metadataJson: metadataJson(
          {
            importKind: "url",
            sourceUrl: discovered.url,
            fetchedUrl: discovered.fetchedUrl === discovered.url ? null : discovered.fetchedUrl,
            sourceDescription: discovered.description || null,
            importedAt,
          },
          body.parentFolderId,
        ),
        sourceType: "manual",
        updatedBy,
      });
      if (!entry) throw new Error(uiText("ui.knowledgeImport.errors.urlKnowledgeCreateFailed"));
      entries.push(entry);
    }

    if (shouldPreserveTree && files.length) {
      entries.push(
        ...(await importDirectoryFiles({
          files,
          knowledgeSpaceId,
          parentFolderId: body.parentFolderId,
          updatedBy,
          importedAt,
        })),
      );
    } else {
      for (const file of files) {
        const name = titleFromFilePath(file);
        const content = file.content?.trim();
        if (!content) continue;
        const entry = await upsertKnowledgeEntry({
          knowledgeSpaceId,
          layer: "manual",
          scopeKey: "drop/file",
          title: name,
          contentMd: markdownForFile({ ...file, name, content, relativePath: file.relativePath || file.name || name }),
          metadataJson: metadataJson(
            {
              importKind: "file",
              originalPath: file.relativePath || file.name || name,
              fileName: file.name || name,
              fileSize: typeof file.size === "number" ? file.size : null,
              mimeType: file.type || null,
              importedAt,
            },
            body.parentFolderId,
          ),
          sourceType: "manual",
          updatedBy,
        });
        if (!entry) throw new Error(uiText("ui.knowledgeImport.errors.fileKnowledgeCreateFailed"));
        entries.push(entry);
      }
    }

    if (!entries.length) throw new Error(uiText("ui.knowledgeImport.errors.noArchiveContent"));
    return NextResponse.json({ ok: true, entries, imported: entries.length });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.knowledgeImport.errors.importFailed") },
      { status: 400 },
    );
  }
}
