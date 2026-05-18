import { NextResponse } from "next/server";
import { refreshRuntimeCatalogs } from "@/server/queries";

export const dynamic = "force-dynamic";

async function discoverRuntimes() {
  const discoveries = await refreshRuntimeCatalogs();

  return NextResponse.json({
    count: discoveries.length,
    discoveries,
  });
}

export async function GET() {
  return discoverRuntimes();
}

export async function POST() {
  return discoverRuntimes();
}
