import { NextResponse } from "next/server";
import {
  buildExtensionImportExample,
  getExtensionRegistrySnapshot,
  importExtensionBundle,
  type AgentWorldExtensionBundle,
} from "@/server/extension-core";

export function GET() {
  return NextResponse.json({
    ...getExtensionRegistrySnapshot(),
    importExample: buildExtensionImportExample(),
  });
}

export async function POST(request: Request) {
  const bundle = (await request.json()) as AgentWorldExtensionBundle;
  const result = importExtensionBundle(bundle);
  return NextResponse.json({ ok: true, result, registry: getExtensionRegistrySnapshot() });
}
