import { NextResponse } from "next/server";
import { apiAccessErrorResponse, requireTaskBlueprintActor } from "@/server/api-access-control";
import { executeTaskRunTick, submitTaskRunFromBlueprint } from "@/server/queries";
import { TaskBlueprintReadinessError } from "@/server/task-blueprint-core";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const body = (await request.json().catch(() => ({}))) as {
    requestedBy?: string;
    inputPayload?: Record<string, unknown>;
    sourceRef?: string | null;
    priority?: number;
    parentTaskRunId?: string | null;
    autoStart?: boolean;
  };

  try {
    const { actor } = await requireTaskBlueprintActor(request, resolved.id, "blueprint-console");
    const detail = submitTaskRunFromBlueprint({
      blueprintId: resolved.id,
      requestedBy: body.requestedBy ?? actor,
      inputPayload: body.inputPayload,
      sourceRef: body.sourceRef,
      priority: body.priority,
      parentTaskRunId: body.parentTaskRunId,
    });
    const taskRunId = detail?.taskRun.id ?? null;
    if (body.autoStart !== false && taskRunId) {
      try {
        const startedDetail = await executeTaskRunTick(taskRunId, body.requestedBy ?? actor);
        return NextResponse.json({
          ok: true,
          taskRun: startedDetail?.taskRun ?? detail?.taskRun ?? null,
          detail: startedDetail ?? detail,
          autoStart: { ok: true },
        });
      } catch (startError) {
        return NextResponse.json({
          ok: true,
          taskRun: detail?.taskRun ?? null,
          detail,
          autoStart: {
            ok: false,
            error: startError instanceof Error ? startError.message : "ui.blueprintSubmit.messages.autoStartFailed",
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      taskRun: detail?.taskRun ?? null,
      detail,
      autoStart: { ok: false, skipped: true },
    });
  } catch (error) {
    const accessResponse = apiAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    if (error instanceof TaskBlueprintReadinessError) {
      return NextResponse.json(
        {
          ok: false,
          code: "task_blueprint_not_ready",
          error: error.message,
          readiness: error.readiness,
          blockedChecks: error.blockerChecks,
        },
        { status: 422 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        code: "task_blueprint_submit_failed",
        error: error instanceof Error ? error.message : "ui.blueprintSubmit.messages.submitFailed",
      },
      { status: 400 },
    );
  }
}
