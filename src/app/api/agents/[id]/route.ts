import { NextResponse } from "next/server";
import { updateAgentDefinition } from "@/server/queries";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as Partial<{
    name: string;
    role: string;
    personaPrompt: string;
    model: string;
    toolBindings: string[];
    memoryScope: string;
    status: string;
  }>;

  const agent = updateAgentDefinition(id, body);
  return NextResponse.json({ ok: true, agent });
}
