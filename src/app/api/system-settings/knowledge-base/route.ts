import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { getRequestAuthContext } from "@/server/auth-core";
import {
  getKnowledgeCodebaseEngineStatus,
  getKnowledgeBaseConfigWarnings,
  getKnowledgeBaseSettings,
  getKnowledgeFoundationStatus,
  upsertKnowledgeBaseSettings,
  type KnowledgeBaseSettings,
} from "@/server/knowledge-base-settings";
import { ensureKnowledgeEngineStorage } from "@/server/knowledge-engine-process";

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
    codebaseEngine: getKnowledgeCodebaseEngineStatus(setting),
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
    const storage = ensureKnowledgeEngineStorage();
    return NextResponse.json({
      ok: true,
      setting,
      storage,
      foundation: getKnowledgeFoundationStatus(setting),
      codebaseEngine: getKnowledgeCodebaseEngineStatus(setting),
      warnings: getKnowledgeBaseConfigWarnings(setting),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("common.messages.saveFailed") },
      { status: 400 },
    );
  }
}
