import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { apiAccessErrorResponse, requireTaskRunActor } from "@/server/api-access-control";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await params;
    const { actor } = await requireTaskRunActor(request, resolved.id);
    const body = (await request.json()) as {
      note?: unknown;
      noteType?: unknown;
      createdBy?: string | null;
    };

    const { recordTaskRunTeamNote } = await import("@/server/task-run-team-note-core");
    const result = recordTaskRunTeamNote({
      taskRunId: resolved.id,
      note: body.note,
      noteType: body.noteType,
      createdBy: body.createdBy ?? actor,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.server.taskRunTeamNote.failed") },
      { status: 400 },
    );
  }
}
