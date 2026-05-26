import type { Model } from "@earendil-works/pi-ai";
import {
  type ProviderProfile,
  type ProviderRuntimeBinding,
} from "@/server/db";
import { uiText } from "@/lib/language-pack";

export type ProviderProfileConfig = {
  modelApi?: string;
  contextWindow?: number;
  maxTokens?: number;
  reasoning?: boolean;
  thinkingLevelMap?: Model<string>["thinkingLevelMap"];
  headers?: Record<string, string>;
  compat?: Record<string, unknown>;
  supportsResponsesApi?: boolean;
  supportsChatCompletions?: boolean;
};

export type RuntimeBindingConfig = {
  defaultModel?: string;
  approvalMode?: "allow" | "ask" | "deny" | "manual";
  eventContract?: string;
  executionMode?: "embedded" | "proxy";
  humanIntervention?: "steer" | "follow_up" | "disabled";
  thinkingLevel?: "off" | "low" | "medium" | "high";
  env?: Record<string, string>;
};

export function parseJsonRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function resolveProviderConfig(provider: ProviderProfile): ProviderProfileConfig {
  return parseJsonRecord(provider.configJson) as ProviderProfileConfig;
}

export function resolveRuntimeBindingConfig(binding: ProviderRuntimeBinding): RuntimeBindingConfig {
  return parseJsonRecord(binding.configJson) as RuntimeBindingConfig;
}

export function resolveSecretRef(secretRef: string) {
  const value = secretRef.trim();
  if (!value || value.toLowerCase().startsWith("env:")) return null;
  return value;
}

export function maskSecretRef(secretRef: string) {
  const value = secretRef.trim();
  if (!value) return "";
  if (value.toLowerCase().startsWith("env:")) return "env:****";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

export function resolveProviderApi(provider: ProviderProfile) {
  const config = resolveProviderConfig(provider);
  if (config.modelApi) return config.modelApi;

  switch (provider.apiStyle) {
    case "openai-responses":
      return "openai-responses";
    case "openai-completions":
    case "openai-compatible":
      return "openai-completions";
    case "azure-openai":
      return "azure-openai-responses";
    case "anthropic":
      return "anthropic-messages";
    case "openai":
    default:
      return config.supportsResponsesApi === false ? "openai-completions" : "openai-responses";
  }
}

export function resolveProviderModelId(
  provider: ProviderProfile,
  binding?: ProviderRuntimeBinding | null,
) {
  const bindingConfig = binding ? resolveRuntimeBindingConfig(binding) : {};
  return bindingConfig.defaultModel?.trim() || provider.defaultModel;
}

export function resolveProviderApiKey(
  provider: ProviderProfile,
  binding?: ProviderRuntimeBinding | null,
) {
  const bindingSecret = binding ? resolveSecretRef(binding.apiKeyRef) : null;
  return bindingSecret ?? resolveSecretRef(provider.apiKeyRef);
}

export function buildPiModel(
  provider: ProviderProfile,
  binding?: ProviderRuntimeBinding | null,
): Model<string> {
  const config = resolveProviderConfig(provider);
  const modelId = resolveProviderModelId(provider, binding);
  const api = resolveProviderApi(provider);

  return {
    id: modelId,
    name: modelId,
    api,
    provider:
      provider.apiStyle === "openai-compatible" || provider.apiStyle.startsWith("openai")
        ? "openai"
        : provider.apiStyle,
    baseUrl: provider.baseUrl,
    reasoning: config.reasoning ?? true,
    thinkingLevelMap: config.thinkingLevelMap,
    input: ["text"],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: Number(config.contextWindow ?? 128000),
    maxTokens: Number(config.maxTokens ?? 8192),
    headers: config.headers,
    compat: config.compat as never,
  };
}

export function buildRuntimeDescriptor(
  binding: ProviderRuntimeBinding,
  provider: ProviderProfile | null,
) {
  const bindingConfig = resolveRuntimeBindingConfig(binding);
  return {
    adapterDefinitionId: binding.adapterDefinitionId,
    runtimeKind: binding.runtimeKind,
    executionMode: bindingConfig.executionMode ?? "embedded",
    eventContract:
      bindingConfig.eventContract === "provider_event_v1"
        ? "agent_event_v1"
        : bindingConfig.eventContract ?? "agent_event_v1",
    approvalMode: bindingConfig.approvalMode ?? "allow",
    humanIntervention: bindingConfig.humanIntervention ?? "steer",
    defaultModel: provider ? resolveProviderModelId(provider, binding) : bindingConfig.defaultModel ?? "",
    providerLabel: provider ? `${provider.name} / ${resolveProviderModelId(provider, binding)}` : uiText("ui.generated.c89b342a06a"),
    apiKeyRefMasked: maskSecretRef(binding.apiKeyRef || provider?.apiKeyRef || ""),
  };
}
