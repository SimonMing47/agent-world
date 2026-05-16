"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ProviderRuntimeBindingFormProps = {
  binding: {
    id: string;
    tenantSpaceId: string;
    businessTeamId: string | null;
    adapterDefinitionId: string;
    name: string;
    runtimeKind: string;
    baseUrl: string;
    command: string;
    workspaceRoot: string;
    defaultProviderProfileId: string | null;
    apiKeyRef: string;
    configJson: string;
    isEnabled: number;
  };
  title: string;
  providerOptions: Array<{ id: string; name: string }>;
  adapterOptions: Array<{ id: string; name: string }>;
};

function normalizeJson(value: string, fallback: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return fallback;
  }
}

function parseConfig(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function ProviderRuntimeBindingForm({
  binding,
  title,
  providerOptions,
  adapterOptions,
}: ProviderRuntimeBindingFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const parsedConfig = parseConfig(binding.configJson);
  const [form, setForm] = useState({
    id: binding.id,
    tenantSpaceId: binding.tenantSpaceId,
    businessTeamId: binding.businessTeamId ?? "",
    adapterDefinitionId: binding.adapterDefinitionId,
    name: binding.name,
    runtimeKind: binding.runtimeKind,
    baseUrl: binding.baseUrl,
    command: binding.command,
    workspaceRoot: binding.workspaceRoot,
    defaultProviderProfileId: binding.defaultProviderProfileId ?? "",
    apiKeyRef: binding.apiKeyRef,
    defaultModel:
      typeof parsedConfig.defaultModel === "string" ? parsedConfig.defaultModel : "",
    approvalMode:
      typeof parsedConfig.approvalMode === "string" ? parsedConfig.approvalMode : "ask",
    eventContract:
      typeof parsedConfig.eventContract === "string" ? parsedConfig.eventContract : "provider_event_v1",
    envJson: normalizeJson(
      JSON.stringify(
        parsedConfig.env && typeof parsedConfig.env === "object" && !Array.isArray(parsedConfig.env)
          ? parsedConfig.env
          : {},
      ),
      "{}",
    ),
    configJson: normalizeJson(binding.configJson, "{}"),
    isEnabled: binding.isEnabled === 1,
  });

  async function save() {
    setIsSaving(true);
    setMessage(null);

    try {
      JSON.parse(form.envJson);
      JSON.parse(form.configJson);
    } catch {
      setIsSaving(false);
      setMessage("JSON 格式不正确");
      return;
    }

    const extraConfig = parseConfig(form.configJson);
    const nextConfig = {
      ...extraConfig,
      defaultModel: form.defaultModel || undefined,
      approvalMode: form.approvalMode,
      eventContract: form.eventContract,
      env: JSON.parse(form.envJson) as Record<string, unknown>,
    };

    const response = await fetch("/api/provider-runtime-bindings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id || crypto.randomUUID(),
        tenantSpaceId: form.tenantSpaceId,
        businessTeamId: form.businessTeamId || null,
        adapterDefinitionId: form.adapterDefinitionId,
        name: form.name,
        runtimeKind: form.runtimeKind,
        baseUrl: form.baseUrl,
        command: form.command,
        workspaceRoot: form.workspaceRoot,
        defaultProviderProfileId: form.defaultProviderProfileId || null,
        apiKeyRef: form.apiKeyRef,
        configJson: JSON.stringify(nextConfig, null, 2),
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
          value={form.businessTeamId}
          onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}
          placeholder="业务团队 ID（可选）"
        />
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="执行引擎名称"
        />
        <select
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.adapterDefinitionId}
          onChange={(event) => setForm({ ...form, adapterDefinitionId: event.target.value })}
        >
          {adapterOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.runtimeKind}
          onChange={(event) => setForm({ ...form, runtimeKind: event.target.value })}
        >
          {["opencode", "http", "cli"].map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.baseUrl}
          onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
          placeholder="Runtime Base URL"
        />
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.command}
          onChange={(event) => setForm({ ...form, command: event.target.value })}
          placeholder="启动命令，例如 opencode"
        />
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.workspaceRoot}
          onChange={(event) => setForm({ ...form, workspaceRoot: event.target.value })}
          placeholder="工作目录"
        />
        <select
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.approvalMode}
          onChange={(event) => setForm({ ...form, approvalMode: event.target.value })}
        >
          {["ask", "allow", "deny", "manual"].map((mode) => (
            <option key={mode} value={mode}>
              审批模式 {mode}
            </option>
          ))}
        </select>
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.eventContract}
          onChange={(event) => setForm({ ...form, eventContract: event.target.value })}
          placeholder="事件协议，例如 provider_event_v1"
        />
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.defaultModel}
          onChange={(event) => setForm({ ...form, defaultModel: event.target.value })}
          placeholder="默认模型覆盖"
        />
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)] md:col-span-2"
          value={form.apiKeyRef}
          onChange={(event) => setForm({ ...form, apiKeyRef: event.target.value })}
          placeholder="OpenCode API Key 引用，例如 env:OPENCODE_API_KEY"
        />
        <select
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)] md:col-span-2"
          value={form.defaultProviderProfileId}
          onChange={(event) => setForm({ ...form, defaultProviderProfileId: event.target.value })}
        >
          <option value="">默认模型接口</option>
          {providerOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className="mt-2 min-h-24 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm leading-6 text-[var(--ink)]"
        value={form.envJson}
        onChange={(event) => setForm({ ...form, envJson: event.target.value })}
        placeholder='{"OPENAI_API_KEY":"ref:env:OPENAI_API_KEY"}'
      />
      <textarea
        className="mt-2 min-h-24 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm leading-6 text-[var(--ink)]"
        value={form.configJson}
        onChange={(event) => setForm({ ...form, configJson: event.target.value })}
        placeholder='{"providerProfileAlias":"openai-default"}'
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-50"
        >
          {isSaving ? "保存中" : "保存执行引擎"}
        </button>
        {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
      </div>
    </div>
  );
}
