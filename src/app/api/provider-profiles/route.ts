import { NextResponse } from "next/server";
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
