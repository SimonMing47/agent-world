import { NextResponse } from "next/server";
import { deleteRuntimeSession, getRuntimeSessionDetail } from "@/server/runtime-session-core";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const detail = getRuntimeSessionDetail(resolved.id);
  if (!detail) {
    return NextResponse.json({ error: "会话不存在。" }, { status: 404 });
  }
  return NextResponse.json({ detail });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await params;
    deleteRuntimeSession(resolved.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "删除运行时会话失败。" },
      { status: 400 },
    );
  }
}
