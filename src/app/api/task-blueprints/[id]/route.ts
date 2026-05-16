import { NextResponse } from "next/server";
import { getTaskBlueprintDetail, upsertTaskBlueprint } from "@/server/queries";

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const body = (await request.json()) as Parameters<typeof upsertTaskBlueprint>[0];
  const blueprint = upsertTaskBlueprint({
    ...body,
    id: resolved.id,
  });
  return NextResponse.json({ ok: true, blueprint });
}
