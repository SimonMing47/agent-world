import { NextResponse } from "next/server";
import {
  deleteAccessWhitelistRule,
  getRequestAuthContext,
  listAccessWhitelistRules,
  upsertAccessWhitelistRule,
} from "@/server/auth-core";

export const dynamic = "force-dynamic";

async function ensureAdmin(request: Request) {
  const authContext = await getRequestAuthContext(request);
  if (!authContext || authContext.user.isSystemAdmin !== 1) {
    return NextResponse.json({ ok: false, error: "identityAccess.errors.adminRequired" }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const denied = await ensureAdmin(request);
  if (denied) return denied;
  return NextResponse.json({ rules: listAccessWhitelistRules() });
}

export async function POST(request: Request) {
  const denied = await ensureAdmin(request);
  if (denied) return denied;
  const body = (await request.json()) as Parameters<typeof upsertAccessWhitelistRule>[0];
  const rule = upsertAccessWhitelistRule(body);
  return NextResponse.json({ ok: true, rule });
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const denied = await ensureAdmin(request);
  if (denied) return denied;
  const body = (await request.json()) as { id: string };
  deleteAccessWhitelistRule(body.id);
  return NextResponse.json({ ok: true });
}
