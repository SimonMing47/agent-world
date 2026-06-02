import { NextResponse } from "next/server";
import { getRequestAuthContext } from "@/server/auth-core";
import {
  listCodebaseOperatorTokens,
  listCodebases,
  deleteManagedResource,
  upsertCodebase,
  upsertCodebaseOperatorToken,
} from "@/server/governance-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

async function requireSystemAdmin(request: Request) {
  const authContext = await getRequestAuthContext(request);
  if (!authContext || authContext.user.isSystemAdmin !== 1) {
    return NextResponse.json({ ok: false, error: uiText("identityAccess.errors.adminRequired") }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const forbidden = await requireSystemAdmin(request);
  if (forbidden) return forbidden;
  return NextResponse.json({ codebases: listCodebases(), tokens: listCodebaseOperatorTokens() });
}

export async function POST(request: Request) {
  const forbidden = await requireSystemAdmin(request);
  if (forbidden) return forbidden;
  const body = (await request.json()) as
    | (Parameters<typeof upsertCodebase>[0] & { entity?: "codebase" })
    | (Parameters<typeof upsertCodebaseOperatorToken>[0] & { entity: "token" });

  if (body.entity === "token") {
    const token = upsertCodebaseOperatorToken(body);
    return NextResponse.json({ ok: true, token });
  }

  const codebase = upsertCodebase(body);
  return NextResponse.json({ ok: true, codebase });
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const forbidden = await requireSystemAdmin(request);
  if (forbidden) return forbidden;
  const body = (await request.json()) as { id: string; entity?: "codebase" | "token" };
  deleteManagedResource({ type: body.entity === "token" ? "codebase-token" : "codebase", id: body.id });
  return NextResponse.json({ ok: true });
}
