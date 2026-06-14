import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import {
  ApiAccessError,
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { canAccessBusinessTeam } from "@/server/auth-core";
import { queryAll, queryOne, type AgentTeam, type ServiceCatalogListing } from "@/server/db";
import { deleteManagedResource, upsertServiceCatalogListing } from "@/server/governance-core";

export const dynamic = "force-dynamic";

function listServiceCatalogListings() {
  return queryAll<ServiceCatalogListing>("SELECT * FROM service_catalog_listings WHERE status <> 'deleted' ORDER BY created_at DESC");
}

function getAgentTeam(teamId: string) {
  return queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", teamId);
}

function getServiceCatalogListing(id: string) {
  return queryOne<ServiceCatalogListing>("SELECT * FROM service_catalog_listings WHERE id = ?", id);
}

function assertServiceCatalogWriteAccess(
  authContext: Awaited<ReturnType<typeof requireAuthenticatedActor>>["authContext"],
  listing: Pick<ServiceCatalogListing, "teamId">,
) {
  const team = getAgentTeam(listing.teamId);
  if (!team) {
    throw new ApiAccessError(404, uiText("ui.api.errors.agentTeamNotFound", "Agent team does not exist."));
  }
  assertBusinessTeamAccess(authContext, team.businessTeamId);
}

export async function GET(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "service-catalog-console");
    const listings = listServiceCatalogListings().filter((listing) => {
      const team = getAgentTeam(listing.teamId);
      return Boolean(team && canAccessBusinessTeam(authContext, team.businessTeamId));
    });
    return NextResponse.json({ listings });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "service-catalog-console");
    const body = (await request.json()) as Parameters<typeof upsertServiceCatalogListing>[0];
    const current = body.id ? getServiceCatalogListing(body.id) : null;
    if (body.id && !current) {
      throw new ApiAccessError(
        404,
        uiText("ui.api.errors.serviceCatalogEntryNotFound", "Service catalog entry does not exist."),
      );
    }
    if (current) assertServiceCatalogWriteAccess(authContext, current);
    assertServiceCatalogWriteAccess(authContext, body);
    const listing = upsertServiceCatalogListing(body);
    return NextResponse.json({ ok: true, listing });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "service-catalog-console");
    const body = (await request.json()) as { id: string };
    const current = getServiceCatalogListing(body.id);
    if (!current) {
      throw new ApiAccessError(
        404,
        uiText("ui.api.errors.serviceCatalogEntryNotFound", "Service catalog entry does not exist."),
      );
    }
    assertServiceCatalogWriteAccess(authContext, current);
    deleteManagedResource({ type: "service-catalog", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}
