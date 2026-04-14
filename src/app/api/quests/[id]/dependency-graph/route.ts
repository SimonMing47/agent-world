import { NextResponse } from "next/server";
import { getQuestDependencyGraph } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const graph = getQuestDependencyGraph(resolved.id);
  return NextResponse.json({ graph });
}
