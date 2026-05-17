import { NextResponse } from "next/server";
import { listSkills, upsertSkill } from "@/server/skill-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ skills: listSkills() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertSkill>[0];
  const skill = upsertSkill(body);
  return NextResponse.json({ ok: true, skill });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Parameters<typeof upsertSkill>[0];
  const skill = upsertSkill(body);
  return NextResponse.json({ ok: true, skill });
}

