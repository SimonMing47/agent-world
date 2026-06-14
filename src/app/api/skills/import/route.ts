import { NextResponse } from "next/server";
import {
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SkillImportFile = {
  name: string;
  relativePath?: string;
  content: string;
};

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "skill-console");
    const body = (await request.json()) as {
      files?: SkillImportFile[];
      repoUrl?: string;
      ownerBusinessTeamId?: string | null;
      visibility?: string;
    };
    assertBusinessTeamAccess(authContext, body.ownerBusinessTeamId ?? null, {
      allowGlobal: authContext.user.isSystemAdmin === 1,
    });
    const defaults = {
      ownerBusinessTeamId: body.ownerBusinessTeamId ?? null,
      visibility: body.visibility ?? "team",
    };
    const { discoverSkillsFromRepository, importSkillsFromFiles } = await import("@/server/skill-core");
    const result = body.repoUrl?.trim()
      ? discoverSkillsFromRepository({ repoUrl: body.repoUrl, ...defaults })
      : importSkillsFromFiles(body.files ?? [], defaults);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.importSkillFailed", "Knowledge import failed.") },
      { status: 400 },
    );
  }
}
