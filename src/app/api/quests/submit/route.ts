import { NextResponse } from "next/server";
import { submitQuest } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    teamId: string;
    sourceType: "manual" | "schedule" | "webhook" | "contract";
    sourceRef?: string | null;
    requestedBy: string;
    priority?: number;
    contractId?: string | null;
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

  const detail = submitQuest(body);
  return NextResponse.json({ quest: detail?.quest ?? null, detail });
}
