import { NextResponse } from "next/server";
import { deleteManagedResource, upsertBusinessTeam } from "@/server/governance-core";
import { listBusinessTeams } from "@/server/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ teams: listBusinessTeams() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertBusinessTeam>[0];
  const team = upsertBusinessTeam(body);
  return NextResponse.json({ ok: true, team });
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteManagedResource({ type: "business-team", id: body.id });
  return NextResponse.json({ ok: true });
}
