import { NextResponse } from "next/server";
import {
  getActiveLanguagePack,
  getLanguagePackSetting,
  saveLanguagePackSetting,
} from "@/server/language-pack-store";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    setting: getLanguagePackSetting(),
    languagePack: getActiveLanguagePack(),
  });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { activeLocale?: string; overrideJson?: string };
    const setting = saveLanguagePackSetting({
      activeLocale: body.activeLocale ?? "zh-CN",
      overrideJson: body.overrideJson ?? "{}",
    });
    return NextResponse.json({ ok: true, setting, languagePack: getActiveLanguagePack() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "语言包配置保存失败。" },
      { status: 400 },
    );
  }
}
