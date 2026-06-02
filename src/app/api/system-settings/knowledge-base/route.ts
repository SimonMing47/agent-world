import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { getRequestAuthContext } from "@/server/auth-core";
import {
  getKnowledgeBaseConfigWarnings,
  getKnowledgeBaseSettings,
  getKnowledgeFoundationStatus,
  upsertKnowledgeBaseSettings,
  writeOpenVikingConfigFiles,
  type KnowledgeBaseSettings,
} from "@/server/knowledge-base-settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authContext = await getRequestAuthContext(request);
  if (!authContext || authContext.user.isSystemAdmin !== 1) {
    return NextResponse.json({ ok: false, error: uiText("identityAccess.errors.adminRequired") }, { status: 403 });
  }

  const setting = getKnowledgeBaseSettings();
  return NextResponse.json({
    setting,
    foundation: getKnowledgeFoundationStatus(setting),
    warnings: getKnowledgeBaseConfigWarnings(setting),
  });
}

export async function PUT(request: Request) {
  const authContext = await getRequestAuthContext(request);
  if (!authContext || authContext.user.isSystemAdmin !== 1) {
    return NextResponse.json({ ok: false, error: uiText("identityAccess.errors.adminRequired") }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Partial<KnowledgeBaseSettings>;
    const setting = upsertKnowledgeBaseSettings(body, authContext.user.email || authContext.user.name || "system");
    const files = writeOpenVikingConfigFiles(setting);
    return NextResponse.json({
      ok: true,
      setting,
      files,
      foundation: getKnowledgeFoundationStatus(setting),
      warnings: getKnowledgeBaseConfigWarnings(setting),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("common.messages.saveFailed") },
      { status: 400 },
    );
  }
}
