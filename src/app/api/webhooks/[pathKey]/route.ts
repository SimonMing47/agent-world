import { NextResponse } from "next/server";
import {
  getWebhookEndpointByPathKey,
  executeTaskRunUntilSettled,
  listTaskBlueprints,
  listTaskRuns,
  submitTaskRunFromBlueprint,
} from "@/server/queries";
import {
  buildWebhookTaskInputForBlueprint,
  matchWebhookBlueprints,
  validateWebhookSecret,
} from "@/server/webhook-trigger-core";

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
  const webhook = getWebhookEndpointByPathKey(pathKey);

  if (!webhook || webhook.isEnabled !== 1) {
    return NextResponse.json({ ok: false, error: "webhook not found" }, { status: 404 });
  }

  const matchedBlueprints = matchWebhookBlueprints(pathKey, listTaskBlueprints());
  const recentRuns = listTaskRuns()
    .filter((taskRun) => matchedBlueprints.some((blueprint) => blueprint.id === taskRun.blueprintId))
    .slice(0, 8)
    .map((taskRun) => ({
      id: taskRun.id,
      blueprintId: taskRun.blueprintId,
      sourceRef: taskRun.sourceRef,
      status: taskRun.status,
      createdAt: taskRun.createdAt,
    }));

  return NextResponse.json({
    ok: true,
    pathKey,
    webhook,
    matchedBlueprints: matchedBlueprints.map((blueprint) => ({
      id: blueprint.id,
      name: blueprint.name,
      status: blueprint.status,
      category: blueprint.category,
    })),
    recentRuns,
  });
}

async function handleWebhookRequest(request: Request, context: RouteContext) {
  const { pathKey } = await context.params;
  const webhook = getWebhookEndpointByPathKey(pathKey);

  if (!webhook || webhook.isEnabled !== 1) {
    return NextResponse.json({ ok: false, error: "webhook not found" }, { status: 404 });
  }

  if (request.method !== webhook.method) {
    return NextResponse.json(
      { ok: false, error: `webhook ${pathKey} expects ${webhook.method}` },
      { status: 405 },
    );
  }

  const secretCheck = validateWebhookSecret(webhook, request);
  if (!secretCheck.ok) {
    return NextResponse.json(secretCheck, { status: secretCheck.status });
  }

  const payload = await readJson(request);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "request body must be valid JSON" }, { status: 400 });
  }

  const matchedBlueprints = matchWebhookBlueprints(pathKey, listTaskBlueprints()).filter(
    (blueprint) => blueprint.status === "active",
  );

  if (matchedBlueprints.length === 0) {
    return NextResponse.json(
      { ok: false, error: `no active webhook blueprint matched path ${pathKey}` },
      { status: 404 },
    );
  }

  const results = [];
  for (const blueprint of matchedBlueprints) {
    try {
      const inputPayload = await buildWebhookTaskInputForBlueprint({
        pathKey,
        payload,
        request,
        blueprint,
      });
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
      results.push({
        ok: false,
        blueprintId: blueprint.id,
        error: error instanceof Error ? error.message : "submit failed",
      });
    }
  }

  const hasSuccess = results.some((result) => result.ok);
  return NextResponse.json(
    {
      ok: hasSuccess,
      pathKey,
      matchedBlueprintCount: matchedBlueprints.length,
      results,
    },
    { status: hasSuccess ? 200 : 500 },
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
