"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { defaultLanguagePack } from "@/lib/language-pack";
import type { LanguagePackSettingValue } from "@/server/language-pack-store";

export function LanguagePackSettingsForm({
  setting,
}: {
  setting: LanguagePackSettingValue;
}) {
  const router = useRouter();
  const text = useLanguageText();
  const [activeLocale, setActiveLocale] = useState(setting.activeLocale);
  const [overrideJson, setOverrideJson] = useState(setting.overrideJson);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const defaultPreview = useMemo(
    () => JSON.stringify(
      {
        terminology: {
          productName: defaultLanguagePack.terminology.productName,
          businessTeam: defaultLanguagePack.terminology.businessTeam,
          agentTeam: defaultLanguagePack.terminology.agentTeam,
        },
        actions: {
          open: defaultLanguagePack.actions.open,
        },
      },
      null,
      2,
    ),
    [],
  );

  async function save() {
    setMessage(null);
    try {
      JSON.parse(overrideJson || "{}");
      const response = await fetch("/api/system-settings/language-pack", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeLocale, overrideJson }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) {
        throw new Error(result.error ?? text("common.messages.saveFailed", "保存失败"));
      }
      setMessage(text("common.messages.saved", "已保存"));
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("common.messages.saveFailed", "保存失败"));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <FieldGroup label={text("settings.languagePack.locale", "语言")}>
          <Select value={activeLocale} onChange={(event) => setActiveLocale(event.target.value)}>
            <option value="zh-CN">{text("settings.languagePack.locale.zhCN", "简体中文")}</option>
          </Select>
        </FieldGroup>
        <FieldGroup
          label={text("settings.languagePack.overrideJson", "语言包覆盖 JSON")}
          hint={text("settings.languagePack.overrideJsonHint", "覆盖需要定制的术语、动作和界面文案。")}
        >
          <Textarea
            className="min-h-[260px] font-mono text-xs"
            value={overrideJson}
            onChange={(event) => setOverrideJson(event.target.value)}
            placeholder={defaultPreview}
          />
        </FieldGroup>
        {message ? <div className="text-sm text-[var(--ink-muted)]">{message}</div> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={save} disabled={isPending}>
            {isPending ? text("actions.saving") : text("actions.save")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOverrideJson("{}")}>
            {text("actions.reset")}
          </Button>
        </div>
      </div>
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <div className="text-sm font-semibold text-[var(--ink)]">{text("settings.languagePack.previewTitle", "当前默认语言包")}</div>
        <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          {text("settings.languagePack.previewDescription", "这个示例展示当前默认术语和动作，你可以在左侧 JSON 中覆盖它们。")}
        </div>
        <pre className="mt-4 max-h-[300px] overflow-auto rounded-lg bg-[var(--surface)] p-3 text-xs leading-5 text-[var(--ink-muted)]">
          {defaultPreview}
        </pre>
      </div>
    </div>
  );
}
