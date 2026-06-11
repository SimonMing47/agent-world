import { NextResponse } from "next/server";
import { syncAllSkillsToKnowledgeEngine } from "@/server/skill-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const results = await syncAllSkillsToKnowledgeEngine();

  return NextResponse.json({
    ok: true,
    count: results.length,
    results,
  });
}
