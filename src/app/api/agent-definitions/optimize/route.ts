import { NextResponse } from "next/server";
import {
  optimizeAgentDefinitionDraft,
  type AgentDefinitionDraft,
} from "@/server/agent-definition-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      definition: AgentDefinitionDraft;
      optimizationGoal?: string;
    };
    const result = await optimizeAgentDefinitionDraft(body);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.optimizeAgentDefinitionFailed") },
      { status: 400 },
    );
  }
}
