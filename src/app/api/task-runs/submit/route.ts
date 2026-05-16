import { NextResponse } from "next/server";
import { submitTaskRun } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    teamId: string;
    sourceType: "manual" | "schedule" | "webhook" | "access_grant";
    sourceRef?: string | null;
    requestedBy: string;
    priority?: number;
    accessGrantId?: string | null;
    environmentId?: string | null;
    plannerMode?: string;
    summary?: string;
    inputPayload: Record<string, unknown>;
    nodes?: Array<{
      nodeKey: string;
      agentId: string;
      dependsOn?: string[];
      input?: Record<string, unknown>;
    }>;
  };

  const detail = submitTaskRun(body);
  return NextResponse.json({ taskRun: detail?.taskRun ?? null, detail });
}
