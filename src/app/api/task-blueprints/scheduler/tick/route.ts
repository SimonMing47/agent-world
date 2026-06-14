import { NextResponse } from "next/server";
import { apiAccessErrorResponse, requireAuthenticatedActor } from "@/server/api-access-control";
import { submitDueTaskBlueprintSchedules } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    now?: string;
    requestedBy?: string;
    inputPayload?: Record<string, unknown>;
    force?: boolean;
  };

  try {
    const { actor, authContext } = await requireAuthenticatedActor(request, "scheduler-console");
    const result = submitDueTaskBlueprintSchedules({
      now: body.now,
      requestedBy: body.requestedBy ?? actor,
      inputPayload: body.inputPayload,
      force: body.force,
      accessibleBusinessTeamIds:
        authContext.user.isSystemAdmin === 1 ? null : authContext.accessibleBusinessTeamIds,
    });

    return NextResponse.json(result);
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
