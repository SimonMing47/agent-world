import { NextResponse } from "next/server";
import { getIdentityAccessSettings, upsertIdentityAccessSettings } from "@/server/auth-core";
import { apiAccessErrorResponse, requireSystemAdminActor } from "@/server/api-access-control";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSystemAdminActor(request, "identity-access-console");
    return NextResponse.json({ settings: getIdentityAccessSettings() });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireSystemAdminActor(request, "identity-access-console");
    const body = (await request.json()) as Parameters<typeof upsertIdentityAccessSettings>[0];
    const settings = upsertIdentityAccessSettings(body, access.actor);
    return NextResponse.json({ ok: true, settings });
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
