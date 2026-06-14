import { NextResponse } from "next/server";
import { filterByBusinessTeamAccess } from "@/server/auth-core";
import {
  apiAccessErrorResponse,
  assertRuntimeSessionCreateAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

type RuntimeSessionCreateInput = {
  agentDefinitionId?: string | null;
  agentTeamId?: string | null;
  businessTeamId: string;
  createdBy?: string;
  mode: "single_agent" | "agent_team";
  model: string;
  providerProfileId: string;
  runtimeBindingId: string;
  systemPrompt: string;
  tenantSpaceId: string;
  title: string;
};

export async function GET(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "runtime-session-console");
    const { listRuntimeSessions } = await import("@/server/runtime-session-core");
    return NextResponse.json({
      runtimeSessions: filterByBusinessTeamAccess(
        listRuntimeSessions(),
        access.authContext,
        (session) => session.businessTeamId,
      ),
    });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "runtime-session-console");
    const body = (await request.json()) as RuntimeSessionCreateInput;
    assertRuntimeSessionCreateAccess(access.authContext, body);
    const { createRuntimeSession } = await import("@/server/runtime-session-core");
    const detail = createRuntimeSession({
      ...body,
      createdBy: access.actor,
    });
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.createRuntimeSessionFailed") },
      { status: 400 },
    );
  }
}
