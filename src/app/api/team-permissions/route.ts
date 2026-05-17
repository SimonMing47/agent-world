import { NextResponse } from "next/server";
import { listTeamPermissionGrants, upsertTeamPermissionGrant } from "@/server/governance-core";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ grants: listTeamPermissionGrants() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertTeamPermissionGrant>[0];
  const grant = upsertTeamPermissionGrant(body);
  return NextResponse.json({ ok: true, grant });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertTeamPermissionGrant>[0];
  const grant = upsertTeamPermissionGrant(body);
  return NextResponse.json({ ok: true, grant });
}

