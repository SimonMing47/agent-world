import { NextResponse } from "next/server";
import { startEnterpriseSsoSignIn } from "@/server/auth-sso-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ adapterId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { adapterId } = await context.params;
    const result = await startEnterpriseSsoSignIn(decodeURIComponent(adapterId), request);
    return NextResponse.redirect(result.redirectUrl);
  } catch (error) {
    const url = new URL("/signin", request.url);
    url.searchParams.set(
      "error",
      error instanceof Error ? uiText(error.message, error.message) : uiText("identityAccess.sso.errors.startFailed"),
    );
    return NextResponse.redirect(url);
  }
}
