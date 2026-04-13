import { NextResponse } from "next/server";
import { refreshRuntimeCatalogs } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function POST() {
  const discoveries = await refreshRuntimeCatalogs();

  return NextResponse.json({
    count: discoveries.length,
    discoveries,
  });
}
