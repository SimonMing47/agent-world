import { NextResponse } from "next/server";
import {
  apiAccessErrorResponse,
  assertSkillSaveAccess,
  assertSkillWriteAccess,
  canReadSkill,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { queryAll, queryOne, type InspectionSkill } from "@/server/db";
import { deleteManagedResource } from "@/server/governance-core";
import { normalizeKnowledgeUri } from "@/lib/knowledge-uri";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SkillDraft = {
  id?: string;
  ownerBusinessTeamId?: string | null;
  name: string;
  layer: string;
  description: string;
  tags: string[];
  visibility: string;
  promptMd: string;
  heuristicsJson: string;
  isEnabled?: number | boolean;
};

function listSkills() {
  return queryAll<InspectionSkill>("SELECT * FROM inspection_skills ORDER BY layer ASC, name ASC").map((skill) => ({
    ...skill,
    vikingUri: skill.vikingUri ? normalizeKnowledgeUri(skill.vikingUri) : null,
  }));
}

function getSkill(id: string | null | undefined) {
  if (!id) return null;
  return queryOne<InspectionSkill>("SELECT * FROM inspection_skills WHERE id = ?", id);
}

export async function GET(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "skill-console");
    return NextResponse.json({ skills: listSkills().filter((skill) => canReadSkill(authContext, skill)) });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "skill-console");
    const body = (await request.json()) as SkillDraft;
    const currentSkill = getSkill(body.id);
    assertSkillSaveAccess(authContext, currentSkill, body.ownerBusinessTeamId ?? null);
    const { upsertSkill } = await import("@/server/skill-core");
    const skill = upsertSkill(body);
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

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "skill-console");
    const body = (await request.json()) as { id: string };
    const skill = getSkill(body.id);
    if (!skill) {
      return NextResponse.json({ ok: false, error: uiText("ui.api.errors.skillNotFound") }, { status: 404 });
    }
    assertSkillWriteAccess(authContext, skill);
    deleteManagedResource({ type: "skill", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
