import { zhCNLanguagePack } from "@/locales/zh-CN";
import { enUSLanguagePack } from "@/locales/en-US";

export type LanguagePack = {
  id: string;
  locale: string;
  name: string;
  version: string;
  direction: "ltr" | "rtl";
  terminology: Record<string, string>;
  labels: Record<string, Record<string, string>>;
  navigation: Record<string, unknown>;
  actions: Record<string, string>;
  phrases: Record<string, string>;
  ui: Record<string, unknown>;
};

export type LanguagePackOverride = Partial<LanguagePack> & Record<string, unknown>;

export const defaultLanguagePack = zhCNLanguagePack;
export const builtInLanguagePacks = [zhCNLanguagePack, enUSLanguagePack] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function deepMerge<T extends Record<string, unknown>>(base: T, override: unknown): T {
  if (!isRecord(override)) return base;

  const output: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = output[key];
    output[key] = isRecord(current) && isRecord(value)
      ? deepMerge(current, value)
      : value;
  }
  return output as T;
}

export function parseLanguagePackOverride(raw: string | null | undefined) {
  if (!raw?.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  return isRecord(parsed) ? parsed : {};
}

export function mergeLanguagePack(override?: unknown): LanguagePack {
  return deepMerge(defaultLanguagePack, override) as LanguagePack;
}

export function cloneLanguagePack(pack: LanguagePack): LanguagePack {
  return JSON.parse(JSON.stringify(pack)) as LanguagePack;
}

export function createLanguagePackTemplate(base: LanguagePack = defaultLanguagePack): LanguagePack {
  return {
    ...cloneLanguagePack(base),
    id: "custom-locale",
    locale: "custom-locale",
    name: "New language",
    version: "1.0.0",
    direction: "ltr",
  };
}

function readPublicOverride() {
  const raw =
    process.env.NEXT_PUBLIC_AGENTWORLD_LANGUAGE_PACK_JSON ??
    process.env.AGENTWORLD_LANGUAGE_PACK_JSON ??
    process.env.NEXT_PUBLIC_AGENTWORLD_TERMINOLOGY_JSON ??
    process.env.AGENTWORLD_TERMINOLOGY_JSON;

  if (!raw) return {};
  try {
    const parsed = parseLanguagePackOverride(raw);
    if ("productName" in parsed || "businessTeam" in parsed || "agentTeam" in parsed) {
      return { terminology: parsed };
    }
    return parsed;
  } catch {
    return {};
  }
}

export const publicLanguagePack = mergeLanguagePack(readPublicOverride());

export function getPathValue(source: unknown, path: string) {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) return undefined;
    return current[segment];
  }, source);
}

function interpolate(value: string, params?: Record<string, string | number>) {
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (match, key) => {
    const nextValue = params[key];
    return nextValue === undefined ? match : String(nextValue);
  });
}

export function translateWithPack(
  pack: LanguagePack,
  keyOrPhrase: string,
  fallback?: string,
  params?: Record<string, string | number>,
) {
  const byPath = getPathValue(pack, keyOrPhrase);
  const value =
    (typeof byPath === "string" ? byPath : undefined) ??
    pack.phrases[keyOrPhrase] ??
    fallback ??
    keyOrPhrase;

  return interpolate(value, params);
}

export function uiText(
  keyOrPhrase: string,
  fallback?: string,
  params?: Record<string, string | number>,
) {
  return translateWithPack(publicLanguagePack, keyOrPhrase, fallback, params);
}

export function term(key: string) {
  return uiText(`terminology.${key}`);
}
