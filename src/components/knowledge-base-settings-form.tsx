"use client";

import { useState, useTransition } from "react";
import { BrainCircuit, ChevronDown, Code2, Database, Info, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguageText } from "@/components/language-pack-provider";
import { editableSecretValue, isEnvSecretReference, SecretInput } from "@/components/secret-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeBaseSettings, KnowledgeModelDefaults } from "@/server/knowledge-base-settings";

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
  | "provider"
  | "enabled"
  | "autoStart"
  | "corsOrigins"
  | "vlmProviderProfileId"
  | "embeddingProviderProfileId"
  | "codebaseEngineProvider"
  | "codebaseEngineIndexStrategy"
  | "codebaseEngineSyncMode"
>;

const storageFields: Array<{ field: TextFieldKey; labelKey: string }> = [
  { field: "storageWorkspace", labelKey: "fields.storageWorkspace.label" },
  { field: "vectorDbBackend", labelKey: "fields.vectorDbBackend.label" },
];

const LOCAL_EMBEDDING_SELECT_VALUE = "__agentworld_local_embedding__";

const KB_PREFIX = "settings.knowledgeBase";
const KNOWLEDGE_FOUNDATION_LABEL_KEY = "knowledgeFoundation.label";

function kbKey(key: string) {
  return `${KB_PREFIX}.${key}`;
}

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

function knowledgeProviderName(provider: ProviderOption) {
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

function applyLocalEmbeddingSettings(setting: KnowledgeBaseSettings, modelDefaults: KnowledgeModelDefaults) {
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
    codebaseEngineApiKey: editableSecretValue(setting.codebaseEngineApiKey),
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
      vlmProvider: knowledgeProviderName(provider),
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
    embeddingProvider: knowledgeProviderName(provider),
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

function contentFoundationStatusKey(setting: KnowledgeBaseSettings) {
  if (!setting.vlmProvider || !setting.vlmModel) return "status.unconfigured";
  return canRunContentUnderstanding(setting) ? "status.enabled" : "status.apiKeyRequired";
}

function applyDefaultModelSettings(
  setting: KnowledgeBaseSettings,
  providerOptions: ProviderOption[],
  modelDefaults: KnowledgeModelDefaults,
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

function usesLocalEmbeddingPreset(setting: KnowledgeBaseSettings, modelDefaults: KnowledgeModelDefaults) {
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
  modelDefaults: KnowledgeModelDefaults;
}) {
  const router = useRouter();
  const text = useLanguageText();
  const kbText = (key: string, params?: Record<string, string | number>) => text(kbKey(key), undefined, params);
  const [form, setForm] = useState(() => applyDefaultModelSettings(prepareEditableSettings(setting), providerOptions, modelDefaults));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const enabledProviderOptions = providerOptions.filter((provider) => provider.isEnabled === 1);
  const visibleProviderOptions = enabledProviderOptions.length ? enabledProviderOptions : providerOptions;
  const foundationWarningKey = !form.vlmProvider || !form.vlmModel
    ? "warnings.foundationMissing"
    : !canRunContentUnderstanding(form)
      ? "warnings.apiKeyMissing"
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

  function renderInput(item: { field: TextFieldKey; labelKey: string; hintKey?: string; type?: string }) {
    return (
      <FieldGroup key={item.field} label={kbText(item.labelKey)} hint={item.hintKey ? kbText(item.hintKey) : undefined}>
        <Input
          type={item.type ?? "text"}
          value={form[item.field]}
          onChange={(event) => update(item.field, event.target.value)}
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
    const title = isVlm ? kbText("models.contentUnderstanding.title") : kbText("models.embedding.title");
    const description = isVlm
      ? kbText("models.contentUnderstanding.description")
      : kbText("models.embedding.description");
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
              {kbText("models.source.provider", { name: selectedProvider.name })}
            </div>
          ) : isVlm && canRunContentUnderstanding(form) ? (
            <div className="rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-medium text-[#1d4ed8]">
              {kbText("models.contentUnderstanding.enabled")}
            </div>
          ) : !isVlm && usesLocalEmbeddingPreset(form, modelDefaults) ? (
            <div className="rounded-full bg-[#ecfdf5] px-3 py-1 text-xs font-medium text-[#047857]">
              {kbText("models.embedding.localDefault")}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {isVlm ? (
            <ModelRoleNote tone="blue" title={kbText("models.notes.contentUnderstanding.title")}>
              {kbText("models.notes.contentUnderstanding.description")}
            </ModelRoleNote>
          ) : (
            <ModelRoleNote tone="green" title={kbText("models.notes.embedding.title")}>
              {kbText("models.notes.embedding.description")}
            </ModelRoleNote>
          )}
          {!isVlm ? (
            <ModelRoleNote tone="amber" title={kbText("models.notes.defaultPolicy.title")}>
              {kbText("models.notes.defaultPolicy.description", {
                model: modelDefaults.embedding.model,
                dimension: modelDefaults.embedding.dimension,
              })}
            </ModelRoleNote>
          ) : null}
          {selectedProviderHasLegacySecret ? (
            <ModelRoleNote tone="amber" title={kbText("models.notes.legacySecret.title")}>
              {kbText("models.notes.legacySecret.description")}
            </ModelRoleNote>
          ) : null}
          {isVlm && form.vlmProvider && form.vlmModel && !canRunContentUnderstanding(form) ? (
            <ModelRoleNote tone="amber" title={kbText("models.notes.pendingFoundation.title")}>
              {kbText("models.notes.pendingFoundation.description")}
            </ModelRoleNote>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FieldGroup label={kbText("models.fields.source")}>
            <Select value={selectValue} onChange={(event) => updateModelProvider(target, event.target.value)}>
              {!isVlm ? (
                <option value={LOCAL_EMBEDDING_SELECT_VALUE}>
                  {kbText("models.source.localDefault", { model: modelDefaults.embedding.model })}
                </option>
              ) : null}
              <option value="">{kbText("models.source.manual")}</option>
              {!isVlm && visibleProviderOptions.length ? <option disabled>{kbText("models.source.modelServices")}</option> : null}
              {visibleProviderOptions.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} · {provider.defaultModel}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={kbText("fields.provider.label")}>
            <Input value={form[providerField]} onChange={(event) => update(providerField, event.target.value)} />
          </FieldGroup>
          <FieldGroup label={kbText("fields.model.label")}>
            <Input value={form[modelField]} onChange={(event) => update(modelField, event.target.value)} />
          </FieldGroup>
          <FieldGroup label={kbText("fields.apiBase.label")}>
            <Input value={form[baseField]} onChange={(event) => update(baseField, event.target.value)} />
          </FieldGroup>
          {!isVlm ? (
            <FieldGroup label={kbText("models.fields.embeddingDimension")} hint={kbText("models.fields.embeddingDimensionHint")}>
              <Input
                value={form.embeddingDimension}
                onChange={(event) => update("embeddingDimension", event.target.value)}
              />
            </FieldGroup>
          ) : null}
          <FieldGroup label={kbText("fields.modelApiKey.label")} className={isVlm ? "md:col-span-2" : ""}>
            <SecretInput
              value={form[keyField]}
              onChange={(value) => update(keyField, value)}
              placeholder={
                usesLocalEmbeddingPreset(form, modelDefaults) && !isVlm
                  ? kbText("models.placeholders.localNoApiKey")
                  : selectedProviderHasLegacySecret
                    ? kbText("models.placeholders.fillApiKey")
                    : kbText("status.unconfigured")
              }
            />
          </FieldGroup>
        </div>
      </div>
    );
  }

  function renderCodebaseEngineConfig() {
    const configured =
      form.codebaseEngineProvider === "tree_sitter"
      || form.codebaseEngineProvider === "disabled"
      || Boolean(form.codebaseEngineEndpoint || form.codebaseEngineMcpEndpoint || form.codebaseEngineCommand);

    return (
      <div className="rounded-lg border border-[var(--line)] bg-white/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <Code2 className="h-4 w-4 text-[var(--accent)]" />
              {kbText("codebaseEngine.title")}
            </div>
            <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
              {kbText("codebaseEngine.description")}
            </div>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-medium ${
            configured ? "bg-[#ecfdf5] text-[#047857]" : "bg-[#fffbeb] text-[#92400e]"
          }`}>
            {configured ? kbText("codebaseEngine.status.configured") : kbText("codebaseEngine.status.missingEndpoint")}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <ModelRoleNote tone="blue" title={kbText("codebaseEngine.notes.recommendation.title")}>
            {kbText("codebaseEngine.notes.recommendation.description")}
          </ModelRoleNote>
          <ModelRoleNote tone="green" title={kbText("codebaseEngine.notes.agentUse.title")}>
            {kbText("codebaseEngine.notes.agentUse.description")}
          </ModelRoleNote>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FieldGroup label={kbText("codebaseEngine.fields.provider")}>
            <Select
              value={form.codebaseEngineProvider}
              onChange={(event) => {
                const provider = event.target.value as KnowledgeBaseSettings["codebaseEngineProvider"];
                setForm((current) => ({
                  ...current,
                  codebaseEngineProvider: provider,
                  codebaseEngineCommand:
                    provider === "codegraph"
                      ? current.codebaseEngineCommand || "codegraph"
                      : provider === "sourcegraph"
                        ? ""
                        : current.codebaseEngineCommand,
                }));
              }}
            >
              <option value="codegraph">{kbText("codebaseEngine.providers.codegraph")}</option>
              <option value="sourcegraph">{kbText("codebaseEngine.providers.sourcegraph")}</option>
              <option value="tree_sitter">{kbText("codebaseEngine.providers.treeSitter")}</option>
              <option value="disabled">{kbText("codebaseEngine.providers.disabled")}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={kbText("codebaseEngine.fields.indexStrategy")}>
            <Select
              value={form.codebaseEngineIndexStrategy}
              onChange={(event) =>
                update("codebaseEngineIndexStrategy", event.target.value as KnowledgeBaseSettings["codebaseEngineIndexStrategy"])
              }
            >
              <option value="hybrid">{kbText("codebaseEngine.indexStrategies.hybrid")}</option>
              <option value="graph">{kbText("codebaseEngine.indexStrategies.graph")}</option>
              <option value="semantic">{kbText("codebaseEngine.indexStrategies.semantic")}</option>
              <option value="lexical">{kbText("codebaseEngine.indexStrategies.lexical")}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={kbText("codebaseEngine.fields.syncMode")}>
            <Select
              value={form.codebaseEngineSyncMode}
              onChange={(event) =>
                update("codebaseEngineSyncMode", event.target.value as KnowledgeBaseSettings["codebaseEngineSyncMode"])
              }
            >
              <option value="on_demand">{kbText("codebaseEngine.syncModes.onDemand")}</option>
              <option value="manual">{kbText("codebaseEngine.syncModes.manual")}</option>
              <option value="scheduled">{kbText("codebaseEngine.syncModes.scheduled")}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={kbText("codebaseEngine.fields.workspace")}>
            <Input
              value={form.codebaseEngineWorkspace}
              onChange={(event) => update("codebaseEngineWorkspace", event.target.value)}
            />
          </FieldGroup>
          <FieldGroup label={kbText("codebaseEngine.fields.endpoint")}>
            <Input
              value={form.codebaseEngineEndpoint}
              onChange={(event) => update("codebaseEngineEndpoint", event.target.value)}
              placeholder={kbText("codebaseEngine.placeholders.endpoint")}
            />
          </FieldGroup>
          <FieldGroup label={kbText("codebaseEngine.fields.mcpEndpoint")}>
            <Input
              value={form.codebaseEngineMcpEndpoint}
              onChange={(event) => update("codebaseEngineMcpEndpoint", event.target.value)}
              placeholder={kbText("codebaseEngine.placeholders.mcpEndpoint")}
            />
          </FieldGroup>
          <FieldGroup label={kbText("codebaseEngine.fields.command")}>
            <Input
              value={form.codebaseEngineCommand}
              onChange={(event) => update("codebaseEngineCommand", event.target.value)}
              placeholder={kbText("codebaseEngine.placeholders.command")}
            />
          </FieldGroup>
          <FieldGroup label={kbText("codebaseEngine.fields.apiKey")}>
            <SecretInput
              value={form.codebaseEngineApiKey}
              onChange={(value) => update("codebaseEngineApiKey", value)}
              placeholder={kbText("codebaseEngine.placeholders.apiKey")}
            />
          </FieldGroup>
          <FieldGroup label={kbText("codebaseEngine.fields.ignoreGlobs")} className="md:col-span-2">
            <Textarea
              className="min-h-24 font-mono text-xs"
              value={form.codebaseEngineIgnoreGlobs}
              onChange={(event) => update("codebaseEngineIgnoreGlobs", event.target.value)}
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
        throw new Error(result.error ?? kbText("messages.saveFailed"));
      }
      setForm(result.setting);
      setMessage(
        result.warnings?.length
          ? `${kbText("messages.saved")}; ${result.warnings[0]}`
          : kbText("messages.saved"),
      );
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : kbText("messages.saveFailed"));
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <SettingsSection title={kbText("sections.default.title")} description={kbText("sections.default.description")}>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldGroup label={kbText("fields.provider.label")}>
              <Select value={form.provider} disabled>
                <option value="native">AgentWorld Knowledge</option>
              </Select>
            </FieldGroup>
            <FieldGroup label={kbText("fields.logLevel.label")}>
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
              {kbText("fields.enabled.label")}
            </label>
          </div>
        </SettingsSection>

        <SettingsSection title={kbText("sections.storage.title")} description={kbText("sections.storage.description")}>
          <div className="grid gap-4 md:grid-cols-2">
            {storageFields.map((item) => renderInput(item))}
          </div>
        </SettingsSection>

        <SettingsSection title={kbText("sections.codebaseEngine.title")} description={kbText("sections.codebaseEngine.description")}>
          {renderCodebaseEngineConfig()}
        </SettingsSection>

        <SettingsSection title={kbText("sections.models.title")} description={kbText("sections.models.description")}>
          <div className="space-y-4">
            {foundationWarningKey ? (
              <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm leading-6 text-[#713f12]">
                {kbText(foundationWarningKey)}
              </div>
            ) : (
              <div className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm leading-6 text-[#1e3a8a]">
                {kbText("messages.foundationReady")}
              </div>
            )}
            {providerOptions.length ? null : (
              <div className="rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-sm text-[var(--warning)]">
                {kbText("messages.noProviderOptions")}
              </div>
            )}
            {renderModelConfig("vlm")}
            {renderModelConfig("embedding")}
          </div>
        </SettingsSection>

        {message ? <div className="text-sm text-[var(--ink-muted)]">{text(message, message)}</div> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={save} disabled={isPending}>
            {isPending ? text("actions.saving") : text("actions.save")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setForm(prepareEditableSettings(setting))}>
            {text("actions.reset")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setForm(applyDefaultModelSettings(prepareEditableSettings(setting), providerOptions, modelDefaults, { force: true }))}>
            <RotateCcw className="h-4 w-4" />
            {kbText("actions.applyDefaults")}
          </Button>
        </div>
      </div>

      <aside className="h-fit rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <div className="text-sm font-semibold text-[var(--ink)]">{kbText("summary.title")}</div>
        <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          {kbText("summary.description")}
        </div>
        <div className="mt-4 space-y-3 text-xs text-[var(--ink-muted)]">
          <div>
            <div className="font-medium text-[var(--ink)]">{kbText("summary.storageWorkspace")}</div>
            <div className="mt-1 break-all font-mono">{form.storageWorkspace}</div>
          </div>
          <div className="border-t border-[var(--line)] pt-3">
            <div className="font-medium text-[var(--ink)]">{kbText("summary.codebaseEngine")}</div>
            <div className="mt-1 break-all font-mono">
              {kbText(`codebaseEngine.providers.${form.codebaseEngineProvider === "tree_sitter" ? "treeSitter" : form.codebaseEngineProvider}`)}
            </div>
            <div className="mt-1 text-[var(--ink-subtle)]">
              {kbText("summary.codebaseEngineDetail", {
                strategy: kbText(`codebaseEngine.indexStrategies.${form.codebaseEngineIndexStrategy}`),
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-3">
            <div>
              <div className="font-medium text-[var(--ink)]">{kbText("summary.enabled")}</div>
              <div>{form.enabled ? text("ui.common.boolean.yes") : text("ui.common.boolean.no")}</div>
            </div>
            <div>
              <div className="font-medium text-[var(--ink)]">{kbText("fields.vectorDbBackend.label")}</div>
              <div>{form.vectorDbBackend}</div>
            </div>
          </div>
          <div className="border-t border-[var(--line)] pt-3">
            <div className="font-medium text-[var(--ink)]">{kbText(KNOWLEDGE_FOUNDATION_LABEL_KEY)}</div>
            <div className="mt-1 break-all font-mono">{form.vlmModel || kbText("status.unconfigured")}</div>
            <div className="mt-1 text-[var(--ink-subtle)]">
              {kbText("summary.contentFoundationDetail", { status: kbText(contentFoundationStatusKey(form)) })}
            </div>
          </div>
          <div>
            <div className="font-medium text-[var(--ink)]">{kbText("summary.embeddingModel")}</div>
            <div className="mt-1 break-all font-mono">
              {form.embeddingModel || modelDefaults.embedding.model}
              {form.embeddingDimension ? kbText("summary.embeddingDimension", { dimension: form.embeddingDimension }) : ""}
            </div>
            <div className="mt-1 text-[var(--ink-subtle)]">{kbText("summary.embeddingDetail")}</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
