import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { canAccessBusinessTeam, getRequestAuthContext } from "@/server/auth-core";
import { queryOne, type AgentTeam, type ExecutionEnvironment, type TaskBlueprint } from "@/server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authContext = await getRequestAuthContext(request);
  if (!authContext) {
    return NextResponse.json(
      { ok: false, error: uiText("ui.api.errors.authenticationRequired", "Authentication required.") },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId");
  const blueprintId = url.searchParams.get("blueprintId");

  if (!teamId || !blueprintId) {
    return NextResponse.json(
      {
        ok: false,
        error: uiText(
          "ui.api.errors.knowledgeContextInputRequired",
          "teamId and blueprintId are required.",
        ),
      },
      { status: 400 },
    );
  }

  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", teamId);
  const blueprint = queryOne<TaskBlueprint>("SELECT * FROM task_blueprints WHERE id = ?", blueprintId);
  if (!team || !blueprint) {
    return NextResponse.json(
      {
        ok: false,
        error: uiText(
          "ui.api.errors.knowledgeContextNotFound",
          "Agent team or task definition does not exist.",
        ),
      },
      { status: 404 },
    );
  }
  const canReadContext =
    canAccessBusinessTeam(authContext, team.businessTeamId) &&
    canAccessBusinessTeam(authContext, blueprint.ownerBusinessTeamId) &&
    team.id === blueprint.teamId;
  if (!canReadContext) {
    return NextResponse.json(
      { ok: false, error: uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied.") },
      { status: 403 },
    );
  }

  const environment = blueprint.environmentId
    ? queryOne<ExecutionEnvironment>("SELECT * FROM execution_environments WHERE id = ?", blueprint.environmentId)
    : null;

  const { resolveTaskKnowledgeContext } = await import("@/server/knowledge-core");
  const context = resolveTaskKnowledgeContext({
    blueprint,
    team,
    environment,
    inputPayload: Object.fromEntries(url.searchParams.entries()),
  });

  return NextResponse.json({ ok: true, context });
}
