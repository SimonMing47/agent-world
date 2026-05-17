import { NextResponse } from "next/server";
import { deleteManagedResource } from "@/server/governance-core";
import { getAgentTeam, upsertAgentTeam } from "@/server/queries";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = getAgentTeam(id);
  if (!detail) {
    return NextResponse.json({ ok: false, error: uiText("ui.api.errors.agentTeamNotFound") }, { status: 404 });
  }
  return NextResponse.json({ ok: true, detail });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Parameters<typeof upsertAgentTeam>[0] & {
      members: Parameters<typeof upsertAgentTeam>[1];
      shares: Parameters<typeof upsertAgentTeam>[2];
    };
    const detail = upsertAgentTeam({ ...body, id }, body.members ?? [], body.shares ?? []);
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveAgentTeamFailed") },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  deleteManagedResource({ type: "agent-team", id });
  return NextResponse.json({ ok: true });
}
