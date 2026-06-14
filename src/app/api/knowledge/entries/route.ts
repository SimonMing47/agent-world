import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import {
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { resolveKnowledgeSpaceBusinessTeamId } from "@/server/knowledge-session-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isKnowledgeEntryConflictError(error: unknown): error is { currentEntry: unknown } {
  return error instanceof Error && error.name === "KnowledgeEntryConflictError" && "currentEntry" in error;
}

export async function GET(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "knowledge-entry-console");
    const { listLayeredKnowledge, retryPendingKnowledgeSyncs } = await import("@/server/knowledge-engine");
    await retryPendingKnowledgeSyncs(3);
    return NextResponse.json({
      entries: listLayeredKnowledge(100).filter((entry) => {
        try {
          assertBusinessTeamAccess(authContext, resolveKnowledgeSpaceBusinessTeamId(entry.knowledgeSpaceId));
          return true;
        } catch {
          return false;
        }
      }),
    });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "knowledge-entry-console");
    const { upsertKnowledgeEntry } = await import("@/server/knowledge-engine");
    const body = (await request.json()) as Parameters<typeof upsertKnowledgeEntry>[0];
    assertBusinessTeamAccess(authContext, resolveKnowledgeSpaceBusinessTeamId(body.knowledgeSpaceId));
    const updatedBy = authContext?.user.email || authContext?.user.name || authContext?.user.id || null;
    const entry = await upsertKnowledgeEntry({ ...body, updatedBy });
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    if (isKnowledgeEntryConflictError(error)) {
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
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
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
  try {
    const { authContext } = await requireAuthenticatedActor(request, "knowledge-entry-console");
    const body = (await request.json()) as { id: string };
    const { deleteKnowledgeEntry, listLayeredKnowledge } = await import("@/server/knowledge-engine");
    const entry = listLayeredKnowledge(1000).find((item) => item.id === body.id);
    if (!entry) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.knowledgeEntryNotFound") }, { status: 404 });
    }
    assertBusinessTeamAccess(authContext, resolveKnowledgeSpaceBusinessTeamId(entry.knowledgeSpaceId));
    deleteKnowledgeEntry(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
