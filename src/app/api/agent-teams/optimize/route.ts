import { NextResponse } from "next/server";
import { optimizeAgentTeamDraft } from "@/server/agent-team-core";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof optimizeAgentTeamDraft>[0];
    const result = await optimizeAgentTeamDraft(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "团队配置优化失败。" },
      { status: 400 },
    );
  }
}
