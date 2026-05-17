import { NextResponse } from "next/server";
import { optimizeSkillDraft } from "@/server/skill-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof optimizeSkillDraft>[0];
    const result = await optimizeSkillDraft(body);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "优化 Skill 失败。" },
      { status: 400 },
    );
  }
}

