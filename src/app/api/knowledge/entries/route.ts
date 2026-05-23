import { NextResponse } from "next/server";
import {
  deleteKnowledgeEntry,
  listLayeredKnowledge,
  upsertKnowledgeEntry,
} from "@/server/openviking-core";
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

export async function GET() {
  const authContext = await getRequestAuthContext();
  return NextResponse.json({
    entries: listLayeredKnowledge(100).filter((entry) =>
      canAccessBusinessTeam(authContext, resolveSpaceBusinessTeamId(entry.knowledgeSpaceId)),
    ),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof upsertKnowledgeEntry>[0];
    const authContext = await getRequestAuthContext();
    requireBusinessTeamAccess(authContext, resolveSpaceBusinessTeamId(body.knowledgeSpaceId));
    const entry = await upsertKnowledgeEntry(body);
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
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
  const authContext = await getRequestAuthContext();
  const entry = listLayeredKnowledge(1000).find((item) => item.id === body.id);
  requireBusinessTeamAccess(authContext, resolveSpaceBusinessTeamId(entry?.knowledgeSpaceId));
  deleteKnowledgeEntry(body.id);
  return NextResponse.json({ ok: true });
}
