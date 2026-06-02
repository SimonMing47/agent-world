import { NextResponse } from "next/server";
import { canAccessBusinessTeam, getRequestAuthContext, requireBusinessTeamAccess } from "@/server/auth-core";
import { deleteManagedResource } from "@/server/governance-core";
import { getTaskBlueprintDetail, upsertTaskBlueprint } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const authContext = await getRequestAuthContext(request);
  const detail = getTaskBlueprintDetail(resolved.id);
  if (!detail) {
    return NextResponse.json({ ok: false, error: "task blueprint not found" }, { status: 404 });
  }
  if (!canAccessBusinessTeam(authContext, detail.blueprint.ownerBusinessTeamId)) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }
  return NextResponse.json({ ok: true, detail });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const body = (await request.json()) as Parameters<typeof upsertTaskBlueprint>[0];
  const authContext = await getRequestAuthContext(request);
  requireBusinessTeamAccess(authContext, body.ownerBusinessTeamId);
  const blueprint = upsertTaskBlueprint({
    ...body,
    id: resolved.id,
  });
  return NextResponse.json({ ok: true, blueprint });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authContext = await getRequestAuthContext(request);
  const detail = getTaskBlueprintDetail(id);
  requireBusinessTeamAccess(authContext, detail?.blueprint.ownerBusinessTeamId);
  deleteManagedResource({ type: "task-blueprint", id });
  return NextResponse.json({ ok: true });
}
