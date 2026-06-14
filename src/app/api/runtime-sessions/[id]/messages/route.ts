import { NextResponse } from "next/server";
import { apiAccessErrorResponse, requireRuntimeSessionActor } from "@/server/api-access-control";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await params;
    const access = await requireRuntimeSessionActor(request, resolved.id, "runtime-session-console");
    const body = (await request.json()) as {
      content?: string;
      actorName?: string;
      deliveryMode?: "queue" | "append" | "interject" | "interrupt";
    };

    if (!body.content?.trim()) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.emptyMessage") }, { status: 400 });
    }

    const { submitRuntimeSessionMessage } = await import("@/server/runtime-session-core");
    const result = await submitRuntimeSessionMessage({
      sessionId: resolved.id,
      content: body.content.trim(),
      actorId: access.authContext.user.id,
      actorName: access.actor,
      deliveryMode: body.deliveryMode,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.sendMessageFailed") },
      { status: 400 },
    );
  }
}
