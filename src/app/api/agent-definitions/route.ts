import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import {
  apiAccessErrorResponse,
  assertAgentDefinitionSaveAccess,
  canReadAgentDefinition,
  requireAgentDefinitionWriter,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import type { AgentDefinition } from "@/server/db";

export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "agent-definition-console");
    const { listAgentDefinitions, listAgentDefinitionShares } = await import("@/server/queries");
    const shares = listAgentDefinitionShares();
    const sharesByDefinitionId = new Map<string, typeof shares>();
    for (const share of shares) {
      const definitionShares = sharesByDefinitionId.get(share.agentDefinitionId) ?? [];
      definitionShares.push(share);
      sharesByDefinitionId.set(share.agentDefinitionId, definitionShares);
    }
    const agentDefinitions = listAgentDefinitions().filter((definition) =>
      canReadAgentDefinition(access.authContext, definition, sharesByDefinitionId.get(definition.id) ?? []),
    );
    return NextResponse.json({ agentDefinitions });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

async function saveAgentDefinition(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "agent-definition-console");
    const body = (await request.json()) as AgentDefinitionInput;
    const { listAgentDefinitions, upsertAgentDefinition } = await import("@/server/queries");
    const current = listAgentDefinitions().find((definition) => definition.id === body.id) ?? null;
    const targetOwnerBusinessTeamId =
      body.ownerBusinessTeamId === undefined ? current?.ownerBusinessTeamId ?? null : body.ownerBusinessTeamId;
    assertAgentDefinitionSaveAccess(
      access.authContext,
      current,
      targetOwnerBusinessTeamId,
      body.shareBusinessTeamIds ?? [],
    );
    const detail = upsertAgentDefinition(body, body.shareBusinessTeamIds ?? []);
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

export async function POST(request: Request) {
  return saveAgentDefinition(request);
}

export async function PATCH(request: Request) {
  return saveAgentDefinition(request);
}

export async function DELETE(request: Request) {
  try {
    await requireAuthenticatedActor(request, "agent-definition-console");
    const body = (await request.json()) as { id: string };
    await requireAgentDefinitionWriter(request, body.id, "agent-definition-console");
    const { deleteManagedResource } = await import("@/server/governance-core");
    deleteManagedResource({ type: "agent-definition", id: body.id });
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
