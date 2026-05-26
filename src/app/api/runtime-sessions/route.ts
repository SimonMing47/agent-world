import { NextResponse } from "next/server";
import { getRequestAuthContext } from "@/server/auth-core";
import { createRuntimeSession, listRuntimeSessions } from "@/server/runtime-session-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ runtimeSessions: listRuntimeSessions() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof createRuntimeSession>[0];
    const authContext = await getRequestAuthContext();
    const actorName = authContext?.user.name?.trim() || authContext?.user.email?.trim();
    if (!actorName) {
      return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
    }
    const detail = createRuntimeSession({
      ...body,
      createdBy: actorName,
    });
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.createRuntimeSessionFailed") },
      { status: 400 },
    );
  }
}
