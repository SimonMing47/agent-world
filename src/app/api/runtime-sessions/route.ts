import { NextResponse } from "next/server";
import { createRuntimeSession, listRuntimeSessions } from "@/server/runtime-session-core";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ runtimeSessions: listRuntimeSessions() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof createRuntimeSession>[0];
    const detail = createRuntimeSession(body);
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "创建运行时会话失败。" },
      { status: 400 },
    );
  }
}
