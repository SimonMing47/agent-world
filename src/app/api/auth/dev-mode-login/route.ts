import { NextResponse } from "next/server";
import { buildAuthSessionCookieValue, signInWithDevelopmentAccess } from "@/server/auth-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = signInWithDevelopmentAccess();
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
  } catch (error) {
    const message = error instanceof Error ? uiText(error.message, error.message) : uiText("developmentAccess.errors.failed");
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 },
    );
  }
}
