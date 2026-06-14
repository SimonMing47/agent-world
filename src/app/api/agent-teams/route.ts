import { NextResponse } from "next/server";
import {
  apiAccessErrorResponse,
  assertAgentTeamSaveAccess,
  assertAgentTeamWriteAccess,
  canReadAgentTeam,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { queryAll, type AgentTeam, type AgentTeamMember, type AgentTeamShare } from "@/server/db";
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

function listAgentTeams() {
  return queryAll<AgentTeam>("SELECT * FROM agent_teams ORDER BY updated_at DESC, name ASC");
}

function listAgentTeamShares() {
  return queryAll<AgentTeamShare>("SELECT * FROM agent_team_shares ORDER BY created_at ASC");
}

export async function GET(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "agent-team-console");
    const shares = listAgentTeamShares();
    return NextResponse.json({
      agentTeams: listAgentTeams().filter((team) =>
        canReadAgentTeam(
          authContext,
          team,
          shares.filter((share) => share.agentTeamId === team.id),
        ),
      ),
    });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "agent-team-console");
    const body = (await request.json()) as AgentTeamPayload;
    const currentTeam = listAgentTeams().find((team) => team.id === body.id) ?? null;
    assertAgentTeamSaveAccess(
      authContext,
      currentTeam,
      body.businessTeamId,
      (body.shares ?? []).map((share) => share.businessTeamId),
    );
    const { upsertAgentTeam } = await import("@/server/queries");
    const detail = upsertAgentTeam(body, body.members ?? [], body.shares ?? []);
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

export async function PATCH(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "agent-team-console");
    const body = (await request.json()) as AgentTeamPayload;
    const currentTeam = listAgentTeams().find((team) => team.id === body.id) ?? null;
    assertAgentTeamSaveAccess(
      authContext,
      currentTeam,
      body.businessTeamId,
      (body.shares ?? []).map((share) => share.businessTeamId),
    );
    const { upsertAgentTeam } = await import("@/server/queries");
    const detail = upsertAgentTeam(body, body.members ?? [], body.shares ?? []);
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

export async function DELETE(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "agent-team-console");
    const body = (await request.json()) as { id: string };
    const team = listAgentTeams().find((item) => item.id === body.id);
    if (!team) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.agentTeamNotFound") }, { status: 404 });
    }
    assertAgentTeamWriteAccess(authContext, team);
    deleteManagedResource({ type: "agent-team", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
