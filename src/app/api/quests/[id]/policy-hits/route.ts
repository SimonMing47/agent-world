import { NextResponse } from "next/server";
import { getQuestPolicyHits } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const policyHits = getQuestPolicyHits(resolved.id);
  return NextResponse.json({ policyHits });
}
