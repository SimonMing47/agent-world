import { NextResponse } from "next/server";
import { clearAuthSessionCookie, getRequestAuthContext, revokeAuthSession } from "@/server/auth-core";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authContext = await getRequestAuthContext(request);
  if (authContext?.session.sessionToken) {
    revokeAuthSession(authContext.session.sessionToken);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearAuthSessionCookie(request));
  return response;
}
