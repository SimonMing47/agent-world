import { NextResponse } from "next/server";
import { deleteManagedResource } from "@/server/governance-core";
import { listAgentTeams, upsertAgentTeam } from "@/server/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ agentTeams: listAgentTeams() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof upsertAgentTeam>[0] & {
      members: Parameters<typeof upsertAgentTeam>[1];
      shares: Parameters<typeof upsertAgentTeam>[2];
    };
    const detail = upsertAgentTeam(body, body.members ?? [], body.shares ?? []);
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存 Agent Team 失败。" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof upsertAgentTeam>[0] & {
      members: Parameters<typeof upsertAgentTeam>[1];
      shares: Parameters<typeof upsertAgentTeam>[2];
    };
    const detail = upsertAgentTeam(body, body.members ?? [], body.shares ?? []);
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存 Agent Team 失败。" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteManagedResource({ type: "agent-team", id: body.id });
  return NextResponse.json({ ok: true });
}
