import { NextResponse } from "next/server";
import { getTaskBlueprintPermissionPreview } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const preview = getTaskBlueprintPermissionPreview(resolved.id);
  if (!preview) {
    return NextResponse.json({ ok: false, error: "task blueprint not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, preview });
}
