import { NextResponse } from "next/server";
import { getRequestAuthContext } from "@/server/auth-core";

export const dynamic = "force-dynamic";

export async function GET() {
  const authContext = await getRequestAuthContext();
  return NextResponse.json({
    ok: true,
    authenticated: Boolean(authContext),
    context: authContext
      ? {
          user: authContext.user,
          access: authContext.access,
          memberships: authContext.memberships,
          accessibleBusinessTeams: authContext.accessibleBusinessTeams,
          settings: authContext.settings,
        }
      : null,
  });
}
