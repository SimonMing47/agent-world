import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { runKnowledgeRetrievalTest } from "@/server/openviking-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    knowledgeSpaceId?: string;
    query?: string;
  };

  if (!body.knowledgeSpaceId) {
    return NextResponse.json({ ok: false, error: uiText("knowledge.retrieval.errors.spaceRequired") }, { status: 400 });
  }

  if (!body.query?.trim()) {
    return NextResponse.json({ ok: false, error: uiText("knowledge.retrieval.errors.queryRequired") }, { status: 400 });
  }

  const hits = runKnowledgeRetrievalTest({
    knowledgeSpaceId: body.knowledgeSpaceId,
    query: body.query,
  });

  return NextResponse.json({
    ok: true,
    hits,
  });
}
