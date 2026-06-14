import { NextResponse } from "next/server";
import { apiAccessErrorResponse, requireSystemAdminActor } from "@/server/api-access-control";

export const dynamic = "force-dynamic";

async function discoverRuntimes(request: Request) {
  await requireSystemAdminActor(request, "runtime-discovery-console");
  const { refreshRuntimeCatalogs } = await import("@/server/queries");
  const discoveries = await refreshRuntimeCatalogs();

  return NextResponse.json({
    count: discoveries.length,
    discoveries,
  });
}

export async function GET(request: Request) {
  try {
    return await discoverRuntimes(request);
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    return await discoverRuntimes(request);
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}
