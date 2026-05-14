import { NextResponse } from "next/server";
import { syncReviewSkillsToOpenViking } from "@/server/openviking-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const results = await syncReviewSkillsToOpenViking();

  return NextResponse.json({
    ok: true,
    count: results.length,
    results,
  });
}

