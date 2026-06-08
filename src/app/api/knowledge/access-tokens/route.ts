import { NextResponse } from "next/server";
import { getRequestAuthContext } from "@/server/auth-core";
import {
  createKnowledgeApiToken,
  listKnowledgeApiTokens,
  revokeKnowledgeApiToken,
} from "@/server/knowledge-api-auth";

export const dynamic = "force-dynamic";

async function requireSystemAdmin(request: Request) {
  const authContext = await getRequestAuthContext(request);
  if (!authContext || authContext.user.isSystemAdmin !== 1) {
    return NextResponse.json({ ok: false, error: "System admin required" }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const forbidden = await requireSystemAdmin(request);
  if (forbidden) {
    return forbidden;
  }

  const authContext = await getRequestAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(request.url);
  const includeInactive = ["1", "true", "yes", "on"].includes(
    (url.searchParams.get("includeInactive") ?? "").toLowerCase(),
  );

  return NextResponse.json({
    ok: true,
    tokens: listKnowledgeApiTokens(includeInactive),
  });
}

export async function POST(request: Request) {
  const forbidden = await requireSystemAdmin(request);
  if (forbidden) {
    return forbidden;
  }

  const authContext = await getRequestAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    expiresAt?: string | null;
  };

  const label = body.label?.trim() ?? "";
  if (!label) {
    return NextResponse.json({ ok: false, error: "label is required" }, { status: 400 });
  }

  const record = createKnowledgeApiToken({
    label,
    createdBy: authContext.user.id,
    expiresAt: body.expiresAt,
  });

  return NextResponse.json({ ok: true, token: record.token, tokenInfo: record.tokenInfo });
}

export async function DELETE(request: Request) {
  const forbidden = await requireSystemAdmin(request);
  if (forbidden) {
    return forbidden;
  }

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  }

  const revoked = revokeKnowledgeApiToken(id);
  if (!revoked) {
    return NextResponse.json({ ok: false, error: "token not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
