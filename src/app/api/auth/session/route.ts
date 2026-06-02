import { NextResponse } from "next/server";
import { getRequestAuthContext } from "@/server/auth-core";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authContext = await getRequestAuthContext(request);
  return NextResponse.json({
    ok: true,
    authenticated: Boolean(authContext),
    context: authContext
      ? {
          user: authContext.user,
          access: authContext.access,
          mustChangePassword: authContext.mustChangePassword,
          memberships: authContext.memberships,
          primaryBusinessTeam: authContext.primaryBusinessTeam,
          accessibleBusinessTeams: authContext.accessibleBusinessTeams,
          settings: authContext.settings,
        }
      : null,
  });
}
