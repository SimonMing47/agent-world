import { execute, queryOne, type SystemSetting } from "@/server/db";
import {
  mergeLanguagePack,
  parseLanguagePackOverride,
  type LanguagePack,
} from "@/lib/language-pack";

export const LANGUAGE_PACK_SETTING_KEY = "language-pack";

export type LanguagePackSettingValue = {
  activeLocale: string;
  overrideJson: string;
};

function parseSetting(row: SystemSetting | null): LanguagePackSettingValue {
  if (!row) {
    return { activeLocale: "zh-CN", overrideJson: "{}" };
  }

  try {
    const parsed = JSON.parse(row.valueJson) as Partial<LanguagePackSettingValue>;
    return {
      activeLocale: typeof parsed.activeLocale === "string" ? parsed.activeLocale : "zh-CN",
      overrideJson: typeof parsed.overrideJson === "string" && parsed.overrideJson.trim()
        ? parsed.overrideJson
        : "{}",
    };
  } catch {
    return { activeLocale: "zh-CN", overrideJson: "{}" };
  }
}

export function getLanguagePackSetting() {
  const row = queryOne<SystemSetting>(
    "SELECT * FROM system_settings WHERE key = ?",
    LANGUAGE_PACK_SETTING_KEY,
  );
  return parseSetting(row);
}

export function getActiveLanguagePack(): LanguagePack {
  const setting = getLanguagePackSetting();
  const override = parseLanguagePackOverride(setting.overrideJson);
  return mergeLanguagePack({
    ...override,
    locale: setting.activeLocale,
  });
}

export function saveLanguagePackSetting(input: LanguagePackSettingValue, updatedBy = "system") {
  const now = new Date().toISOString();
  const normalized: LanguagePackSettingValue = {
    activeLocale: input.activeLocale || "zh-CN",
    overrideJson: input.overrideJson?.trim() || "{}",
  };
  parseLanguagePackOverride(normalized.overrideJson);

  execute(
    `
      INSERT INTO system_settings (key, value_json, updated_by, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `,
    LANGUAGE_PACK_SETTING_KEY,
    JSON.stringify(normalized),
    updatedBy,
    now,
  );

  return normalized;
}
