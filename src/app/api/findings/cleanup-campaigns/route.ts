import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import {
  ApiAccessError,
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { queryOne, type AgentTeam } from "@/server/db";
import { createFindingCleanupCampaignTaskRun } from "@/server/finding-cleanup-campaign-core";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      scope?: unknown;
      limit?: unknown;
      teamId?: unknown;
      requestedBy?: string | null;
    };
    const { actor, authContext } = await requireAuthenticatedActor(request);
    const requestedTeamId = typeof body.teamId === "string" && body.teamId.trim() ? body.teamId.trim() : null;
    if (!requestedTeamId) {
      assertBusinessTeamAccess(authContext, null, { allowGlobal: true });
    }
    if (requestedTeamId) {
      const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", requestedTeamId);
      if (!team) {
        throw new ApiAccessError(404, uiText("ui.api.errors.agentTeamNotFound", "Agent team does not exist."));
      }
      assertBusinessTeamAccess(authContext, team.businessTeamId);
    }
    const result = createFindingCleanupCampaignTaskRun({
      scope: body.scope,
      limit: body.limit,
      teamId: requestedTeamId,
      requestedBy: body.requestedBy ?? actor,
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      taskRunId: result.taskRun?.id ?? null,
      findingCount: result.findingCount,
      sourceFindingIds: result.sourceFindingIds,
    });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.server.findingCleanupCampaign.failed") },
      { status: 400 },
    );
  }
}
