import { NextResponse } from "next/server";
import { queryOne, type TaskRun } from "@/server/db";
import { buildTaskRunKnowledgeRetrieval } from "@/server/knowledge-core";
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

type KnowledgeRetrieveRequest = {
  taskRunId?: string;
  nodeId?: string;
  agentId?: string;
  query?: string;
  knowledgeSpaceIds?: string[];
  scopeUris?: string[];
  knowledgeCategories?: string[];
  repositoryNames?: string[];
  levels?: Array<"L0" | "L1" | "L2">;
  limit?: number;
  includeOutboundUris?: boolean;
};

function parseStringArray(value: unknown) {
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

function parseLevels(value: unknown) {
  const candidates = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const levels = candidates
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item === "L0" || item === "L1" || item === "L2");
  return [...new Set(levels)] as Array<"L0" | "L1" | "L2">;
}

function parseKnowledgeCategories(value: unknown) {
  const values = typeof value === "string" ? [value] : parseStringArray(value);
  const normalized = values
    .flatMap((item) => item.split(","))
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item === "public" || item === "domain" || item === "repository");
  return [...new Set(normalized)];
}

function parseRepositoryNames(value: unknown) {
  const values = typeof value === "string" ? [value] : parseStringArray(value);
  const normalized = values
    .flatMap((item) => item.split(","))
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(normalized)];
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

function parseKnowledgeRetrieveRequest(input: unknown): KnowledgeRetrieveRequest | null {
  if (!input || typeof input !== "object") return null;
  const request = input as {
    taskRunId?: unknown;
    nodeId?: unknown;
    agentId?: unknown;
    query?: unknown;
    knowledgeSpaceIds?: unknown;
    scopeUris?: unknown;
    knowledgeCategories?: unknown;
    repositoryNames?: unknown;
    levels?: unknown;
    limit?: unknown;
    includeOutboundUris?: unknown;
  };

  const taskRunId =
    typeof request.taskRunId === "string" && request.taskRunId.trim() ? request.taskRunId.trim() : undefined;
  const query = typeof request.query === "string" ? request.query.trim() : "";

  if (!query && !taskRunId) return null;

  return {
    taskRunId,
    nodeId:
      typeof request.nodeId === "string" && request.nodeId.trim() ? request.nodeId.trim() : undefined,
    agentId:
      typeof request.agentId === "string" && request.agentId.trim() ? request.agentId.trim() : undefined,
    query: query || undefined,
    knowledgeSpaceIds: parseStringArray(request.knowledgeSpaceIds),
    scopeUris: parseStringArray(request.scopeUris),
    knowledgeCategories: parseKnowledgeCategories(request.knowledgeCategories),
    repositoryNames: parseRepositoryNames(request.repositoryNames),
    levels: parseLevels(request.levels),
    limit: parseLimit(request.limit),
    includeOutboundUris: parseBooleanFlag(request.includeOutboundUris),
  };
}

function parseKnowledgeRetrieveRequestFromSearchParams(url: URL) {
  return parseKnowledgeRetrieveRequest({
    taskRunId: url.searchParams.get("taskRunId")?.trim(),
    nodeId: url.searchParams.get("nodeId")?.trim(),
    agentId: url.searchParams.get("agentId")?.trim(),
    query: url.searchParams.get("query")?.trim(),
    knowledgeSpaceIds: url.searchParams.getAll("knowledgeSpaceIds"),
    knowledgeCategories: url.searchParams.getAll("knowledgeCategories"),
    repositoryNames: url.searchParams.getAll("repositoryNames"),
    scopeUris: url.searchParams.getAll("scopeUris"),
    levels: url.searchParams.get("levels")?.trim(),
    limit: url.searchParams.get("limit")?.trim(),
    includeOutboundUris: url.searchParams.get("includeOutboundUris")?.trim(),
  });
}

function normalizeLevels(levels: KnowledgeRetrieveRequest["levels"]) {
  return (levels?.length ? levels : undefined);
}

function buildSearchPacket(input: KnowledgeRetrieveRequest) {
  const search = searchKnowledgeEntries({
    query: input.query ?? "",
    knowledgeSpaceIds: input.knowledgeSpaceIds,
    scopeUris: input.scopeUris,
    knowledgeCategories: input.knowledgeCategories,
    repositoryNames: input.repositoryNames,
    levels: normalizeLevels(input.levels),
    limit: input.limit,
    includeOutboundUris: input.includeOutboundUris,
  });

  return {
    kind: "search",
    query: search.query,
    scope: search.scope,
    totalEntries: search.totalEntries,
    totalCandidates: search.totalCandidates,
    hits: search.hits,
  };
}

async function buildTaskRunPacket(taskRunId: string, request: KnowledgeRetrieveRequest) {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", taskRunId);
  if (!taskRun) {
    return null;
  }

  return buildTaskRunKnowledgeRetrieval(taskRun, {
    query: request.query,
    knowledgeSpaceIds: request.knowledgeSpaceIds,
    scopeUris: request.scopeUris,
    knowledgeCategories: request.knowledgeCategories,
    repositoryNames: request.repositoryNames,
    levels: normalizeLevels(request.levels),
    limit: request.limit,
    includeOutboundUris: request.includeOutboundUris,
  });
}

function buildTaskRunPacketResponse(taskRunId: string, payload: KnowledgeRetrieveRequest, retrieval: Exclude<Awaited<ReturnType<typeof buildTaskRunPacket>>, null>) {
  return {
    kind: "taskRun",
    query: retrieval.query,
    refs: retrieval.refs,
    totalRefs: retrieval.totalRefs,
    search: retrieval.search,
    health: retrieval.health,
    degraded: retrieval.degraded,
    context: {
      taskRunId,
      nodeId: payload.nodeId ?? null,
      agentId: payload.agentId ?? null,
      knowledgeSpaceIds: payload.knowledgeSpaceIds,
      scopeUris: payload.scopeUris,
      knowledgeCategories: payload.knowledgeCategories,
      repositoryNames: payload.repositoryNames,
    },
  };
}

export async function POST(request: Request) {
  const unauthorized = await guardRequest(request);
  if (unauthorized) {
    return NextResponse.json({ ok: false, error: unauthorized.error }, { status: unauthorized.status });
  }

  const payload = parseKnowledgeRetrieveRequest(await request.json().catch(() => ({})));
  if (!payload) {
    return NextResponse.json({ ok: false, error: "query or taskRunId is required" }, { status: 400 });
  }

  return buildKnowledgeRetrieveResponse(payload);
}

export async function GET(request: Request) {
  const unauthorized = await guardRequest(request);
  if (unauthorized) {
    return NextResponse.json({ ok: false, error: unauthorized.error }, { status: unauthorized.status });
  }

  const payload = parseKnowledgeRetrieveRequestFromSearchParams(new URL(request.url));
  if (!payload) {
    return NextResponse.json({ ok: false, error: "query or taskRunId is required" }, { status: 400 });
  }

  return buildKnowledgeRetrieveResponse(payload);
}

async function buildKnowledgeRetrieveResponse(payload: KnowledgeRetrieveRequest) {
  if (!payload.query && !payload.taskRunId) {
    return NextResponse.json({ ok: false, error: "query or taskRunId is required" }, { status: 400 });
  }

  if (!payload.taskRunId) {
    return NextResponse.json({ ok: true, packet: buildSearchPacket(payload) });
  }

  const retrieval = await buildTaskRunPacket(payload.taskRunId, payload);
  if (!retrieval) {
    return NextResponse.json({ ok: false, error: "task run not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    packet: buildTaskRunPacketResponse(payload.taskRunId, payload, retrieval),
    context: {
      taskRunId: payload.taskRunId,
      nodeId: payload.nodeId ?? null,
      agentId: payload.agentId ?? null,
      query: payload.query ?? retrieval.query,
    },
  });
}
