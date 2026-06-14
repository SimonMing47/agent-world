import { NextResponse } from "next/server";
import {
  apiAccessErrorResponse,
  assertAgentTeamSaveAccess,
  assertAgentTeamWriteAccess,
  canReadAgentTeam,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { queryAll, queryOne, type AgentTeam, type AgentTeamMember, type AgentTeamShare } from "@/server/db";
import { deleteManagedResource } from "@/server/governance-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

type AgentTeamPayload = Pick<
  AgentTeam,
  | "id"
  | "businessTeamId"
  | "slug"
  | "name"
  | "description"
  | "leaderAgentId"
  | "workflowType"
  | "orchestrationPrompt"
  | "workflowDefinitionJson"
  | "inputSchemaJson"
  | "outputSchemaJson"
  | "maxConcurrency"
  | "timeoutMs"
  | "successRateThreshold"
  | "pricingModelJson"
  | "visibility"
  | "defaultExecutionPolicyId"
> & {
  members: Array<
    Pick<AgentTeamMember, "id" | "agentDefinitionId" | "memberRole" | "workInstruction" | "position" | "status">
  >;
  shares: Array<Pick<AgentTeamShare, "businessTeamId" | "accessLevel">>;
};

function getAgentTeamRecord(id: string) {
  return queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", id);
}

function listAgentTeamShares(teamId: string) {
  return queryAll<AgentTeamShare>("SELECT * FROM agent_team_shares WHERE agent_team_id = ? ORDER BY created_at ASC", teamId);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "agent-team-console");
    const { id } = await params;
    const team = getAgentTeamRecord(id);
    if (!team) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.agentTeamNotFound") }, { status: 404 });
    }
    if (!canReadAgentTeam(authContext, team, listAgentTeamShares(id))) {
      return NextResponse.json(
        { ok: false, error: uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied.") },
        { status: 403 },
      );
    }
    const { getAgentTeam } = await import("@/server/queries");
    const detail = getAgentTeam(id);
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "agent-team-console");
    const { id } = await params;
    const current = getAgentTeamRecord(id);
    if (!current) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.agentTeamNotFound") }, { status: 404 });
    }
    const body = (await request.json()) as AgentTeamPayload;
    assertAgentTeamSaveAccess(
      authContext,
      current,
      body.businessTeamId,
      (body.shares ?? []).map((share) => share.businessTeamId),
    );
    const { upsertAgentTeam } = await import("@/server/queries");
    const detail = upsertAgentTeam({ ...body, id }, body.members ?? [], body.shares ?? []);
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveAgentTeamFailed") },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "agent-team-console");
    const { id } = await params;
    const current = getAgentTeamRecord(id);
    if (!current) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.agentTeamNotFound") }, { status: 404 });
    }
    assertAgentTeamWriteAccess(authContext, current);
    deleteManagedResource({ type: "agent-team", id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
