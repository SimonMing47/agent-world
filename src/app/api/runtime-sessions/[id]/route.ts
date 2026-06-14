import { NextResponse } from "next/server";
import { apiAccessErrorResponse, requireRuntimeSessionActor } from "@/server/api-access-control";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await params;
    await requireRuntimeSessionActor(_request, resolved.id, "runtime-session-console");
    const { getRuntimeSessionDetail } = await import("@/server/runtime-session-core");
    const detail = getRuntimeSessionDetail(resolved.id);
    if (!detail) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.sessionNotFound") }, { status: 404 });
    }
    return NextResponse.json({ detail });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await params;
    await requireRuntimeSessionActor(request, resolved.id, "runtime-session-console");
    const { deleteRuntimeSession } = await import("@/server/runtime-session-core");
    deleteRuntimeSession(resolved.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.deleteRuntimeSessionFailed") },
      { status: 400 },
    );
  }
}
