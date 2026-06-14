import { NextResponse } from "next/server";
import { filterByBusinessTeamAccess } from "@/server/auth-core";
import {
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
  requireTeamPermissionGrantActor,
} from "@/server/api-access-control";
import {
  deleteManagedResource,
  listTeamMembers,
  listTeamPermissionGrants,
  upsertTeamPermissionGrant,
} from "@/server/governance-core";
import type { TeamPermissionGrant } from "@/server/db";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

type TeamPermissionGrantInput = Parameters<typeof upsertTeamPermissionGrant>[0];

function assertMemberBelongsToTeam(memberId: string | null | undefined, businessTeamId: string | null | undefined) {
  if (!memberId) return;
  const member = listTeamMembers().find((item) => item.id === memberId);
  if (!member) {
    throw new Error(uiText("ui.api.errors.teamMemberNotFound", "Team member does not exist."));
  }
  if (member.businessTeamId !== businessTeamId) {
    throw new Error(uiText("ui.api.errors.teamMemberTeamMismatch", "Team member does not belong to this business team."));
  }
}

export async function GET(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "team-permission-console");
    return NextResponse.json({
      grants: filterByBusinessTeamAccess(
        listTeamPermissionGrants(),
        access.authContext,
        (grant) => grant.businessTeamId,
      ),
    });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "team-permission-console");
    const body = (await request.json()) as TeamPermissionGrantInput;
    const current = body.id ? listTeamPermissionGrants().find((grant) => grant.id === body.id) : null;
    if (current) {
      assertBusinessTeamAccess(access.authContext, current.businessTeamId);
    }
    const targetBusinessTeamId = body.businessTeamId ?? current?.businessTeamId;
    assertBusinessTeamAccess(access.authContext, targetBusinessTeamId);
    assertMemberBelongsToTeam(body.memberId ?? current?.memberId, targetBusinessTeamId);
    const grant = upsertTeamPermissionGrant(body);
    return NextResponse.json({ ok: true, grant });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveTeamPermissionFailed") },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  try {
    await requireAuthenticatedActor(request, "team-permission-console");
    const body = (await request.json()) as Pick<TeamPermissionGrant, "id">;
    await requireTeamPermissionGrantActor(request, body.id, "team-permission-console");
    deleteManagedResource({ type: "team-permission", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveTeamPermissionFailed") },
      { status: 400 },
    );
  }
}
