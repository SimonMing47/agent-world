import { NextResponse } from "next/server";
import { buildAuthSessionCookieValue, signInWithDevelopmentIdentity } from "@/server/auth-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    providerConfigId?: string | null;
    email: string;
    name: string;
    employeeNo?: string;
    title?: string;
    primaryBusinessTeamId?: string | null;
    businessTeamIds?: string[];
    isSystemAdmin?: boolean;
  };

  if (!body.email?.trim() || !body.name?.trim()) {
    return NextResponse.json({ ok: false, error: uiText("identityAccess.errors.nameEmailRequired") }, { status: 400 });
  }

  const result = signInWithDevelopmentIdentity({
    providerConfigId: body.providerConfigId ?? null,
    email: body.email,
    name: body.name,
    employeeNo: body.employeeNo,
    title: body.title,
    primaryBusinessTeamId: body.primaryBusinessTeamId ?? null,
    businessTeamIds: body.businessTeamIds ?? [],
    isSystemAdmin: Boolean(body.isSystemAdmin),
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: result.context.user.id,
      name: result.context.user.name,
      email: result.context.user.email,
      access: result.context.access,
    },
  });
  response.cookies.set(buildAuthSessionCookieValue(result.sessionToken));
  return response;
}
