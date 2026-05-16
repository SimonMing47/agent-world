import { NextResponse } from "next/server";
import { resumeTaskRun } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const body = (await request.json().catch(() => ({}))) as { requestedBy?: string };
  const detail = resumeTaskRun(resolved.id, body.requestedBy ?? "console");
  return NextResponse.json({ detail });
}
