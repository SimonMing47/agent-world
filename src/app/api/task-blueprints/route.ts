import { NextResponse } from "next/server";
import { canAccessBusinessTeam } from "@/server/auth-core";
import {
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  assertTaskBlueprintSaveAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { queryAll, type AgentTeam, type TaskBlueprint } from "@/server/db";
import { deleteManagedResource } from "@/server/governance-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

function listTaskBlueprints() {
  return queryAll<TaskBlueprint>(
    "SELECT * FROM task_blueprints WHERE status <> 'deleted' ORDER BY category ASC, name ASC",
  );
}

function listAgentTeams() {
  return queryAll<AgentTeam>("SELECT * FROM agent_teams ORDER BY updated_at DESC, name ASC");
}

export async function GET(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "task-blueprint-console");
    const rawBlueprints = listTaskBlueprints();
    const rawBlueprintById = new Map(rawBlueprints.map((blueprint) => [blueprint.id, blueprint]));
    const { getTaskBlueprintsSnapshot } = await import("@/server/queries");
    const snapshot = getTaskBlueprintsSnapshot();
    return NextResponse.json({
      ...snapshot,
      blueprints: snapshot.blueprints.filter((blueprint) =>
        canAccessBusinessTeam(authContext, rawBlueprintById.get(blueprint.id)?.ownerBusinessTeamId),
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
    const { authContext } = await requireAuthenticatedActor(request, "task-blueprint-console");
    const body = (await request.json()) as TaskBlueprint;
    const currentBlueprint = listTaskBlueprints().find((blueprint) => blueprint.id === body.id) ?? null;
    const targetAgentTeam = body.teamId ? listAgentTeams().find((team) => team.id === body.teamId) : null;
    if (body.teamId && !targetAgentTeam) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.agentTeamNotFound") }, { status: 404 });
    }
    assertTaskBlueprintSaveAccess(authContext, currentBlueprint, body.ownerBusinessTeamId, targetAgentTeam);
    const { upsertTaskBlueprint } = await import("@/server/queries");
    const blueprint = upsertTaskBlueprint(body);
    return NextResponse.json({ ok: true, blueprint });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveTaskBlueprintFailed") },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "task-blueprint-console");
    const body = (await request.json()) as TaskBlueprint;
    const currentBlueprint = listTaskBlueprints().find((blueprint) => blueprint.id === body.id) ?? null;
    const targetAgentTeam = body.teamId ? listAgentTeams().find((team) => team.id === body.teamId) : null;
    if (body.teamId && !targetAgentTeam) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.agentTeamNotFound") }, { status: 404 });
    }
    assertTaskBlueprintSaveAccess(authContext, currentBlueprint, body.ownerBusinessTeamId, targetAgentTeam);
    const { upsertTaskBlueprint } = await import("@/server/queries");
    const blueprint = upsertTaskBlueprint(body);
    return NextResponse.json({ ok: true, blueprint });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveTaskBlueprintFailed") },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "task-blueprint-console");
    const body = (await request.json()) as { id: string };
    const blueprint = listTaskBlueprints().find((item) => item.id === body.id);
    if (!blueprint) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.taskBlueprintNotFound") }, { status: 404 });
    }
    assertBusinessTeamAccess(authContext, blueprint.ownerBusinessTeamId);
    deleteManagedResource({ type: "task-blueprint", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
