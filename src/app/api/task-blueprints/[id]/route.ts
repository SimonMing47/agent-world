import { NextResponse } from "next/server";
import { getTaskBlueprintDetail } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const detail = getTaskBlueprintDetail(resolved.id);
  if (!detail) {
    return NextResponse.json({ ok: false, error: "task blueprint not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, detail });
}
