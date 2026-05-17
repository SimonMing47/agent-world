import { NextResponse } from "next/server";
import {
  listCodebaseOperatorTokens,
  listCodebases,
  upsertCodebase,
  upsertCodebaseOperatorToken,
} from "@/server/governance-core";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ codebases: listCodebases(), tokens: listCodebaseOperatorTokens() });
}

export async function POST(request: Request) {
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

