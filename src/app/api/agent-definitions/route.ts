import { NextResponse } from "next/server";
import { deleteManagedResource } from "@/server/governance-core";
import {
  listAgentDefinitions,
  upsertAgentDefinition,
} from "@/server/queries";
import { uiText } from "@/lib/language-pack";

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
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveAgentDefinitionFailed") },
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
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveAgentDefinitionFailed") },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteManagedResource({ type: "agent-definition", id: body.id });
  return NextResponse.json({ ok: true });
}
