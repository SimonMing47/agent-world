import { getRuntimeSessionDetail, subscribeRuntimeSession } from "@/server/runtime-session-core";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const detail = getRuntimeSessionDetail(resolved.id);

  if (!detail) {
    return new Response("Not found", { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const write = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      write({
        type: "session_status",
        payload: {
          sessionId: detail.session.id,
          status: detail.session.status,
          isActive: detail.isActive,
          updatedAt: detail.session.updatedAt,
        },
      });

      const unsubscribe = subscribeRuntimeSession(resolved.id, write);
      const abort = () => {
        unsubscribe();
        controller.close();
      };

      request.signal.addEventListener("abort", abort, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
