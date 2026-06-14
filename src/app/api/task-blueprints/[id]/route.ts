import { NextResponse } from "next/server";
import { canAccessBusinessTeam } from "@/server/auth-core";
import {
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  assertTaskBlueprintSaveAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { queryAll, queryOne, type AgentTeam, type TaskBlueprint } from "@/server/db";
import { deleteManagedResource } from "@/server/governance-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

function getTaskBlueprintRecord(id: string) {
  return queryOne<TaskBlueprint>("SELECT * FROM task_blueprints WHERE id = ? AND status <> 'deleted'", id);
}

function listTaskBlueprints() {
  return queryAll<TaskBlueprint>(
    "SELECT * FROM task_blueprints WHERE status <> 'deleted' ORDER BY category ASC, name ASC",
  );
}

function listAgentTeams() {
  return queryAll<AgentTeam>("SELECT * FROM agent_teams ORDER BY updated_at DESC, name ASC");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "task-blueprint-console");
    const resolved = await params;
    const blueprint = getTaskBlueprintRecord(resolved.id);
    if (!blueprint) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.taskBlueprintNotFound") }, { status: 404 });
    }
    if (!canAccessBusinessTeam(authContext, blueprint.ownerBusinessTeamId)) {
      return NextResponse.json(
        { ok: false, error: uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied.") },
        { status: 403 },
      );
    }
    const { getTaskBlueprintDetail } = await import("@/server/queries");
    const detail = getTaskBlueprintDetail(resolved.id);
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
    const { authContext } = await requireAuthenticatedActor(request, "task-blueprint-console");
    const resolved = await params;
    const currentBlueprint = listTaskBlueprints().find((blueprint) => blueprint.id === resolved.id) ?? null;
    if (!currentBlueprint) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.taskBlueprintNotFound") }, { status: 404 });
    }
    const body = (await request.json()) as TaskBlueprint;
    const targetAgentTeam = body.teamId ? listAgentTeams().find((team) => team.id === body.teamId) : null;
    if (body.teamId && !targetAgentTeam) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.agentTeamNotFound") }, { status: 404 });
    }
    assertTaskBlueprintSaveAccess(authContext, currentBlueprint, body.ownerBusinessTeamId, targetAgentTeam);
    const { upsertTaskBlueprint } = await import("@/server/queries");
    const blueprint = upsertTaskBlueprint({
      ...body,
      id: resolved.id,
    });
    return NextResponse.json({ ok: true, blueprint });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "task-blueprint-console");
    const { id } = await params;
    const blueprint = getTaskBlueprintRecord(id);
    if (!blueprint) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.taskBlueprintNotFound") }, { status: 404 });
    }
    assertBusinessTeamAccess(authContext, blueprint.ownerBusinessTeamId);
    deleteManagedResource({ type: "task-blueprint", id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
