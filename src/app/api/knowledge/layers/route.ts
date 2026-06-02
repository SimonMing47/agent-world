import { NextResponse } from "next/server";
import { getKnowledgeManagementSnapshot } from "@/server/knowledge-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const snapshot = await getKnowledgeManagementSnapshot();
  return NextResponse.json(snapshot);
}

