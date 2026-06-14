import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { filterByBusinessTeamAccess } from "@/server/auth-core";
import {
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
  requireConnectorActor,
} from "@/server/api-access-control";
import type { ConnectorProfile } from "@/server/db";

export const dynamic = "force-dynamic";

type ConnectorInput = Partial<ConnectorProfile> & Pick<ConnectorProfile, "name" | "connectorType" | "provider">;

export async function GET(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "connector-console");
    const { listConnectors } = await import("@/server/governance-core");
    const connectors = filterByBusinessTeamAccess(
      listConnectors(),
      access.authContext,
      (connector) => connector.businessTeamId,
      { allowGlobal: true },
    );
    return NextResponse.json({ connectors });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

async function saveConnector(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "connector-console");
    const body = (await request.json()) as ConnectorInput;
    const { listConnectors, upsertConnector } = await import("@/server/governance-core");
    const current = body.id ? listConnectors().find((connector) => connector.id === body.id) : null;
    if (current) {
      assertBusinessTeamAccess(access.authContext, current.businessTeamId);
    }
    const targetBusinessTeamId =
      body.businessTeamId === undefined ? current?.businessTeamId ?? null : body.businessTeamId;
    assertBusinessTeamAccess(access.authContext, targetBusinessTeamId);
    const connector = upsertConnector(body);
    return NextResponse.json({ ok: true, connector });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : uiText("ui.api.errors.saveConnectorFailed", "Failed to save connector."),
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  return saveConnector(request);
}

export async function PATCH(request: Request) {
  return saveConnector(request);
}

export async function DELETE(request: Request) {
  try {
    await requireAuthenticatedActor(request, "connector-console");
    const body = (await request.json()) as { id: string };
    await requireConnectorActor(request, body.id, "connector-console");
    const { deleteManagedResource } = await import("@/server/governance-core");
    deleteManagedResource({ type: "connector", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : uiText("ui.api.errors.saveConnectorFailed", "Failed to save connector."),
      },
      { status: 400 },
    );
  }
}
