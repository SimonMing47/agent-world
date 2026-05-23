import { NextResponse } from "next/server";
import {
  getDevelopmentAccessSettings,
  getRequestAuthContext,
  upsertDevelopmentAccessSettings,
} from "@/server/auth-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function GET() {
  const authContext = await getRequestAuthContext();
  if (!authContext || authContext.user.isSystemAdmin !== 1) {
    return NextResponse.json({ ok: false, error: uiText("identityAccess.errors.adminRequired") }, { status: 403 });
  }
  return NextResponse.json({ setting: getDevelopmentAccessSettings() });
}

export async function PUT(request: Request) {
  const authContext = await getRequestAuthContext();
  if (!authContext || authContext.user.isSystemAdmin !== 1) {
    return NextResponse.json({ ok: false, error: uiText("identityAccess.errors.adminRequired") }, { status: 403 });
  }
  try {
    const body = (await request.json()) as {
      enabled?: boolean;
      autoEnter?: boolean;
      name?: string;
      email?: string;
      title?: string;
    };
    const setting = upsertDevelopmentAccessSettings({
      enabled: body.enabled,
      autoEnter: body.autoEnter,
      name: body.name,
      email: body.email,
      title: body.title,
    }, authContext.user.email || authContext.user.name || "system");
    return NextResponse.json({ ok: true, setting });
  } catch (error) {
    const message = error instanceof Error ? uiText(error.message, error.message) : uiText("developmentAccess.errors.saveFailed");
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 },
    );
  }
}
