import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { assembleAgentTeamDraft } from "@/server/agent-team-core";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof assembleAgentTeamDraft>[0];
    const result = await assembleAgentTeamDraft(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : uiText("ui.api.errors.assembleAgentTeamFailed", "Agent Team assembly failed."),
      },
      { status: 400 },
    );
  }
}
