import { NextResponse } from "next/server";
import { getRequestAuthContext, listAccessRequests, upsertAccessRequest } from "@/server/auth-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

async function ensureAdmin() {
  const authContext = await getRequestAuthContext();
  if (!authContext || authContext.user.isSystemAdmin !== 1) {
    return NextResponse.json({ ok: false, error: "identityAccess.errors.adminRequired" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await ensureAdmin();
  if (denied) return denied;
  return NextResponse.json({ requests: listAccessRequests() });
}

export async function POST(request: Request) {
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
}

export async function PATCH(request: Request) {
  const denied = await ensureAdmin();
  if (denied) return denied;
  const body = (await request.json()) as Parameters<typeof upsertAccessRequest>[0];
  if (!body.email?.trim() || !body.name?.trim()) {
    return NextResponse.json({ ok: false, error: uiText("identityAccess.errors.nameEmailRequired") }, { status: 400 });
  }
  const record = upsertAccessRequest(body);
  return NextResponse.json({ ok: true, request: record });
}
