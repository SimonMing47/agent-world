import { NextResponse } from "next/server";
import { canAccessBusinessTeam } from "@/server/auth-core";
import { apiAccessErrorResponse, requireAuthenticatedActor } from "@/server/api-access-control";
import { queryOne, type TaskBlueprint } from "@/server/db";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

function getTaskBlueprintRecord(id: string) {
  return queryOne<TaskBlueprint>("SELECT * FROM task_blueprints WHERE id = ? AND status <> 'deleted'", id);
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
    const { getTaskBlueprintPermissionPreview } = await import("@/server/queries");
    const preview = getTaskBlueprintPermissionPreview(resolved.id);
    if (!preview) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.taskBlueprintNotFound") }, { status: 404 });
    }
    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
