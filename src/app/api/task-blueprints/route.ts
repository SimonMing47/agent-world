import { NextResponse } from "next/server";
import { getTaskBlueprintsSnapshot, upsertTaskBlueprint } from "@/server/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getTaskBlueprintsSnapshot());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof upsertTaskBlueprint>[0];
    const blueprint = upsertTaskBlueprint(body);
    return NextResponse.json({ ok: true, blueprint });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存任务定义失败。" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof upsertTaskBlueprint>[0];
    const blueprint = upsertTaskBlueprint(body);
    return NextResponse.json({ ok: true, blueprint });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存任务定义失败。" },
      { status: 400 },
    );
  }
}
