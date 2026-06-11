import { NextResponse } from "next/server";
import {
  getFindingFeedbackContext,
  recordFindingFeedback,
} from "@/server/finding-feedback-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function sourceIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const feedback = getFindingFeedbackContext(decodeURIComponent(token));
  if (!feedback) {
    return NextResponse.json(
      { ok: false, error: uiText("findingFeedback.errors.invalidToken") },
      { status: 404 },
    );
  }
  return NextResponse.json({
    ok: true,
    feedback: {
      token: feedback.token,
      finding: {
        id: feedback.finding.id,
        title: feedback.finding.title,
        severity: feedback.finding.severity,
        category: feedback.finding.category,
        description: feedback.finding.description,
        recommendation: feedback.finding.recommendation,
        evidence: feedback.evidence,
      },
      taskRun: {
        id: feedback.taskRun.id,
        sourceType: feedback.taskRun.sourceType,
        sourceRef: feedback.taskRun.sourceRef,
      },
      existingFeedback: feedback.existingFeedback
        ? {
            verdict: feedback.existingFeedback.verdict,
            note: feedback.existingFeedback.note,
            knowledgeUri: feedback.existingFeedback.knowledgeUri,
          }
        : null,
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = (await request.json()) as {
      verdict?: string;
      note?: string;
      writeKnowledge?: boolean;
      knowledgeLayer?: string;
      knowledgeScopePrefix?: string;
    };
    const result = await recordFindingFeedback({
      token: decodeURIComponent(token),
      verdict: body.verdict,
      note: body.note,
      sourceIp: sourceIp(request),
      writeKnowledge: body.writeKnowledge,
      knowledgeLayer: body.knowledgeLayer,
      knowledgeScopePrefix: body.knowledgeScopePrefix,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("findingFeedback.errors.submitFailed") },
      { status: 400 },
    );
  }
}
