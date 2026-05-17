import { NextResponse } from "next/server";
import { submitRuntimeSessionMessage } from "@/server/runtime-session-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const body = (await request.json()) as { content?: string; actorName?: string };

  if (!body.content?.trim()) {
    return NextResponse.json({ error: uiText("ui.api.errors.emptyMessage") }, { status: 400 });
  }

  try {
    const result = await submitRuntimeSessionMessage({
      sessionId: resolved.id,
      content: body.content.trim(),
      actorName: body.actorName?.trim() || "Operator",
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.sendMessageFailed") },
      { status: 400 },
    );
  }
}
