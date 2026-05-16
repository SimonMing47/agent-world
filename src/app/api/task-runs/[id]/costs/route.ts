import { NextResponse } from "next/server";
import { getTaskRunCostBreakdown } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const costs = getTaskRunCostBreakdown(resolved.id);
  return NextResponse.json({ costs });
}
