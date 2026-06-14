import { NextResponse } from "next/server";
import { listAccessRequests, upsertAccessRequest } from "@/server/auth-core";
import { apiAccessErrorResponse, requireSystemAdminActor } from "@/server/api-access-control";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSystemAdminActor(request, "identity-access-console");
    return NextResponse.json({ requests: listAccessRequests() });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    await requireSystemAdminActor(request, "identity-access-console");
    const body = (await request.json()) as Parameters<typeof upsertAccessRequest>[0];
    if (!body.email?.trim() || !body.name?.trim()) {
      return NextResponse.json({ ok: false, error: uiText("identityAccess.errors.nameEmailRequired") }, { status: 400 });
    }
    const record = upsertAccessRequest({
      email: body.email,
      name: body.name,
      authProviderConfigId: body.authProviderConfigId ?? null,
      requestedBusinessTeamHint: body.requestedBusinessTeamHint ?? "",
      requestNote: body.requestNote ?? "",
      status: "open",
    });
    return NextResponse.json({ ok: true, request: record });
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
  try {
    await requireSystemAdminActor(request, "identity-access-console");
    const body = (await request.json()) as Parameters<typeof upsertAccessRequest>[0];
    if (!body.email?.trim() || !body.name?.trim()) {
      return NextResponse.json({ ok: false, error: uiText("identityAccess.errors.nameEmailRequired") }, { status: 400 });
    }
    const record = upsertAccessRequest(body);
    return NextResponse.json({ ok: true, request: record });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("common.messages.saveFailed") },
      { status: 400 },
    );
  }
}
