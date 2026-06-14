import { NextResponse } from "next/server";
import { apiAccessErrorResponse, requireTaskRunInterventionActor } from "@/server/api-access-control";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  try {
    const { actor } = await requireTaskRunInterventionActor(request, resolved.id);
    const body = (await request.json()) as {
      decision: "approved" | "rejected";
      resolutionNote?: string;
      resolvedBy?: string;
    };
    const { resolveTaskRunIntervention } = await import("@/server/queries");
    const detail = resolveTaskRunIntervention({
      interventionId: resolved.id,
      decision: body.decision,
      resolutionNote: body.resolutionNote,
      resolvedBy: body.resolvedBy ?? actor,
    });
    return NextResponse.json({ detail });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
