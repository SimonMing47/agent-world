import { NextResponse } from "next/server";
import { listKnowledgeSkills } from "@/server/knowledge-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ skills: listKnowledgeSkills() });
}
