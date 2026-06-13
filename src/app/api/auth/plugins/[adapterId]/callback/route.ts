import { NextResponse } from "next/server";
import { buildAuthSessionCookieValue } from "@/server/auth-core";
import { completeEnterpriseSsoSignIn } from "@/server/auth-sso-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ adapterId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { adapterId } = await context.params;
    const result = await completeEnterpriseSsoSignIn(decodeURIComponent(adapterId), request);
    const response = NextResponse.redirect(new URL(result.nextPath, request.url));
    response.cookies.set(buildAuthSessionCookieValue(result.sessionToken, request));
    return response;
  } catch (error) {
    const url = new URL("/signin", request.url);
    url.searchParams.set(
      "error",
      error instanceof Error ? uiText(error.message, error.message) : uiText("identityAccess.sso.errors.callbackFailed"),
    );
    return NextResponse.redirect(url);
  }
}
