import { NextResponse } from "next/server";
import {
  deleteProviderRuntimeBinding,
  listProviderRuntimeBindings,
  upsertProviderRuntimeBinding,
} from "@/server/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ providerRuntimeBindings: listProviderRuntimeBindings() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertProviderRuntimeBinding>[0];
  const providerRuntimeBinding = upsertProviderRuntimeBinding(body);
  return NextResponse.json({ ok: true, providerRuntimeBinding });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertProviderRuntimeBinding>[0];
  const providerRuntimeBinding = upsertProviderRuntimeBinding(body);
  return NextResponse.json({ ok: true, providerRuntimeBinding });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteProviderRuntimeBinding(body.id);
  return NextResponse.json({ ok: true });
}
