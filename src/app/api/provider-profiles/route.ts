import { NextResponse } from "next/server";
import { deleteManagedResource } from "@/server/governance-core";
import { listProviders, upsertProviderProfile } from "@/server/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ providers: listProviders() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertProviderProfile>[0];
  const provider = upsertProviderProfile(body);
  return NextResponse.json({ ok: true, provider });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertProviderProfile>[0];
  const provider = upsertProviderProfile(body);
  return NextResponse.json({ ok: true, provider });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteManagedResource({ type: "provider-profile", id: body.id });
  return NextResponse.json({ ok: true });
}
