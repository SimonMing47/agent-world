import { NextResponse } from "next/server";
import { apiAccessErrorResponse, requireSystemAdminActor } from "@/server/api-access-control";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireSystemAdminActor(request, "knowledge-sync-console");
    const { syncAllSkillsToKnowledgeEngine } = await import("@/server/skill-core");
    const results = await syncAllSkillsToKnowledgeEngine();

    return NextResponse.json({
      ok: true,
      count: results.length,
      results,
    });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
