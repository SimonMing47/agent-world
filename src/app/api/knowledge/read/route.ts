import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import {
  canReadKnowledgeUri,
  requireKnowledgeApiAuthFailure,
  resolveKnowledgeApiAuthContext,
  type KnowledgeApiAuthContext,
} from "@/server/knowledge-api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type KnowledgeReadLevel = "L0" | "L1" | "L2";

function isKnowledgeReadLevel(value: string): value is KnowledgeReadLevel {
  return value === "L0" || value === "L1" || value === "L2";
}

async function knowledgeReadResponse(auth: KnowledgeApiAuthContext, uri: string, level: string) {
  if (!uri) {
    return NextResponse.json(
      { ok: false, error: uiText("ui.api.errors.knowledgeUriRequired", "URI is required.") },
      { status: 400 },
    );
  }

  if (!isKnowledgeReadLevel(level)) {
    return NextResponse.json(
      { ok: false, error: uiText("ui.api.errors.knowledgeLevelInvalid", "Level must be L0, L1, or L2.") },
      { status: 400 },
    );
  }

  if (!canReadKnowledgeUri(auth, uri)) {
    return NextResponse.json(
      { ok: false, error: uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied.") },
      { status: 403 },
    );
  }

  const { readKnowledgeContent } = await import("@/server/knowledge-engine");
  const content = await readKnowledgeContent(uri, level);

  return NextResponse.json({
    ok: true,
    uri,
    level,
    content,
  });
}

export async function GET(request: Request) {
  const auth = await resolveKnowledgeApiAuthContext(request);
  if (!auth) {
    const unauthorized = requireKnowledgeApiAuthFailure();
    return NextResponse.json({ ok: false, error: unauthorized.error }, { status: unauthorized.status });
  }

  const url = new URL(request.url);
  const uri = url.searchParams.get("uri")?.trim() ?? "";
  const level = url.searchParams.get("level") ?? "L2";

  return knowledgeReadResponse(auth, uri, level);
}

export async function POST(request: Request) {
  const auth = await resolveKnowledgeApiAuthContext(request);
  if (!auth) {
    const unauthorized = requireKnowledgeApiAuthFailure();
    return NextResponse.json({ ok: false, error: unauthorized.error }, { status: unauthorized.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    uri?: string;
    level?: "L0" | "L1" | "L2";
  };

  const uri = (body.uri ?? "").trim();
  const level = (body.level ?? "L2") as string;

  return knowledgeReadResponse(auth, uri, level);
}
