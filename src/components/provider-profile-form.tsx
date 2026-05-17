"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
    "piApi",
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
    return Array.isArray(parsed) ? parsed.map(String).join("\n") : "gpt-5.4";
  } catch {
    return "gpt-5.4";
  }
}

export function ProviderProfileForm({
  provider,
  title,
  embedded = false,
  onSaved,
}: ProviderProfileFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const parsedConfig = parseConfig(provider.configJson);
  const [form, setForm] = useState({
    id: provider.id,
    tenantSpaceId: provider.tenantSpaceId,
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiStyle: provider.apiStyle,
    defaultModel: provider.defaultModel,
    modelList: normalizeModelList(provider.modelsJson),
    apiKeyRef: provider.apiKeyRef,
    piApi: typeof parsedConfig.piApi === "string" ? parsedConfig.piApi : "",
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
      JSON.parse(form.configJson);
      JSON.parse(form.headersJson);
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

    const nextConfig = {
      ...parseConfig(form.configJson),
      piApi: form.piApi || undefined,
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
      setMessage("保存失败");
      return;
    }

    setMessage("已保存");
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
      启用
    </label>
  );

  const content = (
    <>
      {embedded ? <div className="flex justify-end">{enabledControl}</div> : null}
      <div className={embedded ? "space-y-4" : ""}>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="模型接口名称">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Provider 名称"
            />
          </FieldGroup>
          <FieldGroup label="API 风格">
            <Select
              value={form.apiStyle}
              onChange={(event) => setForm({ ...form, apiStyle: event.target.value })}
            >
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
              placeholder="https://api.openai.com/v1"
            />
          </FieldGroup>
          <FieldGroup label="请求协议">
            <Select
              value={form.piApi}
              onChange={(event) => setForm({ ...form, piApi: event.target.value })}
            >
              <option value="">跟随 API 风格自动判断</option>
              <option value="openai-responses">OpenAI Responses</option>
              <option value="openai-completions">OpenAI Chat / Completions</option>
              <option value="azure-openai-responses">Azure OpenAI Responses</option>
              <option value="anthropic-messages">Anthropic Messages</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="默认模型">
            <Input
              value={form.defaultModel}
              onChange={(event) => setForm({ ...form, defaultModel: event.target.value })}
              placeholder="gpt-5.4"
            />
          </FieldGroup>
          <FieldGroup label="API Key 引用" className="md:col-span-2">
            <Input
              value={form.apiKeyRef}
              onChange={(event) => setForm({ ...form, apiKeyRef: event.target.value })}
              placeholder="env:OPENAI_API_KEY"
            />
          </FieldGroup>
          <FieldGroup
            label="模型列表"
            hint="每行一个模型名。"
            className="md:col-span-2"
          >
            <Textarea
              value={form.modelList}
              onChange={(event) => setForm({ ...form, modelList: event.target.value })}
              placeholder={"gpt-5.4\ngpt-5.4-mini"}
            />
          </FieldGroup>
          <FieldGroup label="上下文窗口">
            <Input
              value={form.contextWindow}
              onChange={(event) => setForm({ ...form, contextWindow: event.target.value })}
              placeholder="128000"
            />
          </FieldGroup>
          <FieldGroup label="最大输出 Tokens">
            <Input
              value={form.maxTokens}
              onChange={(event) => setForm({ ...form, maxTokens: event.target.value })}
              placeholder="16384"
            />
          </FieldGroup>
          <FieldGroup
            label="附加 Headers"
            hint="给 OpenAI Compatible / 企业网关追加自定义请求头。"
            className="md:col-span-2"
          >
            <Textarea
              value={form.headersJson}
              onChange={(event) => setForm({ ...form, headersJson: event.target.value })}
              placeholder='{"x-tenant-id":"security-platform"}'
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
              Reasoning
            </label>
          </div>
          <FieldGroup
            label="扩展配置覆盖"
            hint="保留给供应商私有能力或暂未结构化的附加参数。"
            className="md:col-span-2"
          >
            <Textarea
              value={form.configJson}
              onChange={(event) => setForm({ ...form, configJson: event.target.value })}
              placeholder='{"compat":{"reasoning_field":"thinking"}}'
            />
          </FieldGroup>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            type="button"
            onClick={save}
            disabled={isSaving}
          >
            {isSaving ? "保存中" : "保存模型接口"}
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
        description="模型接口、默认模型和 API Key 引用。"
        action={enabledControl}
      />
      <PanelBody>{content}</PanelBody>
    </Panel>
  );
}
