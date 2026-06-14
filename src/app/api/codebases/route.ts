import { NextResponse } from "next/server";
import {
  filterByBusinessTeamAccess,
} from "@/server/auth-core";
import {
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
  requireCodebaseActor,
  requireCodebaseOperatorTokenActor,
} from "@/server/api-access-control";
import type { CodebaseOperatorToken, CodebaseProfile } from "@/server/db";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

type CodebaseInput = Partial<CodebaseProfile> & Pick<CodebaseProfile, "businessTeamId" | "name" | "repositoryUrl">;
type CodebaseOperatorTokenInput = Partial<CodebaseOperatorToken> &
  Pick<CodebaseOperatorToken, "codebaseId" | "operatorName" | "tokenRef" | "role"> & {
    entity: "token";
  };

export async function GET(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "codebase-console");
    const { listCodebaseOperatorTokens, listCodebases } = await import("@/server/governance-core");
    const codebases = filterByBusinessTeamAccess(
      listCodebases(),
      access.authContext,
      (codebase) => codebase.businessTeamId,
    );
    const visibleCodebaseIds = new Set(codebases.map((codebase) => codebase.id));
    const tokens = listCodebaseOperatorTokens().filter((token) => visibleCodebaseIds.has(token.codebaseId));
    return NextResponse.json({ codebases, tokens });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "codebase-console");
    const body = (await request.json()) as (CodebaseInput & { entity?: "codebase" }) | CodebaseOperatorTokenInput;
    const {
      listCodebases,
      upsertCodebase,
      upsertCodebaseOperatorToken,
    } = await import("@/server/governance-core");

    if (body.entity === "token") {
      const current = body.id
        ? await requireCodebaseOperatorTokenActor(request, body.id, "codebase-console")
        : null;
      const targetCodebaseId = body.codebaseId ?? current?.token.codebaseId;
      if (!targetCodebaseId) {
        assertBusinessTeamAccess(access.authContext, null);
        throw new Error(uiText("ui.api.errors.codebaseNotFound", "Codebase does not exist."));
      }
      await requireCodebaseActor(request, targetCodebaseId, "codebase-console");
      const token = upsertCodebaseOperatorToken(body);
      return NextResponse.json({ ok: true, token });
    }

    const current = body.id ? listCodebases().find((codebase) => codebase.id === body.id) : null;
    if (current) {
      assertBusinessTeamAccess(access.authContext, current.businessTeamId);
    }
    const targetBusinessTeamId = body.businessTeamId ?? current?.businessTeamId;
    assertBusinessTeamAccess(access.authContext, targetBusinessTeamId);
    const codebase = upsertCodebase(body);
    return NextResponse.json({ ok: true, codebase });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveCodebaseFailed") },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  try {
    await requireAuthenticatedActor(request, "codebase-console");
    const body = (await request.json()) as { id: string; entity?: "codebase" | "token" };
    if (body.entity === "token") {
      await requireCodebaseOperatorTokenActor(request, body.id, "codebase-console");
    } else {
      await requireCodebaseActor(request, body.id, "codebase-console");
    }
    const { deleteManagedResource } = await import("@/server/governance-core");
    deleteManagedResource({ type: body.entity === "token" ? "codebase-token" : "codebase", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveCodebaseFailed") },
      { status: 400 },
    );
  }
}
