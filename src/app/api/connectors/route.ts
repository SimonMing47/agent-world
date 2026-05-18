import { NextResponse } from "next/server";
import { deleteManagedResource, listConnectors, upsertConnector } from "@/server/governance-core";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ connectors: listConnectors() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertConnector>[0];
  const connector = upsertConnector(body);
  return NextResponse.json({ ok: true, connector });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertConnector>[0];
  const connector = upsertConnector(body);
  return NextResponse.json({ ok: true, connector });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteManagedResource({ type: "connector", id: body.id });
  return NextResponse.json({ ok: true });
}
