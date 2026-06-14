import { NextResponse } from "next/server";
import {
  deleteAuthProviderConfig,
  describeProviderConfig,
  listAuthAdapterCatalog,
  listAuthProviderConfigs,
  upsertAuthProviderConfig,
} from "@/server/auth-core";
import { apiAccessErrorResponse, requireSystemAdminActor } from "@/server/api-access-control";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSystemAdminActor(request, "identity-access-console");
    return NextResponse.json({
      adapters: listAuthAdapterCatalog().map((adapter) => ({
        key: adapter.key,
        name: adapter.name,
        description: adapter.description,
        mode: adapter.mode,
        isBuiltIn: adapter.isBuiltIn,
        capabilities: adapter.capabilities,
        status: adapter.status,
      })),
      providers: listAuthProviderConfigs().map(describeProviderConfig),
    });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    await requireSystemAdminActor(request, "identity-access-console");
    const body = (await request.json()) as Parameters<typeof upsertAuthProviderConfig>[0];
    const provider = upsertAuthProviderConfig(body);
    return NextResponse.json({ ok: true, provider: describeProviderConfig(provider!) });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("common.messages.saveFailed") },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  try {
    await requireSystemAdminActor(request, "identity-access-console");
    const body = (await request.json()) as { id: string };
    deleteAuthProviderConfig(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("common.messages.saveFailed") },
      { status: 400 },
    );
  }
}
