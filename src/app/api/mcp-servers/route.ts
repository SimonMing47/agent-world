import { NextResponse } from "next/server";
import { listMcpServers, upsertMcpServer } from "@/server/governance-core";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ servers: listMcpServers() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertMcpServer>[0];
  const server = upsertMcpServer(body);
  return NextResponse.json({ ok: true, server });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertMcpServer>[0];
  const server = upsertMcpServer(body);
  return NextResponse.json({ ok: true, server });
}

