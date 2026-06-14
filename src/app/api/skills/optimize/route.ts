import { NextResponse } from "next/server";
import {
  apiAccessErrorResponse,
  assertSkillSaveAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { queryOne, type InspectionSkill } from "@/server/db";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SkillDraft = {
  id?: string;
  ownerBusinessTeamId?: string | null;
};

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "skill-console");
    const body = (await request.json()) as { skill: SkillDraft; optimizationGoal?: string };
    const currentSkill = body.skill.id
      ? queryOne<InspectionSkill>("SELECT * FROM inspection_skills WHERE id = ?", body.skill.id)
      : null;
    assertSkillSaveAccess(authContext, currentSkill, body.skill.ownerBusinessTeamId ?? null);
    const { optimizeSkillDraft } = await import("@/server/skill-core");
    const result = await optimizeSkillDraft(body as Parameters<typeof optimizeSkillDraft>[0]);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.optimizeSkillFailed") },
      { status: 400 },
    );
  }
}
