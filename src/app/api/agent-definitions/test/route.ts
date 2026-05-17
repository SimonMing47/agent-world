import { NextResponse } from "next/server";
import {
  testAgentDefinitionDraft,
  type AgentDefinitionDraft,
} from "@/server/agent-definition-core";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      definition: AgentDefinitionDraft;
      testPrompt: string;
      workspaceRoot?: string;
      persistValidation?: boolean;
    };
    if (!body.testPrompt?.trim()) {
      return NextResponse.json({ ok: false, error: "测试提示词不能为空。" }, { status: 400 });
    }
    const result = await testAgentDefinitionDraft({
      definition: body.definition,
      testPrompt: body.testPrompt.trim(),
      workspaceRoot: body.workspaceRoot,
      persistValidation: body.persistValidation,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "测试 Agent 失败。" },
      { status: 400 },
    );
  }
}
