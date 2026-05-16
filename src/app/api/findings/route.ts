import { NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/server/queries";

export const dynamic = "force-dynamic";

export function GET() {
  const snapshot = getDashboardSnapshot();
  return NextResponse.json({
    dashboard: snapshot.findingDashboard,
    findings: snapshot.findings,
  });
}
