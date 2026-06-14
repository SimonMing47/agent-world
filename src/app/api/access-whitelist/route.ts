import { NextResponse } from "next/server";
import {
  deleteAccessWhitelistRule,
  listAccessWhitelistRules,
  upsertAccessWhitelistRule,
} from "@/server/auth-core";
import { apiAccessErrorResponse, requireSystemAdminActor } from "@/server/api-access-control";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSystemAdminActor(request, "identity-access-console");
    return NextResponse.json({ rules: listAccessWhitelistRules() });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    await requireSystemAdminActor(request, "identity-access-console");
    const body = (await request.json()) as Parameters<typeof upsertAccessWhitelistRule>[0];
    const rule = upsertAccessWhitelistRule(body);
    return NextResponse.json({ ok: true, rule });
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
    deleteAccessWhitelistRule(body.id);
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
