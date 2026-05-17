import { NextResponse } from "next/server";
import { deleteManagedResource, upsertAccessGrant } from "@/server/governance-core";
import { listAccessGrants } from "@/server/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ grants: listAccessGrants() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertAccessGrant>[0];
  const grant = upsertAccessGrant(body);
  return NextResponse.json({ ok: true, grant });
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteManagedResource({ type: "access-grant", id: body.id });
  return NextResponse.json({ ok: true });
}
