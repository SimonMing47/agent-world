import { NextResponse } from "next/server";
import {
  listAgentDefinitions,
  upsertAgentDefinition,
} from "@/server/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ agentDefinitions: listAgentDefinitions() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof upsertAgentDefinition>[0] & {
      shareBusinessTeamIds?: string[];
    };
    const detail = upsertAgentDefinition(body, body.shareBusinessTeamIds ?? []);
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存 Agent 定义失败。" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof upsertAgentDefinition>[0] & {
      shareBusinessTeamIds?: string[];
    };
    const detail = upsertAgentDefinition(body, body.shareBusinessTeamIds ?? []);
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存 Agent 定义失败。" },
      { status: 400 },
    );
  }
}
