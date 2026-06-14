import { NextResponse } from "next/server";
import { apiAccessErrorResponse, requireSystemAdminActor } from "@/server/api-access-control";
import { queryAll, type TenantSpace } from "@/server/db";
import { deleteManagedResource, upsertTenantSpace } from "@/server/governance-core";

export const dynamic = "force-dynamic";

function listTenantSpaces() {
  return queryAll<TenantSpace>("SELECT * FROM tenant_spaces WHERE status <> 'deleted' ORDER BY name ASC");
}

export async function GET(request: Request) {
  try {
    await requireSystemAdminActor(request, "tenant-space-console");
    return NextResponse.json({ tenantSpaces: listTenantSpaces() });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    await requireSystemAdminActor(request, "tenant-space-console");
    const body = (await request.json()) as Parameters<typeof upsertTenantSpace>[0];
    const tenantSpace = upsertTenantSpace(body);
    return NextResponse.json({ ok: true, tenantSpace });
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
    await requireSystemAdminActor(request, "tenant-space-console");
    const body = (await request.json()) as { id: string };
    deleteManagedResource({ type: "tenant-space", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}
