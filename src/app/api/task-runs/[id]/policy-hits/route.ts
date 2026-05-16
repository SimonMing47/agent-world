import { NextResponse } from "next/server";
import { getTaskRunPolicyHits } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const policyHits = getTaskRunPolicyHits(resolved.id);
  return NextResponse.json({ policyHits });
}
