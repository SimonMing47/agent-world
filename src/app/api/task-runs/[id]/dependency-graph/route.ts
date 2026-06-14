import { NextResponse } from "next/server";
import { apiAccessErrorResponse, requireTaskRunActor } from "@/server/api-access-control";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await params;
    await requireTaskRunActor(request, resolved.id);
    const { getTaskRunDependencyGraph } = await import("@/server/queries");
    const graph = getTaskRunDependencyGraph(resolved.id);
    return NextResponse.json({ graph });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
