import { NextResponse } from "next/server";
import {
  discoverSkillsFromRepository,
  importSkillsFromFiles,
  type SkillImportFile,
} from "@/server/skill-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      files?: SkillImportFile[];
      repoUrl?: string;
      ownerBusinessTeamId?: string | null;
      visibility?: string;
    };
    const defaults = {
      ownerBusinessTeamId: body.ownerBusinessTeamId ?? null,
      visibility: body.visibility ?? "team",
    };
    const result = body.repoUrl?.trim()
      ? discoverSkillsFromRepository({ repoUrl: body.repoUrl, ...defaults })
      : importSkillsFromFiles(body.files ?? [], defaults);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.importSkillFailed", "Skill import failed.") },
      { status: 400 },
    );
  }
}
