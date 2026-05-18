import { NextResponse } from "next/server";
import { deleteManagedResource, listTeamAssetGrants, upsertTeamAssetGrant } from "@/server/governance-core";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ grants: listTeamAssetGrants() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertTeamAssetGrant>[0];
  const grant = upsertTeamAssetGrant(body);
  return NextResponse.json({ ok: true, grant });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertTeamAssetGrant>[0];
  const grant = upsertTeamAssetGrant(body);
  return NextResponse.json({ ok: true, grant });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteManagedResource({ type: "team-asset", id: body.id });
  return NextResponse.json({ ok: true });
}
