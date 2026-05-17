import { NextResponse } from "next/server";
import { syncSkillToOpenViking } from "@/server/skill-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { skillId: string };
    const result = await syncSkillToOpenViking(body.skillId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "同步 Skill 失败。" },
      { status: 400 },
    );
  }
}

