import { NextResponse } from "next/server";
import { resolveTaskRunIntervention } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const body = (await request.json()) as {
    decision: "approved" | "rejected";
    resolutionNote?: string;
    resolvedBy?: string;
  };

  const detail = resolveTaskRunIntervention({
    interventionId: resolved.id,
    decision: body.decision,
    resolutionNote: body.resolutionNote,
    resolvedBy: body.resolvedBy ?? "console",
  });
  return NextResponse.json({ detail });
}
