import { NextResponse } from "next/server";
import { syncInspectionSkillsToOpenViking } from "@/server/openviking-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const results = await syncInspectionSkillsToOpenViking();

  return NextResponse.json({
    ok: true,
    count: results.length,
    results,
  });
}

