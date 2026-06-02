import { NextResponse } from "next/server";
import { getIdentityAccessSettings, getRequestAuthContext, upsertIdentityAccessSettings } from "@/server/auth-core";

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
  return NextResponse.json({ settings: getIdentityAccessSettings() });
}

export async function POST(request: Request) {
  const denied = await ensureAdmin(request);
  if (denied) return denied;
  const body = (await request.json()) as Parameters<typeof upsertIdentityAccessSettings>[0];
  const settings = upsertIdentityAccessSettings(body, "system");
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(request: Request) {
  return POST(request);
}
