"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import {
  builtInLanguagePacks,
  type LanguagePack,
} from "@/lib/language-pack";
import type { LanguagePackSettingValue } from "@/server/language-pack-store";

function languageDisplayName(
  pack: Pick<LanguagePack, "locale" | "name"> | undefined,
  fallback: string,
  text: (keyOrPhrase: string, fallback?: string) => string,
) {
  if (!pack) return fallback;
  return text(`settings.languageConfiguration.languageName.${pack.locale}`, pack.name);
}

export function LanguagePackSettingsForm({
  setting,
}: {
  setting: LanguagePackSettingValue;
}) {
  const router = useRouter();
  const text = useLanguageText();
  const [activeLocale, setActiveLocale] = useState(setting.activeLocale);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const builtInSummaries = useMemo(
    () => builtInLanguagePacks.map((pack) => ({
      id: pack.id,
      locale: pack.locale,
      name: pack.name,
      version: pack.version,
      direction: pack.direction,
      source: "built-in" as const,
    })),
    [],
  );
  const customSummaries = setting.customPacks.map((pack) => ({
    id: pack.id,
    locale: pack.locale,
    name: pack.name,
    version: pack.version,
    direction: pack.direction,
    source: "custom" as const,
  }));
  const availableLanguages = [...builtInSummaries, ...customSummaries];
  const activeLanguage = availableLanguages.find((pack) => pack.locale === activeLocale) ?? availableLanguages[0];

  async function saveLanguage(nextLocale = activeLocale, customPack?: LanguagePack) {
    const response = await fetch("/api/system-settings/language-pack", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeLocale: nextLocale, customPack }),
    });
    const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!response.ok || result.ok === false) {
      throw new Error(result.error ?? text("common.messages.saveFailed", "Save failed"));
    }
  }

  async function save() {
    setMessage(null);
    try {
      await saveLanguage();
      setMessage(text("settings.languageConfiguration.saved", "Language configuration saved."));
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("common.messages.saveFailed", "Save failed"));
    }
  }

  async function uploadLanguageTemplate(file: File) {
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text()) as LanguagePack;
      if (!parsed || typeof parsed.locale !== "string" || typeof parsed.name !== "string") {
        throw new Error(text("settings.languageConfiguration.invalidTemplate", "The uploaded language template is invalid."));
      }
      await saveLanguage(parsed.locale, parsed);
      setActiveLocale(parsed.locale);
      setMessage(text("settings.languageConfiguration.uploaded", "Language template uploaded and selected."));
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("settings.languageConfiguration.uploadFailed", "Language template upload failed."));
    }
  }

  return (
	    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
      <div className="space-y-4">
        <FieldGroup
          label={text("settings.languageConfiguration.locale", "Display Language")}
          hint={text("settings.languageConfiguration.uploadHint", "Upload a complete language JSON template. The locale and name in the file will be used as the new option.")}
        >
          <Select value={activeLocale} onChange={(event) => setActiveLocale(event.target.value)}>
            {availableLanguages.map((pack) => (
              <option key={pack.locale} value={pack.locale}>
                {languageDisplayName(pack, pack.name, text)} ({pack.locale})
              </option>
            ))}
          </Select>
        </FieldGroup>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-4">
          <div className="text-sm font-semibold text-[var(--ink)]">{text("settings.languageConfiguration.templateTitle", "Language Template")}</div>
          <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            {text("settings.languageConfiguration.templateDescription", "Download the full template, translate every value, then upload the JSON file to make it selectable here.")}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
	            <Button asChild variant="secondary">
	              <a href="/api/system-settings/language-pack/template" download="agentworld-language-template.json">
	                <Download className="h-4 w-4" />
	                {text("settings.languageConfiguration.downloadTemplate", "Download Template")}
	              </a>
	            </Button>
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              {text("settings.languageConfiguration.uploadTemplate", "Upload Language")}
            </Button>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadLanguageTemplate(file);
              }}
            />
          </div>
        </div>

        {message ? <div className="text-sm text-[var(--ink-muted)]">{message}</div> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={save} disabled={isPending}>
            {isPending ? text("actions.saving") : text("settings.languageConfiguration.save", "Save Language")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setActiveLocale("zh-CN")}>
            {text("settings.languageConfiguration.reset", "Use Built-In Chinese")}
          </Button>
        </div>
      </div>
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <div className="text-sm font-semibold text-[var(--ink)]">{text("settings.languageConfiguration.currentPack", "Current Language Pack")}</div>
        <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          {text("settings.languageConfiguration.currentPackDescription", "This preview shows the selected language metadata. Text overrides are managed by uploading complete language templates.")}
        </div>
	        <dl className="mt-4 space-y-3 text-sm">
	          <div>
	            <dt className="text-xs text-[var(--ink-subtle)]">{text("settings.languageConfiguration.metadata.locale", "Locale")}</dt>
	            <dd className="font-semibold text-[var(--ink)]">{activeLanguage?.locale ?? activeLocale}</dd>
	          </div>
	          <div>
	            <dt className="text-xs text-[var(--ink-subtle)]">{text("settings.languageConfiguration.metadata.name", "Name")}</dt>
	            <dd className="font-semibold text-[var(--ink)]">{languageDisplayName(activeLanguage, activeLocale, text)}</dd>
	          </div>
	          <div>
	            <dt className="text-xs text-[var(--ink-subtle)]">{text("settings.languageConfiguration.metadata.source", "Source")}</dt>
            <dd className="font-semibold text-[var(--ink)]">
              {activeLanguage?.source === "custom"
                ? text("settings.languageConfiguration.custom", "Custom")
                : text("settings.languageConfiguration.builtIn", "Built in")}
            </dd>
          </div>
        </dl>
	        <div className="mt-6 border-t border-[var(--line)] pt-4">
	          <div className="text-xs font-semibold text-[var(--ink-subtle)]">
            {text("settings.languageConfiguration.customLanguages", "Custom Languages")}
          </div>
          <div className="mt-3 space-y-2 text-sm text-[var(--ink-muted)]">
            {customSummaries.length ? customSummaries.map((pack) => (
              <div key={pack.locale} className="flex items-center justify-between gap-3">
                <span className="font-medium text-[var(--ink)]">{pack.name}</span>
                <span>{pack.locale}</span>
              </div>
            )) : text("settings.languageConfiguration.noCustomLanguages", "No custom languages uploaded yet.")}
          </div>
        </div>
      </div>
    </div>
  );
}
