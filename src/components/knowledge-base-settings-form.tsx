"use client";

import { useState, useTransition } from "react";
import { BrainCircuit, ChevronDown, Database, Info, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguageText } from "@/components/language-pack-provider";
import { editableSecretValue, isEnvSecretReference, SecretInput } from "@/components/secret-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeBaseSettings, OpenVikingModelDefaults } from "@/server/knowledge-base-settings";

type ProviderOption = {
  id: string;
  name: string;
  apiStyle: string;
  baseUrl: string;
  defaultModel: string;
  apiKeyRef: string;
  configJson: string;
  isEnabled: number;
};

type TextFieldKey = Exclude<
  keyof KnowledgeBaseSettings,
  "provider" | "enabled" | "autoStart" | "corsOrigins" | "vlmProviderProfileId" | "embeddingProviderProfileId"
>;

const connectionFields: Array<{ field: TextFieldKey; label: string; hint?: string }> = [
  { field: "baseUrl", label: "OpenViking Base URL", hint: "AgentWorld 调用 OpenViking API 的地址。" },
  { field: "host", label: "监听 Host" },
  { field: "port", label: "监听 Port" },
  { field: "timeoutSeconds", label: "请求超时秒数" },
];

const runtimeFields: Array<{ field: TextFieldKey; label: string; hint?: string }> = [
  { field: "serverBin", label: "OpenViking Server Binary", hint: "本地自动拉起时使用的 openviking-server 路径。" },
  { field: "configPath", label: "Server Config File", hint: "保存后会同步写入这份 ov.conf。" },
  { field: "cliConfigPath", label: "CLI Config File", hint: "保存后会同步写入这份 ovcli.conf。" },
];

const identityFields: Array<{ field: TextFieldKey; label: string; type?: string }> = [
  { field: "apiKey", label: "Root API Key", type: "password" },
  { field: "account", label: "Account" },
  { field: "user", label: "User" },
  { field: "agentId", label: "Agent ID" },
];

const storageFields: Array<{ field: TextFieldKey; label: string }> = [
  { field: "storageWorkspace", label: "Storage Workspace" },
  { field: "agfsBackend", label: "AGFS Backend" },
  { field: "vectorDbBackend", label: "Vector DB Backend" },
  { field: "lockTimeoutSeconds", label: "Lock Timeout" },
  { field: "lockExpireSeconds", label: "Lock Expire" },
];

const LOCAL_EMBEDDING_SELECT_VALUE = "__openviking_local_embedding__";

const KNOWLEDGE_FOUNDATION_LABEL = "内容理解知识底座";

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

function openVikingProviderName(provider: ProviderOption) {
  const apiStyle = provider.apiStyle.trim();
  if (apiStyle === "openai-compatible" || apiStyle.startsWith("openai")) return "openai";
  if (apiStyle === "azure-openai") return "azure";
  if (apiStyle === "anthropic" || apiStyle === "openrouter" || apiStyle === "custom") return "litellm";
  return apiStyle || "openai";
}

function optionalConfigText(config: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function applyLocalEmbeddingSettings(setting: KnowledgeBaseSettings, modelDefaults: OpenVikingModelDefaults) {
  return {
    ...setting,
    embeddingProviderProfileId: modelDefaults.embedding.providerProfileId,
    embeddingProvider: modelDefaults.embedding.provider,
    embeddingModel: modelDefaults.embedding.model,
    embeddingApiBase: modelDefaults.embedding.apiBase,
    embeddingApiKey: "",
    embeddingDimension: modelDefaults.embedding.dimension,
  };
}

function prepareEditableSettings(setting: KnowledgeBaseSettings) {
  return {
    ...setting,
    apiKey: editableSecretValue(setting.apiKey),
    vlmApiKey: editableSecretValue(setting.vlmApiKey),
    embeddingApiKey: editableSecretValue(setting.embeddingApiKey),
  };
}

function applyProviderToSettings(
  setting: KnowledgeBaseSettings,
  provider: ProviderOption | undefined,
  target: "vlm" | "embedding",
) {
  if (!provider) return setting;
  const config = parseConfig(provider.configJson);
  const modelApiBase = optionalConfigText(config, ["modelApiBase", "apiBase"]);
  const apiBase = modelApiBase || provider.baseUrl;
  if (target === "vlm") {
    const vlmModel = optionalConfigText(config, ["vlmModel", "visionModel", "chatModel"]) || provider.defaultModel;
    const vlmApiBase = optionalConfigText(config, ["vlmApiBase", "visionApiBase"]) || apiBase;
    const vlmApiKey = editableSecretValue(provider.apiKeyRef);
    return {
      ...setting,
      vlmProviderProfileId: provider.id,
      vlmProvider: openVikingProviderName(provider),
      vlmModel,
      vlmApiBase,
      vlmApiKey,
    };
  }
  const embeddingModel = optionalConfigText(config, ["embeddingModel"]) || provider.defaultModel;
  const embeddingApiBase = optionalConfigText(config, ["embeddingApiBase"]) || apiBase;
  const embeddingDimension = optionalConfigText(config, ["embeddingDimension", "dimension"]);
  const embeddingApiKey = editableSecretValue(provider.apiKeyRef);
  return {
    ...setting,
    embeddingProviderProfileId: provider.id,
    embeddingProvider: openVikingProviderName(provider),
    embeddingModel,
    embeddingApiBase,
    embeddingApiKey,
    embeddingDimension: embeddingDimension || setting.embeddingDimension,
  };
}

function canRunContentUnderstanding(setting: KnowledgeBaseSettings) {
  if (!setting.vlmProvider || !setting.vlmModel) return false;
  if (setting.vlmApiKey) return true;
  const provider = setting.vlmProvider.toLowerCase();
  const model = setting.vlmModel.toLowerCase();
  return provider === "openai-codex" || (provider === "litellm" && model.startsWith("ollama/"));
}

function contentFoundationStatus(setting: KnowledgeBaseSettings) {
  if (!setting.vlmProvider || !setting.vlmModel) return "未配置";
  return canRunContentUnderstanding(setting) ? "已启用" : "待补 API Key";
}

function applyDefaultModelSettings(
  setting: KnowledgeBaseSettings,
  providerOptions: ProviderOption[],
  modelDefaults: OpenVikingModelDefaults,
  options: { force?: boolean } = {},
) {
  const defaultProvider =
    providerOptions.find((provider) => provider.id === modelDefaults.contentUnderstanding.providerProfileId)
    ?? providerOptions.find((provider) => provider.isEnabled === 1)
    ?? providerOptions[0];
  let next = setting;
  if (defaultProvider && (options.force || (!next.vlmProviderProfileId && !next.vlmProvider && !next.vlmModel))) {
    next = applyProviderToSettings(next, defaultProvider, "vlm");
  } else if (options.force || (!next.vlmProviderProfileId && !next.vlmProvider && !next.vlmModel)) {
    next = {
      ...next,
      vlmProviderProfileId: modelDefaults.contentUnderstanding.providerProfileId,
      vlmProvider: modelDefaults.contentUnderstanding.provider,
      vlmModel: modelDefaults.contentUnderstanding.model,
      vlmApiBase: modelDefaults.contentUnderstanding.apiBase,
    };
  }
  if (options.force || (!next.embeddingProviderProfileId && !next.embeddingProvider && !next.embeddingModel)) {
    next = applyLocalEmbeddingSettings(next, modelDefaults);
  }
  return next;
}

function usesLocalEmbeddingPreset(setting: KnowledgeBaseSettings, modelDefaults: OpenVikingModelDefaults) {
  return (
    setting.embeddingProvider === modelDefaults.embedding.provider
    && setting.embeddingModel === modelDefaults.embedding.model
  );
}

function ModelRoleNote({
  tone,
  title,
  children,
}: {
  tone: "blue" | "green" | "amber";
  title: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "blue"
      ? "border-[#bfdbfe] bg-[#eff6ff] text-[#1e3a8a]"
      : tone === "green"
        ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#14532d]"
        : "border-[#fde68a] bg-[#fffbeb] text-[#713f12]";
  return (
    <div className={`rounded-lg border px-4 py-3 text-xs leading-5 ${toneClass}`}>
      <div className="mb-1 flex items-center gap-2 font-semibold">
        <Info className="h-3.5 w-3.5" />
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group overflow-hidden rounded-lg border border-[var(--line)] bg-[rgba(255,255,255,0.58)]">
      <summary className="list-none cursor-pointer select-none px-4 py-3 outline-none transition hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)] [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-[var(--ink)]">{title}</div>
            {description ? <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{description}</div> : null}
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white/70 text-[var(--ink-muted)] transition group-open:rotate-180">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </summary>
      <div className="space-y-3 border-t border-[var(--line)] px-4 py-4">
        {children}
      </div>
    </details>
  );
}

export function KnowledgeBaseSettingsForm({
  setting,
  providerOptions,
  modelDefaults,
}: {
  setting: KnowledgeBaseSettings;
  providerOptions: ProviderOption[];
  modelDefaults: OpenVikingModelDefaults;
}) {
  const router = useRouter();
  const text = useLanguageText();
  const [form, setForm] = useState(() => applyDefaultModelSettings(prepareEditableSettings(setting), providerOptions, modelDefaults));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const enabledProviderOptions = providerOptions.filter((provider) => provider.isEnabled === 1);
  const visibleProviderOptions = enabledProviderOptions.length ? enabledProviderOptions : providerOptions;
  const foundationWarning = !form.vlmProvider || !form.vlmModel
    ? "内容理解知识底座未配置。知识仍可保存，但 L0 摘要、L1 概览和多层语义结构不会作为默认底座启用。"
    : !canRunContentUnderstanding(form)
      ? "内容理解模型已经选定，但缺少可直接保存的 API Key。当前 OpenViking 只会写入 Embedding 检索索引。"
      : "";

  function update<K extends keyof KnowledgeBaseSettings>(field: K, value: KnowledgeBaseSettings[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateModelProvider(target: "vlm" | "embedding", providerId: string) {
    if (target === "embedding" && providerId === LOCAL_EMBEDDING_SELECT_VALUE) {
      setForm((current) => applyLocalEmbeddingSettings(current, modelDefaults));
      return;
    }
    const provider = providerOptions.find((item) => item.id === providerId);
    setForm((current) => {
      if (!provider) {
        return {
          ...current,
          ...(target === "vlm"
            ? { vlmProviderProfileId: "" }
            : { embeddingProviderProfileId: "" }),
        };
      }
      return applyProviderToSettings(current, provider, target);
    });
  }

  function renderInput(field: TextFieldKey, label: string, options?: { hint?: string; type?: string }) {
    return (
      <FieldGroup key={field} label={label} hint={options?.hint}>
        <Input
          type={options?.type ?? "text"}
          value={form[field]}
          onChange={(event) => update(field, event.target.value)}
        />
      </FieldGroup>
    );
  }

  function renderModelConfig(target: "vlm" | "embedding") {
    const isVlm = target === "vlm";
    const selectedProfileId = isVlm ? form.vlmProviderProfileId : form.embeddingProviderProfileId;
    const selectedProvider = providerOptions.find((provider) => provider.id === selectedProfileId);
    const selectedProviderHasLegacySecret = Boolean(selectedProvider && isEnvSecretReference(selectedProvider.apiKeyRef));
    const providerField = isVlm ? "vlmProvider" : "embeddingProvider";
    const modelField = isVlm ? "vlmModel" : "embeddingModel";
    const baseField = isVlm ? "vlmApiBase" : "embeddingApiBase";
    const keyField = isVlm ? "vlmApiKey" : "embeddingApiKey";
    const title = isVlm ? `${KNOWLEDGE_FOUNDATION_LABEL} VLM/LLM` : "检索索引 Embedding";
    const description = isVlm
      ? "默认知识底座基于内容理解模型：负责 OpenViking 的 L0 摘要、L1 概览、多层目录理解和语义结构化。它不是 Agent 对话运行时模型。"
      : "Embedding 只作为检索索引层：把文档和查询转成向量，支撑语义召回。默认使用 OpenViking 本地模型，不把普通聊天模型当成 Embedding 模型。";
    const selectValue =
      !isVlm && usesLocalEmbeddingPreset(form, modelDefaults)
        ? LOCAL_EMBEDDING_SELECT_VALUE
        : selectedProfileId;
    const Icon = isVlm ? BrainCircuit : Database;

    return (
      <div className="rounded-lg border border-[var(--line)] bg-white/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <Icon className="h-4 w-4 text-[var(--accent)]" />
              {title}
            </div>
            <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
              {description}
            </div>
          </div>
          {selectedProvider ? (
            <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent-strong)]">
              来自模型服务：{selectedProvider.name}
            </div>
          ) : isVlm && canRunContentUnderstanding(form) ? (
            <div className="rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-medium text-[#1d4ed8]">
              内容理解已启用
            </div>
          ) : !isVlm && usesLocalEmbeddingPreset(form, modelDefaults) ? (
            <div className="rounded-full bg-[#ecfdf5] px-3 py-1 text-xs font-medium text-[#047857]">
              OpenViking 本地默认
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {isVlm ? (
            <ModelRoleNote tone="blue" title="内容理解">
              默认使用系统模型服务构建知识底座；如果要处理图片、PDF 摘要或多层目录概览，建议选择具备视觉或长上下文能力的模型。
            </ModelRoleNote>
          ) : (
            <ModelRoleNote tone="green" title="检索索引">
              改动 Embedding 模型或维度后，已有向量索引需要重建，否则新旧向量空间不一致，检索效果会失真。
            </ModelRoleNote>
          )}
          {!isVlm ? (
            <ModelRoleNote tone="amber" title="默认策略">
              推荐保持本地 {modelDefaults.embedding.model}，维度 {modelDefaults.embedding.dimension}。只有明确知道模型支持 Embedding 时，才选择其他模型服务。
            </ModelRoleNote>
          ) : null}
          {selectedProviderHasLegacySecret ? (
            <ModelRoleNote tone="amber" title="需要重新保存 API Key">
              这个模型服务仍是旧的 env 环境变量引用。知识库配置不会继续带入它，请在这里直接填写 API Key 后保存。
            </ModelRoleNote>
          ) : null}
          {isVlm && form.vlmProvider && form.vlmModel && !canRunContentUnderstanding(form) ? (
            <ModelRoleNote tone="amber" title="知识底座待生效">
              内容理解模型已经选定，但缺少可直接保存的 API Key。保存前请填写 API Key；否则 OpenViking 不会写入不可用的 VLM 配置。
            </ModelRoleNote>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FieldGroup label="配置来源">
            <Select value={selectValue} onChange={(event) => updateModelProvider(target, event.target.value)}>
              {!isVlm ? (
                <option value={LOCAL_EMBEDDING_SELECT_VALUE}>
                  OpenViking 本地默认 · {modelDefaults.embedding.model}
                </option>
              ) : null}
              <option value="">手动配置</option>
              {!isVlm && visibleProviderOptions.length ? <option disabled>模型服务</option> : null}
              {visibleProviderOptions.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} · {provider.defaultModel}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="Provider">
            <Input value={form[providerField]} onChange={(event) => update(providerField, event.target.value)} />
          </FieldGroup>
          <FieldGroup label="Model">
            <Input value={form[modelField]} onChange={(event) => update(modelField, event.target.value)} />
          </FieldGroup>
          <FieldGroup label="API Base">
            <Input value={form[baseField]} onChange={(event) => update(baseField, event.target.value)} />
          </FieldGroup>
          {!isVlm ? (
            <FieldGroup label="Embedding Dimension" hint="本地默认模型固定为 512。远程模型请按模型文档填写，未知可留空让 OpenViking 尝试推断。">
              <Input
                value={form.embeddingDimension}
                onChange={(event) => update("embeddingDimension", event.target.value)}
              />
            </FieldGroup>
          ) : null}
          <FieldGroup label="API Key" className={isVlm ? "md:col-span-2" : ""}>
            <SecretInput
              value={form[keyField]}
              onChange={(value) => update(keyField, value)}
              placeholder={
                usesLocalEmbeddingPreset(form, modelDefaults) && !isVlm
                  ? "本地模型不需要 API Key"
                  : selectedProviderHasLegacySecret
                    ? "请直接填写 API Key"
                    : "未配置"
              }
            />
          </FieldGroup>
        </div>
      </div>
    );
  }

  async function save() {
    setMessage(null);
    try {
      const response = await fetch("/api/system-settings/knowledge-base", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        setting?: KnowledgeBaseSettings;
        warnings?: string[];
      };
      if (!response.ok || result.ok === false || !result.setting) {
        throw new Error(result.error ?? text("common.messages.saveFailed", "保存失败"));
      }
      setForm(result.setting);
      setMessage(
        result.warnings?.length
          ? `${text("common.messages.saved", "已保存")}；${result.warnings[0]}`
          : text("common.messages.saved", "已保存"),
      );
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("common.messages.saveFailed", "保存失败"));
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <SettingsSection title="默认知识库" description="系统默认知识库后端固定为 OpenViking，默认以内容理解模型作为知识底座，Embedding 作为检索索引层。">
          <div className="grid gap-4 md:grid-cols-2">
            <FieldGroup label="Provider">
              <Select value={form.provider} disabled>
                <option value="openviking">OpenViking</option>
              </Select>
            </FieldGroup>
            <FieldGroup label="Log Level">
              <Select value={form.logLevel} onChange={(event) => update("logLevel", event.target.value)}>
                <option value="DEBUG">DEBUG</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
              </Select>
            </FieldGroup>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--ink-muted)]">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => update("enabled", event.target.checked)}
              />
              启用知识库服务
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--ink-muted)]">
              <input
                type="checkbox"
                checked={form.autoStart}
                onChange={(event) => update("autoStart", event.target.checked)}
              />
              随 AgentWorld 自动拉起 OpenViking
            </label>
          </div>
        </SettingsSection>

        <SettingsSection title="连接与监听" description="这里同时控制 AgentWorld 调用地址和本地 OpenViking 进程的监听地址。">
          <div className="grid gap-4 md:grid-cols-2">
            {connectionFields.map((item) => renderInput(item.field, item.label, { hint: item.hint }))}
          </div>
          <FieldGroup label="CORS Origins" hint="每行一个允许访问 OpenViking 的前端地址。">
            <Textarea
              className="min-h-[120px] font-mono text-xs"
              value={form.corsOrigins}
              onChange={(event) => update("corsOrigins", event.target.value)}
            />
          </FieldGroup>
        </SettingsSection>

        <SettingsSection title="启动与配置文件" description="保存后会立即重写 OpenViking 的 server/cli 配置文件；已运行进程需要重启后才会读取监听端口等启动参数。">
          <div className="grid gap-4 md:grid-cols-2">
            {runtimeFields.map((item) => renderInput(item.field, item.label, { hint: item.hint }))}
          </div>
        </SettingsSection>

        <SettingsSection title="身份与请求头" description="这些字段会用于 OpenViking API 鉴权，以及 CLI 配置中的 account/user/agent 标识。">
          <div className="grid gap-4 md:grid-cols-2">
            {identityFields.map((item) => renderInput(item.field, item.label, { type: item.type }))}
          </div>
        </SettingsSection>

        <SettingsSection title="存储配置" description="对应 OpenViking server config 里的 storage 和 transaction。">
          <div className="grid gap-4 md:grid-cols-2">
            {storageFields.map((item) => renderInput(item.field, item.label))}
          </div>
        </SettingsSection>

        <SettingsSection title="模型与知识底座" description="OpenViking 默认基于内容理解构建知识底座，再用 Embedding 建立检索索引；Agent 对话模型仍在模型服务与运行绑定中管理。">
          <div className="space-y-4">
            {foundationWarning ? (
              <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm leading-6 text-[#713f12]">
                {foundationWarning}
              </div>
            ) : (
              <div className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm leading-6 text-[#1e3a8a]">
                内容理解知识底座已就绪。OpenViking 会使用该模型生成 L0 摘要、L1 概览和多层语义结构。
              </div>
            )}
            {providerOptions.length ? null : (
              <div className="rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-sm text-[var(--warning)]">
                还没有可选模型服务。请先配置内容理解模型服务；Embedding 会继续使用 OpenViking 本地默认模型。
              </div>
            )}
            {renderModelConfig("vlm")}
            {renderModelConfig("embedding")}
          </div>
        </SettingsSection>

        {message ? <div className="text-sm text-[var(--ink-muted)]">{message}</div> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={save} disabled={isPending}>
            {isPending ? text("actions.saving") : text("actions.save")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setForm(prepareEditableSettings(setting))}>
            {text("actions.reset")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setForm(applyDefaultModelSettings(prepareEditableSettings(setting), providerOptions, modelDefaults, { force: true }))}>
            <RotateCcw className="h-4 w-4" />
            应用知识底座默认
          </Button>
        </div>
      </div>

      <aside className="h-fit rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <div className="text-sm font-semibold text-[var(--ink)]">OpenViking 当前配置</div>
        <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          默认知识库为 OpenViking。保存后系统会把这些值作为知识读写、同步和本地进程启动的统一来源。
        </div>
        <div className="mt-4 space-y-3 text-xs text-[var(--ink-muted)]">
          <div>
            <div className="font-medium text-[var(--ink)]">服务地址</div>
            <div className="mt-1 break-all font-mono">{form.baseUrl}</div>
          </div>
          <div>
            <div className="font-medium text-[var(--ink)]">监听</div>
            <div className="mt-1 font-mono">{form.host}:{form.port}</div>
          </div>
          <div>
            <div className="font-medium text-[var(--ink)]">配置文件</div>
            <div className="mt-1 break-all font-mono">{form.configPath}</div>
          </div>
          <div>
            <div className="font-medium text-[var(--ink)]">CLI 配置</div>
            <div className="mt-1 break-all font-mono">{form.cliConfigPath}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-3">
            <div>
              <div className="font-medium text-[var(--ink)]">启用</div>
              <div>{form.enabled ? "是" : "否"}</div>
            </div>
            <div>
              <div className="font-medium text-[var(--ink)]">自动拉起</div>
              <div>{form.autoStart ? "是" : "否"}</div>
            </div>
          </div>
          <div className="border-t border-[var(--line)] pt-3">
            <div className="font-medium text-[var(--ink)]">{KNOWLEDGE_FOUNDATION_LABEL}</div>
            <div className="mt-1 break-all font-mono">{form.vlmModel || "未配置"}</div>
            <div className="mt-1 text-[var(--ink-subtle)]">
              {contentFoundationStatus(form)}。生成 L0 摘要、L1 概览和多层语义结构。
            </div>
          </div>
          <div>
            <div className="font-medium text-[var(--ink)]">检索索引模型</div>
            <div className="mt-1 break-all font-mono">
              {form.embeddingModel || modelDefaults.embedding.model}
              {form.embeddingDimension ? ` / ${form.embeddingDimension} 维` : ""}
            </div>
            <div className="mt-1 text-[var(--ink-subtle)]">写入向量库并支撑语义检索。</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
