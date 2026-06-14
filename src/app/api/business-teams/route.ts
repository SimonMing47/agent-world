import { NextResponse } from "next/server";
import {
  filterBusinessTeamsForAuthContext,
} from "@/server/auth-core";
import {
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { queryAll, type BusinessTeam } from "@/server/db";
import { deleteManagedResource, upsertBusinessTeam } from "@/server/governance-core";

export const dynamic = "force-dynamic";

function listBusinessTeams() {
  return queryAll<BusinessTeam>("SELECT * FROM business_teams WHERE status <> 'deleted' ORDER BY name ASC");
}

export async function GET(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "business-team-console");
    return NextResponse.json({ teams: filterBusinessTeamsForAuthContext(listBusinessTeams(), authContext) });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "business-team-console");
    const body = (await request.json()) as Parameters<typeof upsertBusinessTeam>[0];
    const existing = body.id ? listBusinessTeams().find((team) => team.id === body.id) : null;
    if (existing) assertBusinessTeamAccess(authContext, existing.id);
    if (!existing || body.parentBusinessTeamId !== undefined) {
      assertBusinessTeamAccess(authContext, body.parentBusinessTeamId ?? null, {
        allowGlobal: authContext.user.isSystemAdmin === 1,
      });
    }
    const team = upsertBusinessTeam(body);
    return NextResponse.json({ ok: true, team });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Access denied" }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "business-team-console");
    const body = (await request.json()) as { id: string };
    assertBusinessTeamAccess(authContext, body.id);
    deleteManagedResource({ type: "business-team", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Access denied" }, { status: 403 });
  }
}
