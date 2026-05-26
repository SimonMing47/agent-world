import { NextResponse } from "next/server";
import { getRequestAuthContext } from "@/server/auth-core";
import { submitRuntimeSessionMessage } from "@/server/runtime-session-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const body = (await request.json()) as {
    content?: string;
    actorName?: string;
    deliveryMode?: "queue" | "append" | "interject" | "interrupt";
  };
  const authContext = await getRequestAuthContext();
  const actorName = authContext?.user.name?.trim() || authContext?.user.email?.trim();

  if (!body.content?.trim()) {
    return NextResponse.json({ error: uiText("ui.api.errors.emptyMessage") }, { status: 400 });
  }

  if (!actorName) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const result = await submitRuntimeSessionMessage({
      sessionId: resolved.id,
      content: body.content.trim(),
      actorId: authContext?.user.id ?? null,
      actorName,
      deliveryMode: body.deliveryMode,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.sendMessageFailed") },
      { status: 400 },
    );
  }
}
