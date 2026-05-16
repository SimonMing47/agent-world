import { NextResponse } from "next/server";
import { getArchitectureCases, getArchitectureLayers } from "@/server/architecture-core";

export function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    layers: getArchitectureLayers(),
    cases: getArchitectureCases(),
  });
}
