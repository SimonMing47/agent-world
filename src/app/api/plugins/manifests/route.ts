import { NextResponse } from "next/server";
import { listBuiltinPluginManifests } from "@/server/plugin-core";

export function GET() {
  return NextResponse.json({ manifests: listBuiltinPluginManifests() });
}
