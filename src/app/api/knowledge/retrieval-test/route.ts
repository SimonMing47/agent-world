import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { apiAccessErrorResponse, requireAuthenticatedActor } from "@/server/api-access-control";
import { assertKnowledgeSpaceAccess } from "@/server/knowledge-session-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "knowledge-retrieval-console");
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

    assertKnowledgeSpaceAccess(authContext, body.knowledgeSpaceId, { allowGlobal: true });
    const { runKnowledgeRetrievalTest } = await import("@/server/knowledge-engine");
    const hits = runKnowledgeRetrievalTest({
      knowledgeSpaceId: body.knowledgeSpaceId,
      query: body.query,
    });

    return NextResponse.json({
      ok: true,
      hits,
    });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
}
