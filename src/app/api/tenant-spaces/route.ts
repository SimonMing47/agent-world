import { NextResponse } from "next/server";
import { deleteManagedResource, upsertTenantSpace } from "@/server/governance-core";
import { listTenantSpaces } from "@/server/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ tenantSpaces: listTenantSpaces() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertTenantSpace>[0];
  const tenantSpace = upsertTenantSpace(body);
  return NextResponse.json({ ok: true, tenantSpace });
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteManagedResource({ type: "tenant-space", id: body.id });
  return NextResponse.json({ ok: true });
}
