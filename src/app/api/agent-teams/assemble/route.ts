import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import {
  apiAccessErrorResponse,
  assertAgentTeamSaveAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { queryOne, type AgentTeam } from "@/server/db";

export const dynamic = "force-dynamic";

type AgentTeamActionBody = {
  team?: {
    id?: string;
    businessTeamId?: string | null;
  };
};

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "agent-team-console");
    const body = (await request.json()) as AgentTeamActionBody;
    const currentTeam = body.team?.id
      ? queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", body.team.id)
      : null;
    assertAgentTeamSaveAccess(authContext, currentTeam, body.team?.businessTeamId ?? null, []);
    const { assembleAgentTeamDraft } = await import("@/server/agent-team-core");
    const result = await assembleAgentTeamDraft(body as Parameters<typeof assembleAgentTeamDraft>[0]);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
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
