import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { apiAccessErrorResponse, requireSystemAdminActor } from "@/server/api-access-control";
import {
  createKnowledgeApiToken,
  listKnowledgeApiTokens,
  revokeKnowledgeApiToken,
} from "@/server/knowledge-api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSystemAdminActor(request, "knowledge-token-console");
    const url = new URL(request.url);
    const includeInactive = ["1", "true", "yes", "on"].includes(
      (url.searchParams.get("includeInactive") ?? "").toLowerCase(),
    );

    return NextResponse.json({
      ok: true,
      tokens: listKnowledgeApiTokens(includeInactive),
    });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireSystemAdminActor(request, "knowledge-token-console");
    const body = (await request.json().catch(() => ({}))) as {
      label?: string;
      expiresAt?: string | null;
    };

    const label = body.label?.trim() ?? "";
    if (!label) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.labelRequired") }, { status: 400 });
    }

    const record = createKnowledgeApiToken({
      label,
      createdBy: access.authContext.user.id,
      expiresAt: body.expiresAt,
    });

    return NextResponse.json({ ok: true, token: record.token, tokenInfo: record.tokenInfo });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("common.messages.saveFailed") },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireSystemAdminActor(request, "knowledge-token-console");
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.idRequired") }, { status: 400 });
    }

    const revoked = revokeKnowledgeApiToken(id);
    if (!revoked) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.knowledgeApiTokenNotFound") }, { status: 404 });
    }

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
