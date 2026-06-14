import { NextResponse } from "next/server";
import {
  apiAccessErrorResponse,
  canReadSkill,
  requireAuthenticatedActor,
} from "@/server/api-access-control";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "knowledge-skill-console");
    const { listKnowledgeSkills } = await import("@/server/knowledge-engine");
    return NextResponse.json({
      skills: listKnowledgeSkills().filter((skill) => canReadSkill(authContext, skill)),
    });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
