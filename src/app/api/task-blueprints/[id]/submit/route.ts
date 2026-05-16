import { NextResponse } from "next/server";
import { submitTaskRunFromBlueprint } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const body = (await request.json().catch(() => ({}))) as {
    requestedBy?: string;
    inputPayload?: Record<string, unknown>;
    sourceRef?: string | null;
    priority?: number;
    parentTaskRunId?: string | null;
  };

  const detail = submitTaskRunFromBlueprint({
    blueprintId: resolved.id,
    requestedBy: body.requestedBy,
    inputPayload: body.inputPayload,
    sourceRef: body.sourceRef,
    priority: body.priority,
    parentTaskRunId: body.parentTaskRunId,
  });

  return NextResponse.json({ ok: true, taskRun: detail?.taskRun ?? null, detail });
}
