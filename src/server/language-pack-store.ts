import { execute, queryOne, type SystemSetting } from "@/server/db";
import {
  builtInLanguagePacks,
  cloneLanguagePack,
  defaultLanguagePack,
  type LanguagePack,
} from "@/lib/language-pack";

export const LANGUAGE_PACK_SETTING_KEY = "language-pack";

export type LanguageConfigurationSettingValue = {
  activeLocale: string;
  customPacks: LanguagePack[];
};

export type LanguagePackSettingValue = LanguageConfigurationSettingValue;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeLanguagePack(input: unknown): LanguagePack {
  if (!isRecord(input)) throw new Error("language template must be a JSON object");
  const locale = typeof input.locale === "string" ? input.locale.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!locale || !name) throw new Error("language template requires locale and name");

  return {
    ...cloneLanguagePack(defaultLanguagePack),
    ...input,
    id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : locale,
    locale,
    name,
    version: typeof input.version === "string" && input.version.trim() ? input.version.trim() : "1.0.0",
    direction: input.direction === "rtl" ? "rtl" : "ltr",
    terminology: isRecord(input.terminology) ? input.terminology as Record<string, string> : defaultLanguagePack.terminology,
    labels: isRecord(input.labels) ? input.labels as LanguagePack["labels"] : defaultLanguagePack.labels,
    navigation: isRecord(input.navigation) ? input.navigation : defaultLanguagePack.navigation,
    actions: isRecord(input.actions) ? input.actions as Record<string, string> : defaultLanguagePack.actions,
    phrases: isRecord(input.phrases) ? input.phrases as Record<string, string> : defaultLanguagePack.phrases,
    ui: isRecord(input.ui) ? input.ui : defaultLanguagePack.ui,
  };
}

function normalizeCustomPacks(value: unknown) {
  if (!Array.isArray(value)) return [];
  const builtInLocales = new Set(builtInLanguagePacks.map((pack) => pack.locale));
  const byLocale = new Map<string, LanguagePack>();
  for (const item of value) {
    try {
      const pack = normalizeLanguagePack(item);
      if (!builtInLocales.has(pack.locale)) byLocale.set(pack.locale, pack);
    } catch {
      continue;
    }
  }
  return [...byLocale.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function parseSetting(row: SystemSetting | null): LanguageConfigurationSettingValue {
  if (!row) {
    return { activeLocale: "zh-CN", customPacks: [] };
  }

  try {
    const parsed = JSON.parse(row.valueJson) as Record<string, unknown>;
    const customPacks = normalizeCustomPacks(parsed.customPacks);
    const availableLocales = new Set([...builtInLanguagePacks.map((pack) => pack.locale), ...customPacks.map((pack) => pack.locale)]);
    const activeLocale = typeof parsed.activeLocale === "string" && availableLocales.has(parsed.activeLocale)
      ? parsed.activeLocale
      : "zh-CN";
    return {
      activeLocale,
      customPacks,
    };
  } catch {
    return { activeLocale: "zh-CN", customPacks: [] };
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
  return getAvailableLanguagePacks().find((pack) => pack.locale === setting.activeLocale) ?? defaultLanguagePack;
}

export function getAvailableLanguagePacks(): LanguagePack[] {
  const setting = getLanguagePackSetting();
  return [...builtInLanguagePacks.map((pack) => cloneLanguagePack(pack)), ...setting.customPacks.map((pack) => cloneLanguagePack(pack))];
}

export function saveLanguagePackSetting(input: Partial<LanguageConfigurationSettingValue> & { customPack?: unknown }, updatedBy = "system") {
  const now = new Date().toISOString();
  const current = getLanguagePackSetting();
  const builtInLocales = new Set(builtInLanguagePacks.map((pack) => pack.locale));
  const customPacksByLocale = new Map(current.customPacks.map((pack) => [pack.locale, pack]));

  if (input.customPack) {
    const pack = normalizeLanguagePack(input.customPack);
    if (builtInLocales.has(pack.locale)) {
      throw new Error("custom language locale conflicts with a built-in language");
    }
    customPacksByLocale.set(pack.locale, pack);
  }

  const customPacks = normalizeCustomPacks([...(input.customPacks ?? [...customPacksByLocale.values()])]);
  const availableLocales = new Set([...builtInLocales, ...customPacks.map((pack) => pack.locale)]);
  const activeLocale = input.activeLocale && availableLocales.has(input.activeLocale) ? input.activeLocale : current.activeLocale;
  const normalized: LanguageConfigurationSettingValue = {
    activeLocale: availableLocales.has(activeLocale) ? activeLocale : "zh-CN",
    customPacks,
  };

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
