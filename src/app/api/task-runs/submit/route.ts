import { NextResponse } from "next/server";
import { apiAccessErrorResponse, requireAgentTeamActor, requireAuthenticatedActor } from "@/server/api-access-control";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedActor(request, "task-run-console");
    const body = (await request.json()) as {
      teamId: string;
      sourceType: "manual" | "schedule" | "webhook" | "access_grant";
      sourceRef?: string | null;
      requestedBy?: string;
      priority?: number;
      accessGrantId?: string | null;
      environmentId?: string | null;
      plannerMode?: string;
      summary?: string;
      inputPayload: Record<string, unknown>;
      nodes?: Array<{
        nodeKey: string;
        agentId: string;
        dependsOn?: string[];
        input?: Record<string, unknown>;
      }>;
    };
    const { actor } = await requireAgentTeamActor(request, body.teamId);
    const { submitTaskRun } = await import("@/server/queries");
    const detail = submitTaskRun({
      ...body,
      requestedBy: body.requestedBy ?? actor,
    });
    return NextResponse.json({ taskRun: detail?.taskRun ?? null, detail });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
