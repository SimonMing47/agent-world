import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { apiAccessErrorResponse, requireSystemAdminActor } from "@/server/api-access-control";
import {
  getExtensionRegistrySnapshot,
  importExtensionBundle,
  importPluginPackageManifest,
  readPluginPackageManifestFromBuffer,
  type AgentWorldExtensionBundle,
} from "@/server/extension-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  try {
    await requireSystemAdminActor(request, "plugin-manifest-console");
    return NextResponse.json(getExtensionRegistrySnapshot());
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    await requireSystemAdminActor(request, "plugin-manifest-console");

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = [...form.values()].find((value): value is File => value instanceof File);
      if (!file) {
        return NextResponse.json({ ok: false, error: uiText("plugins.errors.packageFileRequired") }, { status: 400 });
      }
      const manifest = readPluginPackageManifestFromBuffer(file.name, Buffer.from(await file.arrayBuffer()));
      const result = importPluginPackageManifest(manifest, { source: file.name });
      return NextResponse.json({ ok: true, result, registry: getExtensionRegistrySnapshot() });
    }

    if (
      contentType.includes("application/zip") ||
      contentType.includes("application/x-zip-compressed") ||
      contentType.includes("application/octet-stream")
    ) {
      const url = new URL(request.url);
      const fileName = url.searchParams.get("filename") ?? "plugin.awp";
      const manifest = readPluginPackageManifestFromBuffer(fileName, Buffer.from(await request.arrayBuffer()));
      const result = importPluginPackageManifest(manifest, { source: fileName });
      return NextResponse.json({ ok: true, result, registry: getExtensionRegistrySnapshot() });
    }

    const payload = (await request.json()) as unknown;
    const isPluginManifest = isRecord(payload) && payload.kind === "AgentWorldPlugin";
    const pluginSource = isPluginManifest && isRecord(payload.metadata)
      ? String(payload.metadata.id ?? "json-manifest")
      : "json-manifest";
    const result =
      isPluginManifest
        ? importPluginPackageManifest(payload, { source: pluginSource })
        : importExtensionBundle(payload as AgentWorldExtensionBundle);
    return NextResponse.json({ ok: true, result, registry: getExtensionRegistrySnapshot() });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("common.messages.saveFailed") },
      { status: 400 },
    );
  }
}
