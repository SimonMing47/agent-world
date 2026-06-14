import { NextResponse } from "next/server";
import {
  apiAccessErrorResponse,
  assertSkillWriteAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { queryOne, type InspectionSkill } from "@/server/db";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "skill-console");
    const body = (await request.json()) as { skillId: string };
    const skill = queryOne<InspectionSkill>("SELECT * FROM inspection_skills WHERE id = ?", body.skillId);
    if (!skill) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.skillNotFound") }, { status: 404 });
    }
    assertSkillWriteAccess(authContext, skill);
    const { syncSkillToKnowledgeEngine } = await import("@/server/skill-core");
    const result = await syncSkillToKnowledgeEngine(body.skillId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.syncSkillFailed") },
      { status: 400 },
    );
  }
}
