import { NextResponse } from "next/server";
import { filterByBusinessTeamAccess } from "@/server/auth-core";
import {
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
  requireTeamMemberActor,
} from "@/server/api-access-control";
import { deleteManagedResource, importTeamMembersFromRows, listTeamMembers, upsertTeamMember } from "@/server/governance-core";
import type { TeamMember } from "@/server/db";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "team-member-console");
    return NextResponse.json({
      members: filterByBusinessTeamAccess(listTeamMembers(), access.authContext, (member) => member.businessTeamId),
    });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "team-member-console");
    const body = (await request.json()) as
      | (Parameters<typeof upsertTeamMember>[0] & { mode?: "single" })
      | ({ mode: "import"; tenantSpaceId: string; businessTeamId: string; rows: string });

    if (body.mode === "import") {
      assertBusinessTeamAccess(access.authContext, body.businessTeamId);
      const members = importTeamMembersFromRows(body);
      return NextResponse.json({ ok: true, members });
    }

    const current = body.id ? listTeamMembers().find((member) => member.id === body.id) : null;
    if (current) {
      assertBusinessTeamAccess(access.authContext, current.businessTeamId);
    }
    assertBusinessTeamAccess(access.authContext, body.businessTeamId ?? current?.businessTeamId);
    const member = upsertTeamMember(body as Parameters<typeof upsertTeamMember>[0]);
    return NextResponse.json({ ok: true, member });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveTeamMemberFailed") },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  try {
    await requireAuthenticatedActor(request, "team-member-console");
    const body = (await request.json()) as Pick<TeamMember, "id">;
    await requireTeamMemberActor(request, body.id, "team-member-console");
    deleteManagedResource({ type: "team-member", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveTeamMemberFailed") },
      { status: 400 },
    );
  }
}
