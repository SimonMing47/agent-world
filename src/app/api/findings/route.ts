import { NextResponse } from "next/server";
import { getDashboardSnapshot, listFindings } from "@/server/queries";
import { deleteFinding, updateFinding, upsertFinding } from "@/server/finding-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const snapshot = getDashboardSnapshot();
  return NextResponse.json({
    dashboard: snapshot.findingDashboard,
    findings: listFindings(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof upsertFinding>[0];
    const finding = upsertFinding(body);
    return NextResponse.json({ ok: true, finding });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存 Finding 失败。" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof updateFinding>[0];
    const finding = updateFinding(body);
    return NextResponse.json({ ok: true, finding });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "更新 Finding 失败。" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string };
  deleteFinding(body.id);
  return NextResponse.json({ ok: true });
}
