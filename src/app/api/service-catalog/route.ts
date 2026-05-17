import { NextResponse } from "next/server";
import { deleteManagedResource, upsertServiceCatalogListing } from "@/server/governance-core";
import { listServiceCatalogListings } from "@/server/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ listings: listServiceCatalogListings() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertServiceCatalogListing>[0];
  const listing = upsertServiceCatalogListing(body);
  return NextResponse.json({ ok: true, listing });
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteManagedResource({ type: "service-catalog", id: body.id });
  return NextResponse.json({ ok: true });
}
