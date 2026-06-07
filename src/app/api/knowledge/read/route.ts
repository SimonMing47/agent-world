import { NextResponse } from "next/server";
import {
  requireKnowledgeApiAuthFailure,
  resolveKnowledgeApiAuthContext,
} from "@/server/knowledge-api-auth";
import { readKnowledgeContent } from "@/server/knowledge-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function guardRequest(request: Request) {
  const auth = await resolveKnowledgeApiAuthContext(request);
  if (!auth) {
    return requireKnowledgeApiAuthFailure();
  }
  return null;
}

export async function GET(request: Request) {
  const unauthorized = await guardRequest(request);
  if (unauthorized) {
    return NextResponse.json({ ok: false, error: unauthorized.error }, { status: unauthorized.status });
  }

  const url = new URL(request.url);
  const uri = url.searchParams.get("uri")?.trim() ?? "";
  const level = url.searchParams.get("level") ?? "L2";

  if (!uri) {
    return NextResponse.json({ ok: false, error: "uri is required" }, { status: 400 });
  }

  if (!["L0", "L1", "L2"].includes(level)) {
    return NextResponse.json({ ok: false, error: "level must be L0, L1, or L2" }, { status: 400 });
  }

  const content = await readKnowledgeContent(uri, level as "L0" | "L1" | "L2");

  return NextResponse.json({
    ok: true,
    uri,
    level,
    content,
  });
}

export async function POST(request: Request) {
  const unauthorized = await guardRequest(request);
  if (unauthorized) {
    return NextResponse.json({ ok: false, error: unauthorized.error }, { status: unauthorized.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    uri?: string;
    level?: "L0" | "L1" | "L2";
  };

  const uri = (body.uri ?? "").trim();
  const level = (body.level ?? "L2") as string;

  if (!uri) {
    return NextResponse.json({ ok: false, error: "uri is required" }, { status: 400 });
  }

  if (!["L0", "L1", "L2"].includes(level)) {
    return NextResponse.json({ ok: false, error: "level must be L0, L1, or L2" }, { status: 400 });
  }

  const content = await readKnowledgeContent(uri, level as "L0" | "L1" | "L2");

  return NextResponse.json({
    ok: true,
    uri,
    level,
    content,
  });
}
