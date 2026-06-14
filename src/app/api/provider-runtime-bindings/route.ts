import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { filterByBusinessTeamAccess } from "@/server/auth-core";
import {
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
  requireProviderRuntimeBindingActor,
} from "@/server/api-access-control";
import type { ProviderRuntimeBinding } from "@/server/db";

export const dynamic = "force-dynamic";

type ProviderRuntimeBindingInput = Pick<
  ProviderRuntimeBinding,
  | "id"
  | "tenantSpaceId"
  | "businessTeamId"
  | "adapterDefinitionId"
  | "name"
  | "runtimeKind"
  | "baseUrl"
  | "command"
  | "workspaceRoot"
  | "defaultProviderProfileId"
  | "apiKeyRef"
  | "configJson"
  | "isEnabled"
>;

export async function GET(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "runtime-binding-console");
    const { listProviderRuntimeBindings } = await import("@/server/queries");
    const providerRuntimeBindings = filterByBusinessTeamAccess(
      listProviderRuntimeBindings(),
      access.authContext,
      (binding) => binding.businessTeamId,
    );
    return NextResponse.json({ providerRuntimeBindings });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

async function saveProviderRuntimeBinding(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "runtime-binding-console");
    const body = (await request.json()) as ProviderRuntimeBindingInput;
    const { listProviderRuntimeBindings, upsertProviderRuntimeBinding } = await import("@/server/queries");
    const current = listProviderRuntimeBindings().find((binding) => binding.id === body.id);
    if (current) {
      assertBusinessTeamAccess(access.authContext, current.businessTeamId);
    }
    assertBusinessTeamAccess(access.authContext, body.businessTeamId);
    const providerRuntimeBinding = upsertProviderRuntimeBinding(body);
    return NextResponse.json({ ok: true, providerRuntimeBinding });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : uiText("ui.api.errors.saveProviderRuntimeBindingFailed", "Failed to save runtime binding."),
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  return saveProviderRuntimeBinding(request);
}

export async function PATCH(request: Request) {
  return saveProviderRuntimeBinding(request);
}

export async function DELETE(request: Request) {
  try {
    await requireAuthenticatedActor(request, "runtime-binding-console");
    const body = (await request.json()) as { id: string };
    await requireProviderRuntimeBindingActor(request, body.id, "runtime-binding-console");
    const { deleteProviderRuntimeBinding } = await import("@/server/queries");
    deleteProviderRuntimeBinding(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : uiText("ui.api.errors.saveProviderRuntimeBindingFailed", "Failed to save runtime binding."),
      },
      { status: 400 },
    );
  }
}
