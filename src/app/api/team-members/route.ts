import { NextResponse } from "next/server";
import { getRequestAuthContext, requireBusinessTeamAccess } from "@/server/auth-core";
import { deleteManagedResource, importTeamMembersFromRows, listTeamMembers, upsertTeamMember } from "@/server/governance-core";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authContext = await getRequestAuthContext(request);
  return NextResponse.json({
    members: listTeamMembers().filter((member) =>
      authContext?.accessibleBusinessTeamIds.includes(member.businessTeamId) || authContext?.user.isSystemAdmin === 1,
    ),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as
    | (Parameters<typeof upsertTeamMember>[0] & { mode?: "single" })
    | ({ mode: "import"; tenantSpaceId: string; businessTeamId: string; rows: string });

  if (body.mode === "import") {
    const authContext = await getRequestAuthContext(request);
    requireBusinessTeamAccess(authContext, body.businessTeamId);
    const members = importTeamMembersFromRows(body);
    return NextResponse.json({ ok: true, members });
  }

  const authContext = await getRequestAuthContext(request);
  requireBusinessTeamAccess(authContext, body.businessTeamId);
  const member = upsertTeamMember(body);
  return NextResponse.json({ ok: true, member });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertTeamMember>[0];
  const authContext = await getRequestAuthContext(request);
  requireBusinessTeamAccess(authContext, body.businessTeamId);
  const member = upsertTeamMember(body);
  return NextResponse.json({ ok: true, member });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  const authContext = await getRequestAuthContext(request);
  const member = listTeamMembers().find((item) => item.id === body.id);
  requireBusinessTeamAccess(authContext, member?.businessTeamId);
  deleteManagedResource({ type: "team-member", id: body.id });
  return NextResponse.json({ ok: true });
}
