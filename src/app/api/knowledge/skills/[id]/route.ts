import { NextResponse } from "next/server";
import { updateKnowledgeSkill } from "@/server/knowledge-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as Parameters<typeof updateKnowledgeSkill>[1];
  const skill = updateKnowledgeSkill(id, body);
  return NextResponse.json({ ok: true, skill });
}
