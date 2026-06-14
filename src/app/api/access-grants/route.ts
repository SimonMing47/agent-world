import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import {
  ApiAccessError,
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { canAccessBusinessTeam } from "@/server/auth-core";
import { queryAll, queryOne, type AccessGrant, type AgentTeam } from "@/server/db";
import { deleteManagedResource, upsertAccessGrant } from "@/server/governance-core";

export const dynamic = "force-dynamic";

function listAccessGrants() {
  return queryAll<AccessGrant>("SELECT * FROM access_grants WHERE status <> 'deleted' ORDER BY created_at DESC");
}

function listAgentTeams() {
  return queryAll<AgentTeam>("SELECT * FROM agent_teams ORDER BY updated_at DESC, name ASC");
}

function getAccessGrant(id: string) {
  return queryOne<AccessGrant>("SELECT * FROM access_grants WHERE id = ?", id);
}

function getProviderTeam(teamId: string) {
  return queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", teamId);
}

function assertAccessGrantWriteAccess(
  authContext: Awaited<ReturnType<typeof requireAuthenticatedActor>>["authContext"],
  input: Pick<AccessGrant, "providerTeamId" | "consumerBusinessTeamId">,
) {
  const providerTeam = getProviderTeam(input.providerTeamId);
  if (!providerTeam) {
    throw new ApiAccessError(404, uiText("ui.api.errors.agentTeamNotFound", "Agent team does not exist."));
  }
  assertBusinessTeamAccess(authContext, providerTeam.businessTeamId);
  assertBusinessTeamAccess(authContext, input.consumerBusinessTeamId);
}

export async function GET(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "access-grant-console");
    const agentTeamById = new Map(listAgentTeams().map((team) => [team.id, team]));
    const grants = listAccessGrants().filter((grant) => {
      const providerBusinessTeamId = agentTeamById.get(grant.providerTeamId)?.businessTeamId ?? null;
      return (
        canAccessBusinessTeam(authContext, providerBusinessTeamId) ||
        canAccessBusinessTeam(authContext, grant.consumerBusinessTeamId)
      );
    });
    return NextResponse.json({ grants });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "access-grant-console");
    const body = (await request.json()) as Parameters<typeof upsertAccessGrant>[0];
    const current = body.id ? getAccessGrant(body.id) : null;
    if (body.id && !current) {
      throw new ApiAccessError(404, uiText("ui.api.errors.accessGrantNotFound", "Access grant does not exist."));
    }
    if (current) assertAccessGrantWriteAccess(authContext, current);
    assertAccessGrantWriteAccess(authContext, body);
    const grant = upsertAccessGrant(body);
    return NextResponse.json({ ok: true, grant });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "access-grant-console");
    const body = (await request.json()) as { id: string };
    const current = getAccessGrant(body.id);
    if (!current) {
      throw new ApiAccessError(404, uiText("ui.api.errors.accessGrantNotFound", "Access grant does not exist."));
    }
    assertAccessGrantWriteAccess(authContext, current);
    deleteManagedResource({ type: "access-grant", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}
