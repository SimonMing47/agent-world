import { NextResponse } from "next/server";
import { canAccessBusinessTeam, getRequestAuthContext, requireBusinessTeamAccess } from "@/server/auth-core";
import {
  bindKnowledgeSpace,
  createKnowledgeSpace,
  deleteKnowledgeSpace,
  listKnowledgeSpaceBindings,
  listKnowledgeSpaces,
  upsertKnowledgeSpace,
} from "@/server/knowledge-core";
import { listAgentTeams, listTaskBlueprints } from "@/server/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolveSpaceBusinessTeamId(space: { businessTeamId?: string | null; agentTeamId?: string | null }) {
  if (space.businessTeamId) return space.businessTeamId;
  if (!space.agentTeamId) return null;
  return listAgentTeams().find((team) => team.id === space.agentTeamId)?.businessTeamId ?? null;
}

function resolveBindingTargetBusinessTeamId(targetType: string, targetId: string) {
  if (targetType === "business_team") return targetId;
  if (targetType === "agent_team") return listAgentTeams().find((team) => team.id === targetId)?.businessTeamId ?? null;
  if (targetType === "task_blueprint") {
    return listTaskBlueprints().find((blueprint) => blueprint.id === targetId)?.ownerBusinessTeamId ?? null;
  }
  return null;
}

export async function GET() {
  const authContext = await getRequestAuthContext();
  const spaces = listKnowledgeSpaces().filter((space) =>
    canAccessBusinessTeam(authContext, resolveSpaceBusinessTeamId(space), { allowGlobal: space.visibility === "global" }),
  );
  const visibleSpaceIds = new Set(spaces.map((space) => space.id));
  return NextResponse.json({
    spaces,
    bindings: listKnowledgeSpaceBindings().filter((binding) => visibleSpaceIds.has(binding.knowledgeSpaceId)),
  });
}

export async function POST(request: Request) {
  const authContext = await getRequestAuthContext();
  const body = (await request.json().catch(() => ({}))) as {
    action?: "create_space" | "bind_space";
    name?: string;
    tenantSpaceId?: string | null;
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
    const space = listKnowledgeSpaces().find((item) => item.id === body.knowledgeSpaceId);
    requireBusinessTeamAccess(authContext, resolveSpaceBusinessTeamId(space ?? {}), {
      allowGlobal: space?.visibility === "global",
    });
    requireBusinessTeamAccess(authContext, resolveBindingTargetBusinessTeamId(body.targetType, body.targetId), {
      allowGlobal: body.targetType === "agent_definition",
    });

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
    tenantSpaceId: body.tenantSpaceId ?? null,
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
  requireBusinessTeamAccess(authContext, resolveSpaceBusinessTeamId(payload), {
    allowGlobal: body.visibility === "global" && authContext?.user.isSystemAdmin === 1,
  });
  const space = body.id ? upsertKnowledgeSpace(payload) : createKnowledgeSpace(payload);

  return NextResponse.json({ ok: true, space });
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  const authContext = await getRequestAuthContext();
  const space = listKnowledgeSpaces().find((item) => item.id === body.id);
  requireBusinessTeamAccess(authContext, resolveSpaceBusinessTeamId(space ?? {}), {
    allowGlobal: space?.visibility === "global",
  });
  deleteKnowledgeSpace(body.id);
  return NextResponse.json({ ok: true });
}
