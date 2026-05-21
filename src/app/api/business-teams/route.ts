import { NextResponse } from "next/server";
import {
  filterBusinessTeamsForAuthContext,
  getRequestAuthContext,
  requireBusinessTeamAccess,
} from "@/server/auth-core";
import { deleteManagedResource, upsertBusinessTeam } from "@/server/governance-core";
import { listBusinessTeams } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const authContext = await getRequestAuthContext();
  return NextResponse.json({ teams: filterBusinessTeamsForAuthContext(listBusinessTeams(), authContext) });
}

export async function POST(request: Request) {
  try {
    const authContext = await getRequestAuthContext();
    const body = (await request.json()) as Parameters<typeof upsertBusinessTeam>[0];
    const existing = body.id ? listBusinessTeams().find((team) => team.id === body.id) : null;
    requireBusinessTeamAccess(authContext, existing?.id ?? body.parentBusinessTeamId ?? null, {
      allowGlobal: authContext?.user.isSystemAdmin === 1,
    });
    const team = upsertBusinessTeam(body);
    return NextResponse.json({ ok: true, team });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Access denied" }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  try {
    const authContext = await getRequestAuthContext();
    const body = (await request.json()) as { id: string };
    requireBusinessTeamAccess(authContext, body.id);
    deleteManagedResource({ type: "business-team", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Access denied" }, { status: 403 });
  }
}
