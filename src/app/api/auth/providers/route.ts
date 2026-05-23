import { NextResponse } from "next/server";
import {
  deleteAuthProviderConfig,
  describeProviderConfig,
  getRequestAuthContext,
  listAuthAdapterCatalog,
  listAuthProviderConfigs,
  upsertAuthProviderConfig,
} from "@/server/auth-core";

export const dynamic = "force-dynamic";

async function ensureAdmin() {
  const authContext = await getRequestAuthContext();
  if (!authContext || authContext.user.isSystemAdmin !== 1) {
    return NextResponse.json({ ok: false, error: "identityAccess.errors.adminRequired" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await ensureAdmin();
  if (denied) return denied;
  return NextResponse.json({
    adapters: listAuthAdapterCatalog().map((adapter) => ({
      key: adapter.key,
      name: adapter.name,
      description: adapter.description,
      mode: adapter.mode,
      isBuiltIn: adapter.isBuiltIn,
      capabilities: adapter.capabilities,
      status: adapter.status,
    })),
    providers: listAuthProviderConfigs().map(describeProviderConfig),
  });
}

export async function POST(request: Request) {
  const denied = await ensureAdmin();
  if (denied) return denied;
  const body = (await request.json()) as Parameters<typeof upsertAuthProviderConfig>[0];
  const provider = upsertAuthProviderConfig(body);
  return NextResponse.json({ ok: true, provider: describeProviderConfig(provider!) });
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const denied = await ensureAdmin();
  if (denied) return denied;
  const body = (await request.json()) as { id: string };
  deleteAuthProviderConfig(body.id);
  return NextResponse.json({ ok: true });
}
