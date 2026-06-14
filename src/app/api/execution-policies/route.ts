import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import {
  ApiAccessError,
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { canAccessBusinessTeam } from "@/server/auth-core";
import { queryAll, queryOne, type AgentTeam, type ExecutionPolicy } from "@/server/db";
import { deleteManagedResource, upsertExecutionPolicy } from "@/server/governance-core";

export const dynamic = "force-dynamic";

function listExecutionPolicies() {
  return queryAll<ExecutionPolicy>("SELECT * FROM execution_policies ORDER BY name ASC");
}

function getExecutionPolicy(id: string) {
  return queryOne<ExecutionPolicy>("SELECT * FROM execution_policies WHERE id = ?", id);
}

function getAgentTeam(teamId: string) {
  return queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", teamId);
}

function resolveExecutionPolicyBusinessTeamId(policy: Pick<ExecutionPolicy, "businessTeamId" | "teamId">) {
  if (policy.teamId) return getAgentTeam(policy.teamId)?.businessTeamId ?? null;
  return policy.businessTeamId;
}

function canReadExecutionPolicy(
  authContext: Awaited<ReturnType<typeof requireAuthenticatedActor>>["authContext"],
  policy: ExecutionPolicy,
) {
  return canAccessBusinessTeam(authContext, resolveExecutionPolicyBusinessTeamId(policy), {
    allowGlobal: !policy.businessTeamId && !policy.teamId,
  });
}

function assertAdminForGlobalPolicy(authContext: Awaited<ReturnType<typeof requireAuthenticatedActor>>["authContext"]) {
  if (authContext.user.isSystemAdmin !== 1) {
    throw new ApiAccessError(
      403,
      uiText("identityAccess.errors.adminRequired", "System administrator access is required."),
    );
  }
}

function assertExecutionPolicyWriteAccess(
  authContext: Awaited<ReturnType<typeof requireAuthenticatedActor>>["authContext"],
  policy: { businessTeamId?: string | null; teamId?: string | null },
) {
  if (policy.teamId) {
    const team = getAgentTeam(policy.teamId);
    if (!team) {
      throw new ApiAccessError(404, uiText("ui.api.errors.agentTeamNotFound", "Agent team does not exist."));
    }
    assertBusinessTeamAccess(authContext, team.businessTeamId);
    if (policy.businessTeamId && policy.businessTeamId !== team.businessTeamId) {
      throw new ApiAccessError(403, uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied."));
    }
    return;
  }
  if (policy.businessTeamId) {
    assertBusinessTeamAccess(authContext, policy.businessTeamId);
    return;
  }
  assertAdminForGlobalPolicy(authContext);
}

export async function GET(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "execution-policy-console");
    return NextResponse.json({
      policies: listExecutionPolicies().filter((policy) => canReadExecutionPolicy(authContext, policy)),
    });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "execution-policy-console");
    const body = (await request.json()) as Parameters<typeof upsertExecutionPolicy>[0];
    const current = body.id ? getExecutionPolicy(body.id) : null;
    if (body.id && !current) {
      throw new ApiAccessError(404, uiText("ui.api.errors.executionPolicyNotFound", "Execution policy does not exist."));
    }
    if (current) assertExecutionPolicyWriteAccess(authContext, current);
    assertExecutionPolicyWriteAccess(authContext, body);
    const policy = upsertExecutionPolicy(body);
    return NextResponse.json({ ok: true, policy });
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
    const { authContext } = await requireAuthenticatedActor(request, "execution-policy-console");
    const body = (await request.json()) as { id: string };
    const current = getExecutionPolicy(body.id);
    if (!current) {
      throw new ApiAccessError(404, uiText("ui.api.errors.executionPolicyNotFound", "Execution policy does not exist."));
    }
    assertExecutionPolicyWriteAccess(authContext, current);
    deleteManagedResource({ type: "execution-policy", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}
