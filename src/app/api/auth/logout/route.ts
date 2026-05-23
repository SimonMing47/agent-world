import { NextResponse } from "next/server";
import { clearAuthSessionCookie, getRequestAuthContext, revokeAuthSession } from "@/server/auth-core";

export const dynamic = "force-dynamic";

export async function POST() {
  const authContext = await getRequestAuthContext();
  if (authContext?.session.sessionToken) {
    revokeAuthSession(authContext.session.sessionToken);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearAuthSessionCookie());
  return response;
}
