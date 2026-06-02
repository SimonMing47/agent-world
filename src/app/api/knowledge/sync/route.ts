import { NextResponse } from "next/server";
import { syncInspectionSkillsToKnowledgeEngine } from "@/server/knowledge-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const results = await syncInspectionSkillsToKnowledgeEngine();

  return NextResponse.json({
    ok: true,
    count: results.length,
    results,
  });
}

