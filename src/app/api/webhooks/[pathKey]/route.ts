import { NextResponse } from "next/server";
import { listMergeRequestReviews, runMergeRequestReview } from "@/server/code-review-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ pathKey: string }>;
};

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const { pathKey } = await context.params;

  return NextResponse.json({
    pathKey,
    purpose: "Webhook intake resolved by AgentWorld task templates and plugin manifests",
    expectedMethod: "POST",
    recentReviews: listMergeRequestReviews(10),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { pathKey } = await context.params;
  const payload = await readJson(request);

  if (!payload) {
    return NextResponse.json(
      {
        ok: false,
        error: "request body must be valid JSON",
      },
      { status: 400 },
    );
  }

  const result = await runMergeRequestReview(pathKey, request, payload);
  return NextResponse.json(result, { status: result.status });
}
