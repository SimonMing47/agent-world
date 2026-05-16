import { NextResponse } from "next/server";
import { getTaskRunExecutionBoard } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const board = getTaskRunExecutionBoard(resolved.id);
  return NextResponse.json({ board });
}
