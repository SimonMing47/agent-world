import { NextResponse } from "next/server";
import { getQuestExecutionBoard } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const board = getQuestExecutionBoard(resolved.id);
  return NextResponse.json({ board });
}
