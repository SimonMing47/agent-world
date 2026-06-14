import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { apiAccessErrorResponse, requireTaskRunActor } from "@/server/api-access-control";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  try {
    const resolved = await params;
    const { actor } = await requireTaskRunActor(request, resolved.id);
    const body = (await request.json().catch(() => ({}))) as {
      requestedBy?: string | null;
    };
    const { createFindingRemediationTaskRun } = await import("@/server/queries");
    const result = createFindingRemediationTaskRun({
      taskRunId: resolved.id,
      findingId: resolved.findingId,
      requestedBy: body.requestedBy ?? actor,
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      taskRunId: result.taskRun?.id ?? null,
      detail: result.detail,
    });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.server.findingRemediation.failed") },
      { status: 400 },
    );
  }
}
