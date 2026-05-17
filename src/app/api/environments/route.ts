import { NextResponse } from "next/server";
import {
  deleteExecutionEnvironment,
  listExecutionEnvironments,
  upsertExecutionEnvironment,
} from "@/server/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ environments: listExecutionEnvironments() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertExecutionEnvironment>[0];
  const environment = upsertExecutionEnvironment(body);
  return NextResponse.json({ ok: true, environment });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertExecutionEnvironment>[0];
  const environment = upsertExecutionEnvironment(body);
  return NextResponse.json({ ok: true, environment });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteExecutionEnvironment(body.id);
  return NextResponse.json({ ok: true });
}
