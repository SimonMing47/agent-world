import { NextResponse } from "next/server";
import { readKnowledgeContent } from "@/server/knowledge-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const uri = url.searchParams.get("uri");
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

