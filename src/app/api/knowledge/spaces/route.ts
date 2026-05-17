import { NextResponse } from "next/server";
import {
  bindKnowledgeSpace,
  createKnowledgeSpace,
  listKnowledgeSpaceBindings,
  listKnowledgeSpaces,
} from "@/server/knowledge-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    spaces: listKnowledgeSpaces(),
    bindings: listKnowledgeSpaceBindings(),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: "create_space" | "bind_space";
    name?: string;
    slug?: string;
    spaceType?: "global" | "team" | "project" | "agent_team";
    businessTeamId?: string | null;
    agentTeamId?: string | null;
    projectKey?: string | null;
    description?: string;
    visibility?: "global" | "team" | "private";
    knowledgeSpaceId?: string;
    targetType?: "business_team" | "agent_team" | "task_blueprint" | "agent_definition" | "project";
    targetId?: string;
    accessLevel?: "read" | "write" | "archive";
    loadOrder?: number;
  };

  if (body.action === "bind_space") {
    if (!body.knowledgeSpaceId || !body.targetType || !body.targetId || !body.accessLevel) {
      return NextResponse.json(
        { ok: false, error: "knowledgeSpaceId, targetType, targetId and accessLevel are required" },
        { status: 400 },
      );
    }

    const binding = bindKnowledgeSpace({
      knowledgeSpaceId: body.knowledgeSpaceId,
      targetType: body.targetType,
      targetId: body.targetId,
      accessLevel: body.accessLevel,
      loadOrder: body.loadOrder,
    });

    return NextResponse.json({ ok: true, binding });
  }

  if (!body.name || !body.spaceType) {
    return NextResponse.json({ ok: false, error: "name and spaceType are required" }, { status: 400 });
  }

  const space = createKnowledgeSpace({
    name: body.name,
    slug: body.slug,
    spaceType: body.spaceType,
    businessTeamId: body.businessTeamId ?? null,
    agentTeamId: body.agentTeamId ?? null,
    projectKey: body.projectKey ?? null,
    description: body.description,
    visibility: body.visibility,
    bindToAgentTeam: Boolean(body.agentTeamId),
  });

  return NextResponse.json({ ok: true, space });
}
