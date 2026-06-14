import { NextResponse } from "next/server";
import { apiAccessErrorResponse, requireTaskRunActor } from "@/server/api-access-control";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  try {
    const { actor } = await requireTaskRunActor(request, resolved.id);
    const body = (await request.json().catch(() => ({}))) as { requestedBy?: string };
    const { resumeTaskRun } = await import("@/server/queries");
    const detail = resumeTaskRun(resolved.id, body.requestedBy ?? actor);
    return NextResponse.json({ detail });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
