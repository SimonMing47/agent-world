import { NextResponse } from "next/server";
import { queryOne, type AgentTeam, type ExecutionEnvironment, type TaskBlueprint } from "@/server/db";
import { resolveTaskKnowledgeContext } from "@/server/knowledge-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId");
  const blueprintId = url.searchParams.get("blueprintId");

  if (!teamId || !blueprintId) {
    return NextResponse.json({ ok: false, error: "teamId and blueprintId are required" }, { status: 400 });
  }

  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", teamId);
  const blueprint = queryOne<TaskBlueprint>("SELECT * FROM task_blueprints WHERE id = ?", blueprintId);
  if (!team || !blueprint) {
    return NextResponse.json({ ok: false, error: "agent team or task blueprint not found" }, { status: 404 });
  }

  const environment = blueprint.environmentId
    ? queryOne<ExecutionEnvironment>("SELECT * FROM execution_environments WHERE id = ?", blueprint.environmentId)
    : null;

  const context = resolveTaskKnowledgeContext({
    blueprint,
    team,
    environment,
    inputPayload: Object.fromEntries(url.searchParams.entries()),
  });

  return NextResponse.json({ ok: true, context });
}
