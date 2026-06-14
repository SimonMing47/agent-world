import { NextResponse } from "next/server";
import { apiAccessErrorResponse, requireTaskRunActor } from "@/server/api-access-control";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  try {
    const resolved = await params;
    const { actor } = await requireTaskRunActor(request, resolved.id);
    const body = (await request.json()) as {
      status?: string;
      note?: string | null;
      updatedBy?: string | null;
    };

    const { triageTaskRunFinding } = await import("@/server/finding-triage-core");
    const result = triageTaskRunFinding({
      taskRunId: resolved.id,
      findingId: resolved.findingId,
      status: body.status,
      note: body.note,
      updatedBy: body.updatedBy ?? actor,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.server.findingTriage.failed") },
      { status: 400 },
    );
  }
}
