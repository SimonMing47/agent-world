"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
        phrases: {
          系统配置: "系统配置",
          打开: "打开",
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
        throw new Error(result.error ?? "语言包配置保存失败。");
      }
      setMessage("语言包配置已保存。");
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "语言包 JSON 格式不正确。");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <FieldGroup label="当前语言包">
          <Select value={activeLocale} onChange={(event) => setActiveLocale(event.target.value)}>
            <option value="zh-CN">简体中文</option>
          </Select>
        </FieldGroup>
        <FieldGroup
          label="语言包覆盖 JSON"
          hint="只需要填写要覆盖的字段；系统会和默认语言包深度合并。"
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
            {isPending ? "保存中" : "保存语言包配置"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOverrideJson("{}")}>
            恢复默认
          </Button>
        </div>
      </div>
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <div className="text-sm font-semibold text-[var(--ink)]">当前默认语言包</div>
        <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          默认提供简体中文。后续新增企业术语、行业表达或英文包时，只需导入新的 JSON 覆盖。
        </div>
        <pre className="mt-4 max-h-[300px] overflow-auto rounded-lg bg-[var(--surface)] p-3 text-xs leading-5 text-[var(--ink-muted)]">
          {defaultPreview}
        </pre>
      </div>
    </div>
  );
}
