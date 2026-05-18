import { NextResponse } from "next/server";
import { submitDueTaskBlueprintSchedules } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    now?: string;
    requestedBy?: string;
    inputPayload?: Record<string, unknown>;
  };

  const result = submitDueTaskBlueprintSchedules({
    now: body.now,
    requestedBy: body.requestedBy,
    inputPayload: body.inputPayload,
  });

  return NextResponse.json(result);
}
