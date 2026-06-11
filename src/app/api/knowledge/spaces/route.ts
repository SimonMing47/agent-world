import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { type KnowledgeCategory } from "@/lib/knowledge-categories";
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

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function knowledgeSpaceErrorResponse(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : "";
  const duplicateSlugCoreMessage = uiText(
    "ui.server.knowledge.spaceDuplicateSlug",
    "Knowledge space slug already exists. Choose another slug.",
  );
  const isDuplicateSlug =
    rawMessage.includes(duplicateSlugCoreMessage) || rawMessage.includes("UNIQUE constraint failed: knowledge_spaces.slug");
  const isAccessError =
    rawMessage.includes("Authentication required") || rawMessage.includes("access denied") || rawMessage.includes("Access denied");
  const message = isDuplicateSlug
    ? uiText(
        "ui.api.errors.knowledgeSpaceDuplicateSlug",
        "Knowledge space slug already exists. Choose another name or slug.",
      )
    : rawMessage ||
      uiText("ui.api.errors.saveKnowledgeSpaceFailed", "Failed to save knowledge space. Try again later.");
  const status = isAccessError ? 403 : isDuplicateSlug ? 409 : 400;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: Request) {
  const authContext = await getRequestAuthContext(request);
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
  const authContext = await getRequestAuthContext(request);
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
    knowledgeCategory?: KnowledgeCategory;
    repositoryName?: string;
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

  const name = textValue(body.name);
  const slug = textValue(body.slug) || undefined;
  const retentionPolicyJson = textValue(body.retentionPolicyJson) || "{}";

  if (!name || !body.spaceType) {
    return NextResponse.json({ ok: false, error: "name and spaceType are required" }, { status: 400 });
  }

  let retentionPolicy: Record<string, unknown> | undefined;
  if (retentionPolicyJson) {
    try {
      const parsed = JSON.parse(retentionPolicyJson) as unknown;
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
    name,
    slug,
    spaceType: body.spaceType,
    knowledgeCategory: body.knowledgeCategory,
    repositoryName: body.repositoryName,
    businessTeamId: body.businessTeamId ?? null,
    agentTeamId: body.agentTeamId ?? null,
    projectKey: textValue(body.projectKey) || null,
    description: typeof body.description === "string" ? body.description : "",
    visibility: body.visibility,
    status: body.status,
    retentionPolicyJson,
    retentionPolicy,
    bindToAgentTeam: Boolean(body.agentTeamId),
  };
  try {
    requireBusinessTeamAccess(authContext, resolveSpaceBusinessTeamId(payload), {
      allowGlobal: body.visibility === "global" && authContext?.user.isSystemAdmin === 1,
    });
    const space = body.id ? upsertKnowledgeSpace(payload) : createKnowledgeSpace(payload);

    return NextResponse.json({ ok: true, space });
  } catch (error) {
    return knowledgeSpaceErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  const authContext = await getRequestAuthContext(request);
  const space = listKnowledgeSpaces().find((item) => item.id === body.id);
  requireBusinessTeamAccess(authContext, resolveSpaceBusinessTeamId(space ?? {}), {
    allowGlobal: space?.visibility === "global",
  });
  deleteKnowledgeSpace(body.id);
  return NextResponse.json({ ok: true });
}
