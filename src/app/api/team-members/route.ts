import { NextResponse } from "next/server";
import { deleteManagedResource, importTeamMembersFromRows, listTeamMembers, upsertTeamMember } from "@/server/governance-core";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ members: listTeamMembers() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as
    | (Parameters<typeof upsertTeamMember>[0] & { mode?: "single" })
    | ({ mode: "import"; tenantSpaceId: string; businessTeamId: string; rows: string });

  if (body.mode === "import") {
    const members = importTeamMembersFromRows(body);
    return NextResponse.json({ ok: true, members });
  }

  const member = upsertTeamMember(body);
  return NextResponse.json({ ok: true, member });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertTeamMember>[0];
  const member = upsertTeamMember(body);
  return NextResponse.json({ ok: true, member });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteManagedResource({ type: "team-member", id: body.id });
  return NextResponse.json({ ok: true });
}
