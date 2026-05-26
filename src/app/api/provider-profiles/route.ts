import { NextResponse } from "next/server";
import { getRequestAuthContext } from "@/server/auth-core";
import { deleteManagedResource } from "@/server/governance-core";
import { listProviders, upsertProviderProfile } from "@/server/queries";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

async function requireSystemAdmin() {
  const authContext = await getRequestAuthContext();
  if (!authContext || authContext.user.isSystemAdmin !== 1) {
    return NextResponse.json({ ok: false, error: uiText("identityAccess.errors.adminRequired") }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const forbidden = await requireSystemAdmin();
  if (forbidden) return forbidden;
  return NextResponse.json({ providers: listProviders() });
}

export async function POST(request: Request) {
  const forbidden = await requireSystemAdmin();
  if (forbidden) return forbidden;
  try {
    const body = (await request.json()) as Parameters<typeof upsertProviderProfile>[0];
    const provider = upsertProviderProfile(body);
    return NextResponse.json({ ok: true, provider });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveProviderProfileFailed") },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const forbidden = await requireSystemAdmin();
  if (forbidden) return forbidden;
  try {
    const body = (await request.json()) as Parameters<typeof upsertProviderProfile>[0];
    const provider = upsertProviderProfile(body);
    return NextResponse.json({ ok: true, provider });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveProviderProfileFailed") },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const forbidden = await requireSystemAdmin();
  if (forbidden) return forbidden;
  const body = (await request.json()) as { id: string };
  deleteManagedResource({ type: "provider-profile", id: body.id });
  return NextResponse.json({ ok: true });
}
