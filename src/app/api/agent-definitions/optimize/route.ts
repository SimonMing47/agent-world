import { NextResponse } from "next/server";
import {
  type AgentDefinitionDraft,
} from "@/server/agent-definition-core";
import {
  apiAccessErrorResponse,
  assertAgentDefinitionSaveAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { queryOne, type AgentDefinition } from "@/server/db";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "agent-definition-console");
    const body = (await request.json()) as {
      definition: AgentDefinitionDraft;
      optimizationGoal?: string;
    };
    const currentDefinition = body.definition.id
      ? queryOne<AgentDefinition>(
          "SELECT * FROM agent_definitions WHERE id = ? AND status <> 'deleted'",
          body.definition.id,
        )
      : null;
    assertAgentDefinitionSaveAccess(authContext, currentDefinition, body.definition.ownerBusinessTeamId, []);
    const { optimizeAgentDefinitionDraft } = await import("@/server/agent-definition-core");
    const result = await optimizeAgentDefinitionDraft(body);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.optimizeAgentDefinitionFailed") },
      { status: 400 },
    );
  }
}
