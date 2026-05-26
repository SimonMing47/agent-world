import { NextResponse } from "next/server";
import {
  getActiveLanguagePack,
  getAvailableLanguagePacks,
  getLanguagePackSetting,
  saveLanguagePackSetting,
} from "@/server/language-pack-store";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    setting: getLanguagePackSetting(),
    languagePack: getActiveLanguagePack(),
    availableLanguagePacks: getAvailableLanguagePacks().map((pack) => ({
      id: pack.id,
      locale: pack.locale,
      name: pack.name,
      version: pack.version,
      direction: pack.direction,
    })),
  });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { activeLocale?: string; customPack?: unknown };
    const setting = saveLanguagePackSetting({
      activeLocale: body.activeLocale ?? "zh-CN",
      customPack: body.customPack,
    });
    return NextResponse.json({
      ok: true,
      setting,
      languagePack: getActiveLanguagePack(),
      availableLanguagePacks: getAvailableLanguagePacks().map((pack) => ({
        id: pack.id,
        locale: pack.locale,
        name: pack.name,
        version: pack.version,
        direction: pack.direction,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.api.errors.saveLanguagePackFailed") },
      { status: 400 },
    );
  }
}
