import { NextResponse } from "next/server";
import {
  getWebhookEndpointByPathKey,
  listTaskBlueprints,
  listTaskRuns,
  submitTaskRunFromBlueprint,
} from "@/server/queries";
import {
  buildWebhookTaskInput,
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

export async function POST(request: Request, context: RouteContext) {
  const { pathKey } = await context.params;
  const webhook = getWebhookEndpointByPathKey(pathKey);

  if (!webhook || webhook.isEnabled !== 1) {
    return NextResponse.json({ ok: false, error: "webhook not found" }, { status: 404 });
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

  const inputPayload = buildWebhookTaskInput(pathKey, payload, request);
  const results = matchedBlueprints.map((blueprint) => {
    try {
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

      return {
        ok: true,
        blueprintId: blueprint.id,
        taskRunId: detail?.taskRun.id ?? null,
        status: detail?.taskRun.status ?? "created",
      };
    } catch (error) {
      return {
        ok: false,
        blueprintId: blueprint.id,
        error: error instanceof Error ? error.message : "submit failed",
      };
    }
  });

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
