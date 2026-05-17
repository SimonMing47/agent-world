import { NextResponse } from "next/server";
import { deleteManagedResource, upsertExecutionPolicy } from "@/server/governance-core";
import { listExecutionPolicies } from "@/server/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ policies: listExecutionPolicies() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertExecutionPolicy>[0];
  const policy = upsertExecutionPolicy(body);
  return NextResponse.json({ ok: true, policy });
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteManagedResource({ type: "execution-policy", id: body.id });
  return NextResponse.json({ ok: true });
}
