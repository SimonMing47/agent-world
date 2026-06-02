import { NextResponse } from "next/server";
import { buildAuthSessionCookieValue, signInWithPassword } from "@/server/auth-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    if (!body.username?.trim() || !body.password) {
      return NextResponse.json(
        { ok: false, error: uiText("identityAccess.signIn.errors.credentialsRequired") },
        { status: 400 },
      );
    }

    const result = signInWithPassword({
      username: body.username,
      password: body.password,
    });
    const response = NextResponse.json({
      ok: true,
      requirePasswordChange: result.context.mustChangePassword,
      user: {
        id: result.context.user.id,
        name: result.context.user.name,
        email: result.context.user.email,
        access: result.context.access,
      },
    });
    response.cookies.set(buildAuthSessionCookieValue(result.sessionToken, request));
    return response;
  } catch (error) {
    const message = error instanceof Error ? uiText(error.message, error.message) : uiText("identityAccess.signIn.errors.failed");
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
