import { NextResponse } from "next/server";
import {
  deleteKnowledgeEntry,
  KnowledgeEntryConflictError,
  listLayeredKnowledge,
  retryPendingKnowledgeSyncs,
  upsertKnowledgeEntry,
} from "@/server/knowledge-engine";
import { uiText } from "@/lib/language-pack";
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
  const authContext = await getRequestAuthContext(request);
  await retryPendingKnowledgeSyncs(3);
  return NextResponse.json({
    entries: listLayeredKnowledge(100).filter((entry) =>
      canAccessBusinessTeam(authContext, resolveSpaceBusinessTeamId(entry.knowledgeSpaceId)),
    ),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof upsertKnowledgeEntry>[0];
    const authContext = await getRequestAuthContext(request);
    requireBusinessTeamAccess(authContext, resolveSpaceBusinessTeamId(body.knowledgeSpaceId));
    const updatedBy = authContext?.user.email || authContext?.user.name || authContext?.user.id || null;
    const entry = await upsertKnowledgeEntry({ ...body, updatedBy });
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    if (error instanceof KnowledgeEntryConflictError) {
      return NextResponse.json(
        {
          ok: false,
          error: uiText(
            "ui.api.errors.knowledgeEntryConflict",
            "This knowledge entry was updated by another editor. Review the latest version before merging.",
          ),
          currentEntry: error.currentEntry,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveKnowledgeEntryFailed") },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  const authContext = await getRequestAuthContext(request);
  const entry = listLayeredKnowledge(1000).find((item) => item.id === body.id);
  requireBusinessTeamAccess(authContext, resolveSpaceBusinessTeamId(entry?.knowledgeSpaceId));
  deleteKnowledgeEntry(body.id);
  return NextResponse.json({ ok: true });
}
