import { NextResponse } from "next/server";
import { canAccessBusinessTeam, getRequestAuthContext, requireBusinessTeamAccess } from "@/server/auth-core";
import { deleteManagedResource } from "@/server/governance-core";
import { getTaskBlueprintsSnapshot, listTaskBlueprints, upsertTaskBlueprint } from "@/server/queries";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authContext = await getRequestAuthContext(request);
  const snapshot = getTaskBlueprintsSnapshot();
  return NextResponse.json({
    ...snapshot,
    blueprints: snapshot.blueprints.filter((blueprint) =>
      canAccessBusinessTeam(
        authContext,
        listTaskBlueprints().find((raw) => raw.id === blueprint.id)?.ownerBusinessTeamId,
      ),
    ),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof upsertTaskBlueprint>[0];
    const authContext = await getRequestAuthContext(request);
    requireBusinessTeamAccess(authContext, body.ownerBusinessTeamId);
    const blueprint = upsertTaskBlueprint(body);
    return NextResponse.json({ ok: true, blueprint });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveTaskBlueprintFailed") },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof upsertTaskBlueprint>[0];
    const authContext = await getRequestAuthContext(request);
    requireBusinessTeamAccess(authContext, body.ownerBusinessTeamId);
    const blueprint = upsertTaskBlueprint(body);
    return NextResponse.json({ ok: true, blueprint });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveTaskBlueprintFailed") },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  const authContext = await getRequestAuthContext(request);
  const blueprint = listTaskBlueprints().find((item) => item.id === body.id);
  requireBusinessTeamAccess(authContext, blueprint?.ownerBusinessTeamId);
  deleteManagedResource({ type: "task-blueprint", id: body.id });
  return NextResponse.json({ ok: true });
}
