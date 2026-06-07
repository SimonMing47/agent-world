import { NextResponse } from "next/server";
import { searchKnowledgeEntries } from "@/server/knowledge-engine";
import {
  requireKnowledgeApiAuthFailure,
  resolveKnowledgeApiAuthContext,
} from "@/server/knowledge-api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function guardRequest(request: Request) {
  const auth = await resolveKnowledgeApiAuthContext(request);
  if (!auth) {
    return requireKnowledgeApiAuthFailure();
  }
  return null;
}

type ParsedKnowledgeQuery = {
  query: string;
  knowledgeSpaceIds?: string[];
  scopeUris?: string[];
  knowledgeCategories?: string[];
  repositoryNames?: string[];
  levels?: Array<"L0" | "L1" | "L2">;
  limit?: number;
  includeOutboundUris?: boolean;
};

function parseKnowledgeCategories(value: unknown) {
  const values = typeof value === "string" ? [value] : parseStringList(value);
  const normalized = values.flatMap((item) => item.split(",")).map((item) => item.trim().toLowerCase());
  return [...new Set(normalized.filter((value) => ["public", "domain", "repository"].includes(value)))];
}

function parseRepositoryNames(value: unknown) {
  const values = typeof value === "string" ? [value] : parseStringList(value);
  const normalized = values.flatMap((item) => item.split(",")).map((item) => item.trim().toLowerCase());
  return [...new Set(normalized.filter(Boolean))];
}

function parseLevels(value: unknown) {
  const normalizedValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const levels = normalizedValues
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item === "L0" || item === "L1" || item === "L2");
  const normalized = [...new Set(levels)];
  return normalized.length ? (normalized as Array<"L0" | "L1" | "L2">) : undefined;
}

function parseLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return undefined;
  return Math.max(1, Math.min(parsed, 64));
}

function parseBooleanFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return undefined;
}

function parseStringList(value: unknown) {
  if (!value) return [];
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (typeof item === "string" ? item.split(",") : []))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseKnowledgeQueryFromSearchParams(url: URL): ParsedKnowledgeQuery | null {
  const query = url.searchParams.get("query")?.trim() ?? "";
  if (!query) return null;

  return {
    query,
    knowledgeSpaceIds: [...new Set(parseStringList(url.searchParams.getAll("knowledgeSpaceIds")))],
    scopeUris: [...new Set(parseStringList(url.searchParams.getAll("scopeUris")))],
    knowledgeCategories: parseKnowledgeCategories(url.searchParams.getAll("knowledgeCategories")),
    repositoryNames: parseRepositoryNames(url.searchParams.getAll("repositoryNames")),
    levels: parseLevels(url.searchParams.getAll("levels")),
    limit: parseLimit(url.searchParams.get("limit")),
    includeOutboundUris: parseBooleanFlag(url.searchParams.get("includeOutboundUris")),
  };
}

function parseKnowledgeQueryFromBody(body: unknown): ParsedKnowledgeQuery | null {
  if (!body || typeof body !== "object") return null;
  const request = body as {
    query?: unknown;
    knowledgeSpaceIds?: unknown;
    scopeUris?: unknown;
    knowledgeCategories?: unknown;
    repositoryNames?: unknown;
    levels?: unknown;
    limit?: unknown;
    includeOutboundUris?: unknown;
  };

  const query = typeof request.query === "string" ? request.query.trim() : "";
  if (!query) return null;

  return {
    query,
    knowledgeSpaceIds: parseStringList(request.knowledgeSpaceIds),
    scopeUris: parseStringList(request.scopeUris),
    knowledgeCategories: parseKnowledgeCategories(request.knowledgeCategories),
    repositoryNames: parseRepositoryNames(request.repositoryNames),
    levels: parseLevels(request.levels),
    limit: parseLimit(request.limit),
    includeOutboundUris: parseBooleanFlag(request.includeOutboundUris),
  };
}

function withDefaultIds(value?: string[]) {
  if (!value || !value.length) return undefined;
  return value;
}

function buildResponse(input: ParsedKnowledgeQuery) {
  const parsed = searchKnowledgeEntries({
    query: input.query,
    knowledgeSpaceIds: withDefaultIds(input.knowledgeSpaceIds),
    scopeUris: withDefaultIds(input.scopeUris),
    knowledgeCategories: input.knowledgeCategories,
    repositoryNames: input.repositoryNames,
    levels: input.levels,
    limit: input.limit,
    includeOutboundUris: input.includeOutboundUris,
  });

  return NextResponse.json({ ok: true, result: parsed });
}

export async function GET(request: Request) {
  const unauthorized = await guardRequest(request);
  if (unauthorized) {
    return NextResponse.json({ ok: false, error: unauthorized.error }, { status: unauthorized.status });
  }

  const payload = parseKnowledgeQueryFromSearchParams(new URL(request.url));
  if (!payload) {
    return NextResponse.json({ ok: false, error: "query is required" }, { status: 400 });
  }

  return buildResponse(payload);
}

export async function POST(request: Request) {
  const unauthorized = await guardRequest(request);
  if (unauthorized) {
    return NextResponse.json({ ok: false, error: unauthorized.error }, { status: unauthorized.status });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const payload = parseKnowledgeQueryFromBody(body);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "query is required" }, { status: 400 });
  }

  return buildResponse(payload);
}
