import { NextResponse } from "next/server";
import { getRequestAuthContext } from "@/server/auth-core";
import {
  getExtensionRegistrySnapshot,
  importExtensionBundle,
  importPluginPackageManifest,
  readPluginPackageManifestFromBuffer,
  type AgentWorldExtensionBundle,
} from "@/server/extension-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function ensureAdmin(request: Request) {
  const authContext = await getRequestAuthContext(request);
  if (!authContext || authContext.user.isSystemAdmin !== 1) {
    return NextResponse.json({ ok: false, error: "identityAccess.errors.adminRequired" }, { status: 403 });
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const denied = await ensureAdmin(request);
  if (denied) return denied;
  return NextResponse.json(getExtensionRegistrySnapshot());
}

export async function POST(request: Request) {
  const denied = await ensureAdmin(request);
  if (denied) return denied;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = [...form.values()].find((value): value is File => value instanceof File);
    if (!file) {
      return NextResponse.json({ ok: false, error: "plugins.errors.packageFileRequired" }, { status: 400 });
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
}
