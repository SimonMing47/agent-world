import { NextResponse } from "next/server";
import { optimizeSkillDraft } from "@/server/skill-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof optimizeSkillDraft>[0];
    const result = await optimizeSkillDraft(body);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.optimizeSkillFailed") },
      { status: 400 },
    );
  }
}

