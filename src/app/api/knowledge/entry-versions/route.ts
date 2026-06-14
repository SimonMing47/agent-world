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
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get("entryId");
    if (!entryId) return NextResponse.json({ ok: false, error: uiText("ui.api.errors.entryIdRequired") }, { status: 400 });

    const { getKnowledgeEntry, listKnowledgeEntryVersions } = await import("@/server/knowledge-engine");
    const entry = getKnowledgeEntry(entryId);
    if (!entry) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.knowledgeEntryNotFound") }, { status: 404 });
    }
    assertBusinessTeamAccess(authContext, resolveKnowledgeSpaceBusinessTeamId(entry.knowledgeSpaceId));

    return NextResponse.json({ ok: true, versions: listKnowledgeEntryVersions(entryId) });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "knowledge-entry-console");
    const body = (await request.json()) as {
      action?: string;
      entryId?: string;
      versionId?: string;
      baseRevision?: number | null;
    };
    if (body.action !== "restore") {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.unsupportedAction") }, { status: 400 });
    }
    if (!body.entryId || !body.versionId) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.entryVersionInputRequired") }, { status: 400 });
    }

    const { getKnowledgeEntry, getKnowledgeEntryVersion, restoreKnowledgeEntryVersion } = await import("@/server/knowledge-engine");
    const entry = getKnowledgeEntry(body.entryId);
    const version = getKnowledgeEntryVersion(body.entryId, body.versionId);
    if (!entry || !version) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.knowledgeEntryVersionNotFound") }, { status: 404 });
    }
    assertBusinessTeamAccess(authContext, resolveKnowledgeSpaceBusinessTeamId(entry.knowledgeSpaceId));
    assertBusinessTeamAccess(authContext, resolveKnowledgeSpaceBusinessTeamId(version.knowledgeSpaceId));

    const updatedBy = authContext?.user.email || authContext?.user.name || authContext?.user.id || null;
    const restoredEntry = await restoreKnowledgeEntryVersion({
      entryId: body.entryId,
      versionId: body.versionId,
      baseRevision: body.baseRevision,
      updatedBy,
    });
    return NextResponse.json({ ok: true, entry: restoredEntry });
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
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : uiText("ui.api.errors.restoreKnowledgeEntryVersionFailed", "Failed to restore historical version."),
      },
      { status: 400 },
    );
  }
}
