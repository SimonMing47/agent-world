import { NextResponse } from "next/server";
import { deleteManagedResource } from "@/server/governance-core";
import { getTaskBlueprintsSnapshot, upsertTaskBlueprint } from "@/server/queries";
import { uiText } from "@/lib/language-pack";

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
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveTaskBlueprintFailed") },
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
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveTaskBlueprintFailed") },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteManagedResource({ type: "task-blueprint", id: body.id });
  return NextResponse.json({ ok: true });
}
