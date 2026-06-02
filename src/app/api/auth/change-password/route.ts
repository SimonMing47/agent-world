import { NextResponse } from "next/server";
import { changeCurrentUserPassword, getRequestAuthContext } from "@/server/auth-core";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authContext = await getRequestAuthContext();
  if (!authContext) {
    return NextResponse.json({ ok: false, error: uiText("identityAccess.errors.signInRequired") }, { status: 401 });
  }
  if (!authContext.mustChangePassword) {
    return NextResponse.json({ ok: false, error: uiText("identityAccess.password.errors.notRequired") }, { status: 409 });
  }

  try {
    const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json(
        { ok: false, error: uiText("identityAccess.password.errors.required") },
        { status: 400 },
      );
    }

    changeCurrentUserPassword({
      userId: authContext.user.id,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? uiText(error.message, error.message) : uiText("identityAccess.password.errors.failed");
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
