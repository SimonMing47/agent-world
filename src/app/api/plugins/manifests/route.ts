import { NextResponse } from "next/server";
import {
  getPluginSecurityModel,
  listBuiltinPluginManifests,
  listPluginExtensionPoints,
} from "@/server/plugin-core";

export function GET() {
  return NextResponse.json({
    manifests: listBuiltinPluginManifests(),
    extensionPoints: listPluginExtensionPoints(),
    securityModel: getPluginSecurityModel(),
  });
}
