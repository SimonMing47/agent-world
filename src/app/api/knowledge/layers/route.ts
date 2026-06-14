import { NextResponse } from "next/server";
import { apiAccessErrorResponse, requireSystemAdminActor } from "@/server/api-access-control";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireSystemAdminActor(request, "knowledge-management-console");
    const { getKnowledgeManagementSnapshot } = await import("@/server/knowledge-engine");
    const snapshot = await getKnowledgeManagementSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
