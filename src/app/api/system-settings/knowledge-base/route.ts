import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { apiAccessErrorResponse, requireSystemAdminActor } from "@/server/api-access-control";
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
  try {
    await requireSystemAdminActor(request, "knowledge-base-settings");
    const setting = getKnowledgeBaseSettings();
    return NextResponse.json({
      setting,
      foundation: getKnowledgeFoundationStatus(setting),
      codebaseEngine: getKnowledgeCodebaseEngineStatus(setting),
      warnings: getKnowledgeBaseConfigWarnings(setting),
    });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function PUT(request: Request) {
  try {
    const access = await requireSystemAdminActor(request, "knowledge-base-settings");
    const body = (await request.json()) as Partial<KnowledgeBaseSettings>;
    const setting = upsertKnowledgeBaseSettings(body, access.actor);
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
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("common.messages.saveFailed") },
      { status: 400 },
    );
  }
}
