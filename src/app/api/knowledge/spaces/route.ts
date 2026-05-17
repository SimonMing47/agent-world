import { NextResponse } from "next/server";
import {
  bindKnowledgeSpace,
  createKnowledgeSpace,
  deleteKnowledgeSpace,
  listKnowledgeSpaceBindings,
  listKnowledgeSpaces,
  upsertKnowledgeSpace,
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
    id?: string;
    status?: string;
    retentionPolicyJson?: string;
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

  let retentionPolicy: Record<string, unknown> | undefined;
  if (body.retentionPolicyJson) {
    try {
      const parsed = JSON.parse(body.retentionPolicyJson) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ ok: false, error: "retentionPolicyJson must be a JSON object" }, { status: 400 });
      }
      retentionPolicy = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "retentionPolicyJson must be valid JSON" }, { status: 400 });
    }
  }

  const payload = {
    id: body.id,
    name: body.name,
    slug: body.slug,
    spaceType: body.spaceType,
    businessTeamId: body.businessTeamId ?? null,
    agentTeamId: body.agentTeamId ?? null,
    projectKey: body.projectKey ?? null,
    description: body.description,
    visibility: body.visibility,
    status: body.status,
    retentionPolicyJson: body.retentionPolicyJson,
    retentionPolicy,
    bindToAgentTeam: Boolean(body.agentTeamId),
  };
  const space = body.id ? upsertKnowledgeSpace(payload) : createKnowledgeSpace(payload);

  return NextResponse.json({ ok: true, space });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteKnowledgeSpace(body.id);
  return NextResponse.json({ ok: true });
}
