import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { filterByBusinessTeamAccess } from "@/server/auth-core";
import {
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
  requireExecutionEnvironmentActor,
} from "@/server/api-access-control";
import type { ExecutionEnvironment } from "@/server/db";

export const dynamic = "force-dynamic";

type ExecutionEnvironmentInput = Pick<
  ExecutionEnvironment,
  | "id"
  | "businessTeamId"
  | "name"
  | "repositoryProvider"
  | "repositoryName"
  | "repositoryUrl"
  | "defaultBranch"
  | "executorRef"
  | "privateKeyRef"
  | "workingDirectory"
  | "visibility"
  | "status"
> & {
  sandboxProfile?: Record<string, unknown>;
  memoryLayerRefs?: string[];
};

export async function GET(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "environment-console");
    const { listExecutionEnvironments } = await import("@/server/queries");
    const environments = filterByBusinessTeamAccess(
      listExecutionEnvironments(),
      access.authContext,
      (environment) => environment.businessTeamId,
    );
    return NextResponse.json({ environments });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

async function saveExecutionEnvironment(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "environment-console");
    const body = (await request.json()) as ExecutionEnvironmentInput;
    const { listExecutionEnvironments, upsertExecutionEnvironment } = await import("@/server/queries");
    const current = listExecutionEnvironments().find((environment) => environment.id === body.id);
    if (current) {
      assertBusinessTeamAccess(access.authContext, current.businessTeamId);
    }
    assertBusinessTeamAccess(access.authContext, body.businessTeamId);
    const environment = upsertExecutionEnvironment(body);
    return NextResponse.json({ ok: true, environment });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : uiText("ui.api.errors.saveExecutionEnvironmentFailed", "Failed to save execution environment."),
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  return saveExecutionEnvironment(request);
}

export async function PATCH(request: Request) {
  return saveExecutionEnvironment(request);
}

export async function DELETE(request: Request) {
  try {
    await requireAuthenticatedActor(request, "environment-console");
    const body = (await request.json()) as { id: string };
    await requireExecutionEnvironmentActor(request, body.id, "environment-console");
    const { deleteExecutionEnvironment } = await import("@/server/queries");
    deleteExecutionEnvironment(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : uiText("ui.api.errors.saveExecutionEnvironmentFailed", "Failed to save execution environment."),
      },
      { status: 400 },
    );
  }
}
