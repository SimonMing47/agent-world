import { NextResponse } from "next/server";
import { retryTaskRunNode } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  const resolved = await params;
  const body = (await request.json().catch(() => ({}))) as { requestedBy?: string };
  const detail = retryTaskRunNode({
    taskRunId: resolved.id,
    nodeId: resolved.nodeId,
    requestedBy: body.requestedBy ?? "console",
  });
  return NextResponse.json({ detail });
}
