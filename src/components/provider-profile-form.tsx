"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ProviderProfileFormProps = {
  provider: {
    id: string;
    tenantSpaceId: string;
    name: string;
    baseUrl: string;
    apiStyle: string;
    defaultModel: string;
    modelsJson: string;
    apiKeyRef: string;
    configJson: string;
    isEnabled: number;
  };
  title: string;
};

function normalizeJson(value: string, fallback: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return fallback;
  }
}

function normalizeModelList(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).join("\n") : "gpt-5.4";
  } catch {
    return "gpt-5.4";
  }
}

export function ProviderProfileForm({ provider, title }: ProviderProfileFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: provider.id,
    tenantSpaceId: provider.tenantSpaceId,
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiStyle: provider.apiStyle,
    defaultModel: provider.defaultModel,
    modelList: normalizeModelList(provider.modelsJson),
    apiKeyRef: provider.apiKeyRef,
    configJson: normalizeJson(provider.configJson, "{}"),
    isEnabled: provider.isEnabled === 1,
  });

  async function save() {
    setIsSaving(true);
    setMessage(null);

    try {
      JSON.parse(form.configJson);
    } catch {
      setIsSaving(false);
      setMessage("JSON 格式不正确");
      return;
    }

    const models = form.modelList
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    if (models.length === 0) {
      setIsSaving(false);
      setMessage("请至少配置一个模型");
      return;
    }

    const response = await fetch("/api/provider-profiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id || crypto.randomUUID(),
        tenantSpaceId: form.tenantSpaceId,
        name: form.name,
        baseUrl: form.baseUrl,
        apiStyle: form.apiStyle,
        defaultModel: form.defaultModel,
        modelsJson: JSON.stringify(models, null, 2),
        apiKeyRef: form.apiKeyRef,
        configJson: form.configJson,
        isEnabled: form.isEnabled ? 1 : 0,
      }),
    });

    setIsSaving(false);
    if (!response.ok) {
      setMessage("保存失败");
      return;
    }

    setMessage("已保存");
    router.refresh();
  }

  return (
    <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-base font-semibold text-[var(--ink)]">{title}</div>
        <label className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })}
          />
          启用
        </label>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Provider 名称"
        />
        <select
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.apiStyle}
          onChange={(event) => setForm({ ...form, apiStyle: event.target.value })}
        >
          {[
            ["openai", "OpenAI / Responses"],
            ["anthropic", "Anthropic"],
            ["azure-openai", "Azure OpenAI"],
            ["openrouter", "OpenRouter"],
            ["custom", "Custom HTTP"],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.baseUrl}
          onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
          placeholder="Base URL"
        />
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.defaultModel}
          onChange={(event) => setForm({ ...form, defaultModel: event.target.value })}
          placeholder="默认模型"
        />
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)] md:col-span-2"
          value={form.apiKeyRef}
          onChange={(event) => setForm({ ...form, apiKeyRef: event.target.value })}
          placeholder="API Key 引用，例如 env:OPENAI_API_KEY"
        />
      </div>
      <textarea
        className="mt-2 min-h-24 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm leading-6 text-[var(--ink)]"
        value={form.modelList}
        onChange={(event) => setForm({ ...form, modelList: event.target.value })}
        placeholder={"gpt-5.4\ngpt-5.4-mini"}
      />
      <textarea
        className="mt-2 min-h-24 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm leading-6 text-[var(--ink)]"
        value={form.configJson}
        onChange={(event) => setForm({ ...form, configJson: event.target.value })}
        placeholder='{"supportsResponsesApi": true}'
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-50"
        >
          {isSaving ? "保存中" : "保存模型接口"}
        </button>
        {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
      </div>
    </div>
  );
}
