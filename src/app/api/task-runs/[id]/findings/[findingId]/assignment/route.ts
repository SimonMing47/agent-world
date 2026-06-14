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
      action?: "claim" | "release";
      assignedTo?: string | null;
      note?: string | null;
      updatedBy?: string | null;
    };
    const isRelease = body.action === "release" || body.assignedTo === null;
    const assignedTo = isRelease
      ? null
      : body.assignedTo?.trim() || actor;

    const { assignTaskRunFinding } = await import("@/server/finding-assignment-core");
    const result = assignTaskRunFinding({
      taskRunId: resolved.id,
      findingId: resolved.findingId,
      assignedTo,
      note: body.note,
      updatedBy: body.updatedBy ?? actor,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.server.findingAssignment.failed") },
      { status: 400 },
    );
  }
}
