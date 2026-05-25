import { NextResponse } from "next/server";
import {
  getKnowledgeEntry,
  getKnowledgeEntryVersion,
  KnowledgeEntryConflictError,
  listKnowledgeEntryVersions,
  restoreKnowledgeEntryVersion,
} from "@/server/openviking-core";
import { canAccessBusinessTeam, getRequestAuthContext, requireBusinessTeamAccess } from "@/server/auth-core";
import { listKnowledgeSpaces } from "@/server/knowledge-core";
import { listAgentTeams } from "@/server/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolveSpaceBusinessTeamId(spaceId: string | null | undefined) {
  if (!spaceId) return null;
  const space = listKnowledgeSpaces().find((item) => item.id === spaceId);
  if (space?.businessTeamId) return space.businessTeamId;
  if (space?.agentTeamId) return listAgentTeams().find((team) => team.id === space.agentTeamId)?.businessTeamId ?? null;
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entryId = searchParams.get("entryId");
  if (!entryId) return NextResponse.json({ ok: false, error: "entryId is required" }, { status: 400 });

  const authContext = await getRequestAuthContext();
  const entry = getKnowledgeEntry(entryId);
  requireBusinessTeamAccess(authContext, resolveSpaceBusinessTeamId(entry?.knowledgeSpaceId));

  return NextResponse.json({ ok: true, versions: listKnowledgeEntryVersions(entryId) });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      entryId?: string;
      versionId?: string;
      baseRevision?: number | null;
    };
    if (body.action !== "restore") {
      return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
    }
    if (!body.entryId || !body.versionId) {
      return NextResponse.json({ ok: false, error: "entryId and versionId are required" }, { status: 400 });
    }

    const authContext = await getRequestAuthContext();
    const entry = getKnowledgeEntry(body.entryId);
    const version = getKnowledgeEntryVersion(body.entryId, body.versionId);
    requireBusinessTeamAccess(authContext, resolveSpaceBusinessTeamId(entry?.knowledgeSpaceId));
    if (version?.knowledgeSpaceId && !canAccessBusinessTeam(authContext, resolveSpaceBusinessTeamId(version.knowledgeSpaceId))) {
      throw new Error("Business team access denied");
    }

    const updatedBy = authContext?.user.email || authContext?.user.name || authContext?.user.id || null;
    const restoredEntry = await restoreKnowledgeEntryVersion({
      entryId: body.entryId,
      versionId: body.versionId,
      baseRevision: body.baseRevision,
      updatedBy,
    });
    return NextResponse.json({ ok: true, entry: restoredEntry });
  } catch (error) {
    if (error instanceof KnowledgeEntryConflictError) {
      return NextResponse.json(
        {
          ok: false,
          error: "知识已被其他编辑者更新，请先查看最新版本后再合并。",
          currentEntry: error.currentEntry,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "恢复历史版本失败" },
      { status: 400 },
    );
  }
}
