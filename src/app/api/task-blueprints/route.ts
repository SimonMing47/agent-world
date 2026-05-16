import { NextResponse } from "next/server";
import { getTaskBlueprintsSnapshot } from "@/server/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getTaskBlueprintsSnapshot());
}
