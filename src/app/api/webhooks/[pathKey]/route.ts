import { NextResponse } from "next/server";
import {
  buildWebhookTaskInputForBlueprint,
  matchWebhookBlueprintsForEndpoint,
  validateWebhookSecret,
} from "@/server/webhook-trigger-core";
import { queryOne, type WebhookEndpoint } from "@/server/db";
import { uiText } from "@/lib/language-pack";

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

function getWebhookEndpointByPathKey(pathKey: string) {
  return queryOne<WebhookEndpoint>(
    "SELECT * FROM webhook_endpoints WHERE path_key = ? ORDER BY name ASC LIMIT 1",
    pathKey,
  );
}

function isTaskBlueprintReadinessError(error: unknown): error is {
  readiness: unknown;
  blockerChecks: unknown;
} {
  return error instanceof Error && error.name === "TaskBlueprintReadinessError";
}

export async function GET(_request: Request, context: RouteContext) {
  const { pathKey } = await context.params;
  return NextResponse.json(
    { ok: false, error: uiText("ui.api.errors.webhookEndpointNotFound", "Webhook endpoint does not exist."), pathKey },
    { status: 404 },
  );
}

async function handleWebhookRequest(request: Request, context: RouteContext) {
  const { pathKey } = await context.params;
  const webhook = getWebhookEndpointByPathKey(pathKey);

  if (!webhook || webhook.isEnabled !== 1) {
    return NextResponse.json(
      { ok: false, error: uiText("ui.api.errors.webhookEndpointNotFound", "Webhook endpoint does not exist.") },
      { status: 404 },
    );
  }

  if (request.method !== webhook.method) {
    return NextResponse.json(
      { ok: false, error: uiText("webhook.errors.methodNotAllowed", undefined, { method: webhook.method }) },
      { status: 405 },
    );
  }

  const secretCheck = validateWebhookSecret(webhook, request);
  if (!secretCheck.ok) {
    return NextResponse.json(secretCheck, { status: secretCheck.status });
  }

  const payload = await readJson(request);
  if (!payload) {
    return NextResponse.json({ ok: false, error: uiText("webhook.errors.requestJsonInvalid") }, { status: 400 });
  }

  const {
    executeTaskRunUntilSettled,
    listTaskBlueprints,
    submitTaskRunFromBlueprint,
  } = await import("@/server/queries");
  const { attachRegisteredCodebaseToInput } = await import("@/server/task-worktree-core");
  const matchedBlueprints = matchWebhookBlueprintsForEndpoint(webhook, listTaskBlueprints()).filter(
    (blueprint) => blueprint.status === "active",
  );

  if (matchedBlueprints.length === 0) {
    return NextResponse.json(
      { ok: false, error: uiText("webhook.errors.noActiveBlueprintMatched", undefined, { pathKey }) },
      { status: 404 },
    );
  }

  const results = [];
  for (const blueprint of matchedBlueprints) {
    try {
      const inputPayload = attachRegisteredCodebaseToInput(await buildWebhookTaskInputForBlueprint({
        pathKey,
        payload,
        request,
        blueprint,
      }));
      const detail = submitTaskRunFromBlueprint({
        blueprintId: blueprint.id,
        requestedBy: String(inputPayload.author ?? "webhook"),
        priority: 88,
        sourceRef: [
          pathKey,
          inputPayload.repo_id,
          inputPayload.mr_id ?? inputPayload.diff_ref ?? inputPayload.event_name,
        ]
          .filter(Boolean)
          .join(":"),
        inputPayload,
      });
      const dispatch = detail?.taskRun.id
        ? await executeTaskRunUntilSettled(detail.taskRun.id, "webhook-dispatcher", 20)
        : null;

      results.push({
        ok: true,
        blueprintId: blueprint.id,
        taskRunId: detail?.taskRun.id ?? null,
        status: dispatch?.status ?? detail?.taskRun.status ?? "created",
        dispatch: dispatch
          ? {
              tickCount: dispatch.tickCount,
              stoppedReason: dispatch.stoppedReason,
            }
          : null,
      });
    } catch (error) {
      const readinessError = isTaskBlueprintReadinessError(error) ? error : null;
      results.push({
        ok: false,
        blueprintId: blueprint.id,
        code: readinessError ? "task_blueprint_not_ready" : "webhook_dispatch_failed",
        error: error instanceof Error ? error.message : "submit failed",
        readiness: readinessError?.readiness,
        blockedChecks: readinessError?.blockerChecks,
      });
    }
  }

  const hasSuccess = results.some((result) => result.ok);
  const hasOnlyReadinessFailures =
    results.length > 0 && results.every((result) => !result.ok && result.code === "task_blueprint_not_ready");
  return NextResponse.json(
    {
      ok: hasSuccess,
      pathKey,
      matchedBlueprintCount: matchedBlueprints.length,
      results,
    },
    { status: hasSuccess ? 200 : hasOnlyReadinessFailures ? 422 : 500 },
  );
}

export async function POST(request: Request, context: RouteContext) {
  return handleWebhookRequest(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return handleWebhookRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleWebhookRequest(request, context);
}
