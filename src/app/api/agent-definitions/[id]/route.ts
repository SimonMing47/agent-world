import { NextResponse } from "next/server";
import { deleteManagedResource } from "@/server/governance-core";
import { getAgentDefinition, upsertAgentDefinition } from "@/server/queries";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const detail = getAgentDefinition(id);

  if (!detail) {
    return NextResponse.json({ ok: false, error: "Agent 定义不存在。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, detail });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Parameters<typeof upsertAgentDefinition>[0] & {
      shareBusinessTeamIds?: string[];
    };
    const detail = upsertAgentDefinition({ ...body, id }, body.shareBusinessTeamIds ?? []);
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存 Agent 定义失败。" },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  deleteManagedResource({ type: "agent-definition", id });
  return NextResponse.json({ ok: true });
}
