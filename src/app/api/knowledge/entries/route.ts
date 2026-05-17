import { NextResponse } from "next/server";
import {
  deleteKnowledgeEntry,
  listLayeredKnowledge,
  upsertKnowledgeEntry,
} from "@/server/openviking-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ entries: listLayeredKnowledge(100) });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof upsertKnowledgeEntry>[0];
    const entry = await upsertKnowledgeEntry(body);
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存知识条目失败。" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteKnowledgeEntry(body.id);
  return NextResponse.json({ ok: true });
}
