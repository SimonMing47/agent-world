import { NextResponse } from "next/server";
import { recordReviewFeedback } from "@/server/code-review-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlResponse(result: Awaited<ReturnType<typeof recordReviewFeedback>>) {
  const status = result.ok ? "反馈已记录" : "反馈记录失败";
  const body = result.ok
    ? `AgentWorld 已将你的反馈写入 OpenViking 分层知识库。知识 URI：${result.knowledgeUri}`
    : (result.error ?? "未知错误");

  return new Response(
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(status)}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f7f3ea;
        color: #27231d;
        font-family: ui-serif, Georgia, "Times New Roman", serif;
      }
      main {
        width: min(680px, calc(100vw - 40px));
        border: 1px solid #e1d6c2;
        border-radius: 28px;
        padding: 36px;
        background: rgba(255, 252, 246, 0.9);
        box-shadow: 0 24px 70px rgba(67, 54, 36, 0.12);
      }
      h1 {
        margin: 0 0 14px;
        font-size: 28px;
      }
      p {
        margin: 0;
        line-height: 1.8;
      }
      code {
        overflow-wrap: anywhere;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(status)}</h1>
      <p><code>${escapeHtml(body)}</code></p>
    </main>
  </body>
</html>`,
    {
      status: result.status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const url = new URL(request.url);
  const verdict = url.searchParams.get("verdict") ?? "";
  const note = url.searchParams.get("note");
  const result = await recordReviewFeedback(token, verdict, note, requestIp(request));

  return htmlResponse(result);
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { verdict?: string; note?: string };
  const result = await recordReviewFeedback(token, body.verdict ?? "", body.note ?? null, requestIp(request));

  return NextResponse.json(result, { status: result.status });
}
