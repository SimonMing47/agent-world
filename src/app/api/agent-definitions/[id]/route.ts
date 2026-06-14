import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import {
  apiAccessErrorResponse,
  assertAgentDefinitionSaveAccess,
  requireAgentDefinitionReader,
  requireAgentDefinitionWriter,
} from "@/server/api-access-control";
import type { AgentDefinition } from "@/server/db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AgentDefinitionInput = Pick<
  AgentDefinition,
  | "id"
  | "tenantSpaceId"
  | "ownerBusinessTeamId"
  | "ownerUserId"
  | "sourceAgentId"
  | "slug"
  | "name"
  | "role"
  | "description"
  | "systemPrompt"
  | "model"
  | "defaultProviderProfileId"
  | "defaultRuntimeBindingId"
  | "avatarConfigJson"
  | "capabilityProfileJson"
  | "toolBindingsJson"
  | "harnessConfigJson"
  | "permissionPolicyJson"
  | "memoryScope"
  | "tagsJson"
  | "visibility"
  | "status"
  | "validationStatus"
  | "lastValidatedAt"
  | "lastValidationSummary"
> & {
  shareBusinessTeamIds?: string[];
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireAgentDefinitionReader(request, id, "agent-definition-console");
    const { getAgentDefinition } = await import("@/server/queries");
    const detail = getAgentDefinition(id);
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireAgentDefinitionWriter(request, id, "agent-definition-console");
    const body = (await request.json()) as AgentDefinitionInput;
    const targetOwnerBusinessTeamId =
      body.ownerBusinessTeamId === undefined ? access.definition.ownerBusinessTeamId : body.ownerBusinessTeamId;
    assertAgentDefinitionSaveAccess(
      access.authContext,
      access.definition,
      targetOwnerBusinessTeamId,
      body.shareBusinessTeamIds ?? [],
    );
    const { upsertAgentDefinition } = await import("@/server/queries");
    const detail = upsertAgentDefinition({ ...body, id }, body.shareBusinessTeamIds ?? []);
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveAgentDefinitionFailed") },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireAgentDefinitionWriter(request, id, "agent-definition-console");
    const { deleteManagedResource } = await import("@/server/governance-core");
    deleteManagedResource({ type: "agent-definition", id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveAgentDefinitionFailed") },
      { status: 400 },
    );
  }
}
