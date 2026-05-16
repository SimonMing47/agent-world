import { NextResponse } from "next/server";
import { listWebhooks, upsertWebhookEndpoint } from "@/server/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ webhooks: listWebhooks() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertWebhookEndpoint>[0];
  const webhook = upsertWebhookEndpoint(body);
  return NextResponse.json({ ok: true, webhook });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertWebhookEndpoint>[0];
  const webhook = upsertWebhookEndpoint(body);
  return NextResponse.json({ ok: true, webhook });
}
