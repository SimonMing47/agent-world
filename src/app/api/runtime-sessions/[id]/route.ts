import { NextResponse } from "next/server";
import { getRuntimeSessionDetail } from "@/server/runtime-session-core";

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
