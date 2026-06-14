import { NextResponse } from "next/server";
import { apiAccessErrorResponse, requireSystemAdminActor } from "@/server/api-access-control";
import { deleteManagedResource } from "@/server/governance-core";
import { listProviders, upsertProviderProfile } from "@/server/queries";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSystemAdminActor(request, "provider-profile-console");
    return NextResponse.json({ providers: listProviders() });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    await requireSystemAdminActor(request, "provider-profile-console");
    const body = (await request.json()) as Parameters<typeof upsertProviderProfile>[0];
    const provider = upsertProviderProfile(body);
    return NextResponse.json({ ok: true, provider });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveProviderProfileFailed") },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  try {
    await requireSystemAdminActor(request, "provider-profile-console");
    const body = (await request.json()) as { id: string };
    deleteManagedResource({ type: "provider-profile", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveProviderProfileFailed") },
      { status: 400 },
    );
  }
}
