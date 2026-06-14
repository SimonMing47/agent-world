import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import {
  apiAccessErrorResponse,
  assertSkillWriteAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { queryOne, type InspectionSkill } from "@/server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "knowledge-skill-console");
    const { id } = await context.params;
    const currentSkill = queryOne<InspectionSkill>("SELECT * FROM inspection_skills WHERE id = ?", id);
    if (!currentSkill) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.skillNotFound") }, { status: 404 });
    }
    assertSkillWriteAccess(authContext, currentSkill);
    const body = (await request.json().catch(() => ({}))) as Partial<{
      name: string;
      layer: string;
      description: string;
      isEnabled: boolean;
      promptMd: string;
      heuristics: Record<string, unknown>;
    }>;
    const { updateKnowledgeSkill } = await import("@/server/knowledge-engine");
    const skill = updateKnowledgeSkill(id, body);
    return NextResponse.json({ ok: true, skill });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveSkillFailed") },
      { status: 400 },
    );
  }
}
