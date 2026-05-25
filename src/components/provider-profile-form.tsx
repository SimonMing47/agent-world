"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { editableSecretValue, isEnvSecretReference, SecretInput } from "@/components/secret-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
	  tenantSpaceOptions: Array<{ id: string; name: string }>;
	  embedded?: boolean;
	  onSaved?: () => void;
	};

function parseConfig(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function userVisibleConfig(value: string) {
  const visible = { ...parseConfig(value) };
  [
    "modelApi",
    "supportsResponsesApi",
    "supportsChatCompletions",
    "contextWindow",
    "maxTokens",
    "reasoning",
    "headers",
  ].forEach((key) => {
    delete visible[key];
  });
  return normalizeJson(JSON.stringify(visible), "{}");
}

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
    return Array.isArray(parsed) ? parsed.map(String).join("\n") : "";
  } catch {
    return "";
  }
}

function hasEnvReference(value: unknown): boolean {
  if (typeof value === "string") return value.trim().toLowerCase().startsWith("env:");
  if (Array.isArray(value)) return value.some(hasEnvReference);
  if (value && typeof value === "object") return Object.values(value).some(hasEnvReference);
  return false;
}

export function ProviderProfileForm({
  provider,
  title,
  tenantSpaceOptions,
  embedded = false,
  onSaved,
}: ProviderProfileFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const parsedConfig = parseConfig(provider.configJson);
  const hasLegacyApiKeyRef = isEnvSecretReference(provider.apiKeyRef);
  const [form, setForm] = useState({
    id: provider.id,
    tenantSpaceId: provider.tenantSpaceId,
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiStyle: provider.apiStyle,
    defaultModel: provider.defaultModel,
    modelList: normalizeModelList(provider.modelsJson),
    apiKeyRef: editableSecretValue(provider.apiKeyRef),
    modelApi: typeof parsedConfig.modelApi === "string" ? parsedConfig.modelApi : "",
    supportsResponsesApi: Boolean(parsedConfig.supportsResponsesApi ?? true),
    supportsChatCompletions: Boolean(parsedConfig.supportsChatCompletions ?? true),
    contextWindow:
      typeof parsedConfig.contextWindow === "number" ? String(parsedConfig.contextWindow) : "",
    maxTokens: typeof parsedConfig.maxTokens === "number" ? String(parsedConfig.maxTokens) : "",
    reasoning: Boolean(parsedConfig.reasoning ?? true),
    headersJson: normalizeJson(
      JSON.stringify(
        parsedConfig.headers && typeof parsedConfig.headers === "object" && !Array.isArray(parsedConfig.headers)
          ? parsedConfig.headers
          : {},
      ),
      "{}",
    ),
    configJson: userVisibleConfig(provider.configJson),
    isEnabled: provider.isEnabled === 1,
  });

  async function save() {
    setIsSaving(true);
    setMessage(null);

    try {
      const config = JSON.parse(form.configJson) as unknown;
      const headers = JSON.parse(form.headersJson) as unknown;
      if (
        form.apiKeyRef.trim().toLowerCase().startsWith("env:") ||
        hasEnvReference(config) ||
        hasEnvReference(headers)
      ) {
        throw new Error("模型配置不再支持 env: 环境变量引用，请直接在这里填写配置值。");
      }
    } catch {
      setIsSaving(false);
      setMessage("模型配置 JSON 不正确，或仍包含 env: 环境变量引用。");
      return;
    }

    const models = form.modelList
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    if (models.length === 0) {
      setIsSaving(false);
      setMessage("ui.generated.c058b4726f2");
      return;
    }

    const nextConfig = {
      ...parseConfig(form.configJson),
      modelApi: form.modelApi || undefined,
      supportsResponsesApi: form.supportsResponsesApi,
      supportsChatCompletions: form.supportsChatCompletions,
      contextWindow: form.contextWindow ? Number(form.contextWindow) : undefined,
      maxTokens: form.maxTokens ? Number(form.maxTokens) : undefined,
      reasoning: form.reasoning,
      headers: JSON.parse(form.headersJson) as Record<string, unknown>,
    };

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
        configJson: JSON.stringify(nextConfig, null, 2),
        isEnabled: form.isEnabled ? 1 : 0,
      }),
    });

    setIsSaving(false);
    if (!response.ok) {
      setMessage("ui.generated.c40525a7328");
      return;
    }

    setMessage("ui.generated.ccdfab96f75");
    onSaved?.();
    router.refresh();
  }

  const enabledControl = (
    <label className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
      <input
        type="checkbox"
        checked={form.isEnabled}
        onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })}
      />
      ui.generated.cd4e9ca3dd4
    </label>
  );

  const content = (
    <>
      {embedded ? <div className="flex justify-end">{enabledControl}</div> : null}
      <div className={embedded ? "space-y-4" : ""}>
	        <div className="grid gap-3 md:grid-cols-2">
	          <FieldGroup label="ui.generated.c3db35d2741">
	            <Select
	              value={form.tenantSpaceId}
	              onChange={(event) => setForm({ ...form, tenantSpaceId: event.target.value })}
	            >
	              <option value="">ui.generated.ca5644f4bbf</option>
	              {tenantSpaceOptions.map((space) => (
	                <option key={space.id} value={space.id}>
	                  {space.name}
	                </option>
	              ))}
	            </Select>
	          </FieldGroup>
	          <FieldGroup label="ui.generated.c94e4102c81">
	            <Input
	              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="ui.generated.c94e4102c81"
            />
          </FieldGroup>
	          <FieldGroup label="ui.generated.c269a00cd6b">
	            <Select
	              value={form.apiStyle}
	              onChange={(event) => setForm({ ...form, apiStyle: event.target.value })}
	            >
	              <option value="">ui.generated.ca5644f4bbf</option>
	              {[
                ["openai", "OpenAI / Auto"],
                ["openai-compatible", "OpenAI Compatible"],
                ["openai-responses", "OpenAI Responses"],
                ["openai-completions", "OpenAI Chat / Completions"],
                ["anthropic", "Anthropic"],
                ["azure-openai", "Azure OpenAI"],
                ["openrouter", "OpenRouter"],
                ["custom", "Custom HTTP"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="Base URL">
            <Input
              value={form.baseUrl}
              onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
	              placeholder="ui.common.unconfigured"
            />
          </FieldGroup>
          <FieldGroup label="ui.generated.c91534309be">
            <Select
              value={form.modelApi}
              onChange={(event) => setForm({ ...form, modelApi: event.target.value })}
            >
              <option value="">ui.generated.cb576fa372a</option>
              <option value="openai-responses">OpenAI Responses</option>
              <option value="openai-completions">OpenAI Chat / Completions</option>
              <option value="azure-openai-responses">Azure OpenAI Responses</option>
              <option value="anthropic-messages">Anthropic Messages</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="ui.generated.cb5bff31cdd">
            <Input
              value={form.defaultModel}
              onChange={(event) => setForm({ ...form, defaultModel: event.target.value })}
	              placeholder="ui.common.unconfigured"
            />
          </FieldGroup>
          <FieldGroup
            label="API Key"
            hint={
              hasLegacyApiKeyRef
                ? "已检测到旧环境变量引用，请直接填写 API Key 后保存。默认隐藏，需要查看时点击显示。"
                : "直接保存模型服务 API Key。默认隐藏，需要查看时点击显示。"
            }
            className="md:col-span-2"
          >
            <SecretInput
              value={form.apiKeyRef}
              onChange={(value) => setForm({ ...form, apiKeyRef: value })}
              placeholder="ui.common.unconfigured"
            />
          </FieldGroup>
          <FieldGroup
            label="ui.generated.cc271d29118"
            hint="ui.generated.ca6024ebc28"
            className="md:col-span-2"
          >
            <Textarea
              value={form.modelList}
              onChange={(event) => setForm({ ...form, modelList: event.target.value })}
	              placeholder="ui.common.unconfigured"
            />
          </FieldGroup>
          <FieldGroup label="ui.generated.c9a1fbe0bb9">
            <Input
              value={form.contextWindow}
              onChange={(event) => setForm({ ...form, contextWindow: event.target.value })}
              placeholder="128000"
            />
          </FieldGroup>
          <FieldGroup label="ui.generated.ca21133348e">
            <Input
              value={form.maxTokens}
              onChange={(event) => setForm({ ...form, maxTokens: event.target.value })}
              placeholder="16384"
            />
          </FieldGroup>
          <FieldGroup
            label="ui.generated.cf7a9fb4dbc"
            hint="ui.generated.c51a73b89c2"
            className="md:col-span-2"
          >
            <Textarea
              value={form.headersJson}
              onChange={(event) => setForm({ ...form, headersJson: event.target.value })}
	              placeholder="{}"
            />
          </FieldGroup>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--ink-muted)] md:col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.supportsResponsesApi}
                onChange={(event) => setForm({ ...form, supportsResponsesApi: event.target.checked })}
              />
              Responses API
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.supportsChatCompletions}
                onChange={(event) =>
                  setForm({ ...form, supportsChatCompletions: event.target.checked })
                }
              />
              Chat / Completions
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.reasoning}
                onChange={(event) => setForm({ ...form, reasoning: event.target.checked })}
              />
              ui.generated.caa23f730d0
            </label>
          </div>
          <FieldGroup
            label="ui.generated.cbdb1ce25f5"
            hint="ui.generated.c573da6f520"
            className="md:col-span-2"
          >
            <Textarea
              value={form.configJson}
              onChange={(event) => setForm({ ...form, configJson: event.target.value })}
	              placeholder="{}"
            />
          </FieldGroup>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            type="button"
            onClick={save}
            disabled={isSaving}
          >
            {isSaving ? "ui.generated.ca032e8fdda" : "ui.generated.cd3a54b3d46"}
          </Button>
          {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <Panel>
      <PanelHeader
        title={title}
        description="ui.generated.c0cb178a6a9"
        action={enabledControl}
      />
      <PanelBody>{content}</PanelBody>
    </Panel>
  );
}
