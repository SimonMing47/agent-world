import fs from "node:fs";
import path from "node:path";
import { uiText } from "@/lib/language-pack";
import { execute, queryOne, type SystemSetting } from "@/server/db";

export const KNOWLEDGE_BASE_SETTINGS_KEY = "knowledge-base";
export const DEFAULT_KNOWLEDGE_ENGINE_ENDPOINT = "local://agentworld-knowledge";
const FALLBACK_KNOWLEDGE_DEFAULT_EMBEDDING_PROVIDER = "local";
const FALLBACK_KNOWLEDGE_DEFAULT_EMBEDDING_MODEL = "";
const FALLBACK_KNOWLEDGE_DEFAULT_EMBEDDING_DIMENSION = "";

export type KnowledgeBaseProvider = "native";
export type KnowledgeCodebaseEngineProvider = "codegraph" | "sourcegraph" | "tree_sitter" | "disabled";
export type KnowledgeCodebaseEngineIndexStrategy = "hybrid" | "graph" | "semantic" | "lexical";
export type KnowledgeCodebaseEngineSyncMode = "manual" | "on_demand" | "scheduled";

export type KnowledgeBaseSettings = {
  provider: KnowledgeBaseProvider;
  enabled: boolean;
  autoStart: boolean;
  baseUrl: string;
  host: string;
  port: string;
  serverBin: string;
  configPath: string;
  cliConfigPath: string;
  timeoutSeconds: string;
  apiKey: string;
  account: string;
  user: string;
  agentId: string;
  corsOrigins: string;
  storageWorkspace: string;
  agfsBackend: string;
  vectorDbBackend: string;
  taskTrackerBackend: string;
  lockTimeoutSeconds: string;
  lockExpireSeconds: string;
  logLevel: string;
  vlmProviderProfileId: string;
  vlmProvider: string;
  vlmModel: string;
  vlmApiBase: string;
  vlmApiKey: string;
  embeddingProviderProfileId: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingApiBase: string;
  embeddingApiKey: string;
  embeddingDimension: string;
  codebaseEngineProvider: KnowledgeCodebaseEngineProvider;
  codebaseEngineIndexStrategy: KnowledgeCodebaseEngineIndexStrategy;
  codebaseEngineSyncMode: KnowledgeCodebaseEngineSyncMode;
  codebaseEngineEndpoint: string;
  codebaseEngineMcpEndpoint: string;
  codebaseEngineCommand: string;
  codebaseEngineWorkspace: string;
  codebaseEngineApiKey: string;
  codebaseEngineIgnoreGlobs: string;
};

type KnowledgeEngineStorageConfig = Record<string, unknown>;
type KnowledgeEngineClientConfig = Record<string, unknown>;

export type KnowledgeModelDefaults = {
  contentUnderstanding: {
    providerProfileId: string;
    provider: string;
    model: string;
    apiBase: string;
  };
  embedding: {
    providerProfileId: string;
    provider: string;
    model: string;
    apiBase: string;
    dimension: string;
  };
};

export type KnowledgeFoundationState = "enabled" | "pending_api_key" | "missing_model";
export type KnowledgeCodebaseEngineState = "disabled" | "configured" | "missing_endpoint";

export type KnowledgeFoundationStatus = {
  state: KnowledgeFoundationState;
  label: string;
  detail: string;
  provider: string;
  model: string;
  canWriteVlmConfig: boolean;
};

export type KnowledgeCodebaseEngineStatus = {
  state: KnowledgeCodebaseEngineState;
  label: string;
  detail: string;
  provider: KnowledgeCodebaseEngineProvider;
  endpoint: string;
  mcpEndpoint: string;
  indexStrategy: KnowledgeCodebaseEngineIndexStrategy;
  syncMode: KnowledgeCodebaseEngineSyncMode;
};

function dataDir() {
  return path.join("data", "knowledge-engine");
}

function modelDefaultsPath() {
  return process.env.KNOWLEDGE_ENGINE_MODEL_DEFAULTS_FILE ?? path.join(dataDir(), "model-defaults.json");
}

function readString(source: Record<string, unknown>, key: string, fallback = "") {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function getKnowledgeModelDefaults(): KnowledgeModelDefaults {
  const fallback: KnowledgeModelDefaults = {
    contentUnderstanding: {
      providerProfileId: "",
      provider: "",
      model: "",
      apiBase: "",
    },
    embedding: {
      providerProfileId: "",
      provider: FALLBACK_KNOWLEDGE_DEFAULT_EMBEDDING_PROVIDER,
      model: FALLBACK_KNOWLEDGE_DEFAULT_EMBEDDING_MODEL,
      apiBase: "",
      dimension: FALLBACK_KNOWLEDGE_DEFAULT_EMBEDDING_DIMENSION,
    },
  };
  try {
    const parsed = parseJsonRecord(fs.readFileSync(path.resolve(/* turbopackIgnore: true */ modelDefaultsPath()), "utf8"));
    const contentUnderstanding = parseJsonRecord(JSON.stringify(parsed.contentUnderstanding ?? {}));
    const embedding = parseJsonRecord(JSON.stringify(parsed.embedding ?? {}));
    return {
      contentUnderstanding: {
        providerProfileId: readString(contentUnderstanding, "providerProfileId", fallback.contentUnderstanding.providerProfileId),
        provider: readString(contentUnderstanding, "provider", fallback.contentUnderstanding.provider),
        model: readString(contentUnderstanding, "model", fallback.contentUnderstanding.model),
        apiBase: readString(contentUnderstanding, "apiBase", fallback.contentUnderstanding.apiBase),
      },
      embedding: {
        providerProfileId: readString(embedding, "providerProfileId", fallback.embedding.providerProfileId),
        provider: readString(embedding, "provider", fallback.embedding.provider),
        model: readString(embedding, "model", fallback.embedding.model),
        apiBase: readString(embedding, "apiBase", fallback.embedding.apiBase),
        dimension: readString(embedding, "dimension", fallback.embedding.dimension),
      },
    };
  } catch {
    return fallback;
  }
}

function defaultCorsOrigins() {
  return [
    process.env.AGENTWORLD_PUBLIC_BASE_URL ?? "http://localhost:7369",
    "http://127.0.0.1:7369",
    "http://localhost:7369",
  ].join("\n");
}

function defaultSettings(): KnowledgeBaseSettings {
  const modelDefaults = getKnowledgeModelDefaults();
  return {
    provider: "native",
    enabled: true,
    autoStart: false,
    baseUrl: DEFAULT_KNOWLEDGE_ENGINE_ENDPOINT,
    host: "local",
    port: "1",
    serverBin: "",
    configPath: path.join(dataDir(), "engine.json"),
    cliConfigPath: path.join(dataDir(), "cli.json"),
    timeoutSeconds: "60",
    apiKey: "",
    account: "",
    user: "",
    agentId: "",
    corsOrigins: defaultCorsOrigins(),
    storageWorkspace: dataDir(),
    agfsBackend: "local",
    vectorDbBackend: "local",
    taskTrackerBackend: "persistent",
    lockTimeoutSeconds: "5",
    lockExpireSeconds: "300",
    logLevel: process.env.KNOWLEDGE_ENGINE_LOG_LEVEL ?? "INFO",
    vlmProviderProfileId: modelDefaults.contentUnderstanding.providerProfileId,
    vlmProvider: process.env.KNOWLEDGE_ENGINE_VLM_PROVIDER ?? modelDefaults.contentUnderstanding.provider,
    vlmModel: process.env.KNOWLEDGE_ENGINE_VLM_MODEL ?? modelDefaults.contentUnderstanding.model,
    vlmApiBase: process.env.KNOWLEDGE_ENGINE_VLM_API_BASE ?? modelDefaults.contentUnderstanding.apiBase,
    vlmApiKey: process.env.KNOWLEDGE_ENGINE_VLM_API_KEY ?? "",
    embeddingProviderProfileId: modelDefaults.embedding.providerProfileId,
    embeddingProvider: process.env.KNOWLEDGE_ENGINE_EMBEDDING_PROVIDER ?? modelDefaults.embedding.provider,
    embeddingModel: process.env.KNOWLEDGE_ENGINE_EMBEDDING_MODEL ?? modelDefaults.embedding.model,
    embeddingApiBase: process.env.KNOWLEDGE_ENGINE_EMBEDDING_API_BASE ?? modelDefaults.embedding.apiBase,
    embeddingApiKey: process.env.KNOWLEDGE_ENGINE_EMBEDDING_API_KEY ?? "",
    embeddingDimension: process.env.KNOWLEDGE_ENGINE_EMBEDDING_DIMENSION ?? modelDefaults.embedding.dimension,
    codebaseEngineProvider: normalizeCodebaseEngineProvider(process.env.KNOWLEDGE_CODEBASE_ENGINE_PROVIDER),
    codebaseEngineIndexStrategy: normalizeCodebaseEngineIndexStrategy(process.env.KNOWLEDGE_CODEBASE_ENGINE_INDEX_STRATEGY),
    codebaseEngineSyncMode: normalizeCodebaseEngineSyncMode(process.env.KNOWLEDGE_CODEBASE_ENGINE_SYNC_MODE),
    codebaseEngineEndpoint: process.env.KNOWLEDGE_CODEBASE_ENGINE_ENDPOINT ?? "",
    codebaseEngineMcpEndpoint: process.env.KNOWLEDGE_CODEBASE_ENGINE_MCP_ENDPOINT ?? "",
    codebaseEngineCommand: process.env.KNOWLEDGE_CODEBASE_ENGINE_COMMAND ?? "codegraph",
    codebaseEngineWorkspace: process.env.KNOWLEDGE_CODEBASE_ENGINE_WORKSPACE ?? path.join(dataDir(), "codebase-engine"),
    codebaseEngineApiKey: process.env.KNOWLEDGE_CODEBASE_ENGINE_API_KEY ?? "",
    codebaseEngineIgnoreGlobs: process.env.KNOWLEDGE_CODEBASE_ENGINE_IGNORE_GLOBS ?? [
      "node_modules/**",
      ".git/**",
      "dist/**",
      "build/**",
      ".next/**",
      "coverage/**",
    ].join("\n"),
  };
}

function parseJsonRecord(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function readText(source: Record<string, unknown>, key: keyof KnowledgeBaseSettings, fallback: string) {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readOptionalText(source: Record<string, unknown>, key: keyof KnowledgeBaseSettings, fallback = "") {
  const value = source[key];
  return typeof value === "string" ? value.trim() : fallback;
}

function readBoolean(source: Record<string, unknown>, key: keyof KnowledgeBaseSettings, fallback: boolean) {
  const value = source[key];
  return typeof value === "boolean" ? value : fallback;
}

function normalizeCodebaseEngineProvider(value: unknown): KnowledgeCodebaseEngineProvider {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "sourcegraph") return "sourcegraph";
  if (normalized === "tree_sitter" || normalized === "tree-sitter" || normalized === "treesitter") return "tree_sitter";
  if (normalized === "disabled" || normalized === "none" || normalized === "off") return "disabled";
  return "codegraph";
}

function normalizeCodebaseEngineIndexStrategy(value: unknown): KnowledgeCodebaseEngineIndexStrategy {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "graph") return "graph";
  if (normalized === "semantic") return "semantic";
  if (normalized === "lexical") return "lexical";
  return "hybrid";
}

function normalizeCodebaseEngineSyncMode(value: unknown): KnowledgeCodebaseEngineSyncMode {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "manual") return "manual";
  if (normalized === "scheduled") return "scheduled";
  return "on_demand";
}

function normalizeUrl(value: string, fallback: string) {
  const nextValue = value.trim() || fallback;
  try {
    return new URL(nextValue).toString().replace(/\/+$/, "");
  } catch {
    throw new Error(
      uiText("ui.server.knowledgeBase.errors.invalidBaseUrl", "Knowledge engine endpoint format is invalid."),
    );
  }
}

function normalizePositiveNumberText(value: string, fallback: string, label: string) {
  const nextValue = value.trim() || fallback;
  const numeric = Number(nextValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(
      uiText("ui.server.knowledgeBase.errors.positiveNumberRequired", "{label} must be a number greater than 0.", {
        label,
      }),
    );
  }
  return String(nextValue);
}

function normalizeOptionalPositiveNumberText(value: string, label: string) {
  const nextValue = value.trim();
  if (!nextValue) return "";
  const numeric = Number(nextValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(
      uiText("ui.server.knowledgeBase.errors.positiveNumberRequired", "{label} must be a number greater than 0.", {
        label,
      }),
    );
  }
  return nextValue;
}

function normalizePort(value: string, fallback: string) {
  const nextValue = normalizePositiveNumberText(value, fallback, "Knowledge engine port");
  const numeric = Number(nextValue);
  if (numeric > 65535) {
    throw new Error(uiText("ui.server.knowledgeBase.errors.portTooLarge", "Knowledge engine port must not exceed 65535."));
  }
  return nextValue;
}

function normalizeCorsOrigins(value: string, fallback: string) {
  const lines = (value || fallback)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return Array.from(new Set(lines)).join("\n");
}

function assertNoEnvSecretReference(value: string, label: string) {
  if (value.trim().toLowerCase().startsWith("env:")) {
    throw new Error(
      uiText(
        "ui.server.knowledgeBase.errors.envSecretReferenceUnsupported",
        "{label} no longer supports env: environment variable references. Save the configuration value directly.",
        { label },
      ),
    );
  }
}

function normalizeSettings(input: Partial<KnowledgeBaseSettings>, current: KnowledgeBaseSettings) {
  const baseUrl = normalizeUrl(input.baseUrl ?? current.baseUrl, current.baseUrl);
  const port = normalizePort(input.port ?? current.port, current.port);
  const timeoutSeconds = normalizePositiveNumberText(
    input.timeoutSeconds ?? current.timeoutSeconds,
    current.timeoutSeconds,
    "Knowledge engine timeout",
  );
  const lockTimeoutSeconds = normalizePositiveNumberText(
    input.lockTimeoutSeconds ?? current.lockTimeoutSeconds,
    current.lockTimeoutSeconds,
    "Knowledge engine lock timeout",
  );
  const lockExpireSeconds = normalizePositiveNumberText(
    input.lockExpireSeconds ?? current.lockExpireSeconds,
    current.lockExpireSeconds,
    "Knowledge engine lock expire",
  );
  const embeddingDimension = normalizeOptionalPositiveNumberText(
    input.embeddingDimension ?? current.embeddingDimension,
    "Knowledge engine embedding dimension",
  );
  const embeddingProvider =
    (input.embeddingProvider ?? current.embeddingProvider).trim() || getKnowledgeModelDefaults().embedding.provider;
  const embeddingModel =
    (input.embeddingModel ?? current.embeddingModel).trim()
    || (embeddingProvider === getKnowledgeModelDefaults().embedding.provider ? getKnowledgeModelDefaults().embedding.model : "");
  const effectiveEmbeddingDimension =
    embeddingDimension
    || (
      embeddingProvider === getKnowledgeModelDefaults().embedding.provider
      && embeddingModel === getKnowledgeModelDefaults().embedding.model
        ? getKnowledgeModelDefaults().embedding.dimension
        : ""
    );
  const apiKey = (input.apiKey ?? current.apiKey).trim();
  const vlmApiKey = (input.vlmApiKey ?? current.vlmApiKey).trim();
  const embeddingApiKey = (input.embeddingApiKey ?? current.embeddingApiKey).trim();
  const codebaseEngineApiKey = (input.codebaseEngineApiKey ?? current.codebaseEngineApiKey).trim();
  const codebaseEngineProvider = normalizeCodebaseEngineProvider(input.codebaseEngineProvider ?? current.codebaseEngineProvider);

  assertNoEnvSecretReference(apiKey, "Knowledge Engine API Key");
  assertNoEnvSecretReference(vlmApiKey, "Knowledge Engine VLM API Key");
  assertNoEnvSecretReference(embeddingApiKey, "Knowledge Engine Embedding API Key");
  assertNoEnvSecretReference(codebaseEngineApiKey, "Knowledge Codebase Engine API Key");

  return {
    provider: "native",
    enabled: input.enabled ?? current.enabled,
    autoStart: input.autoStart ?? current.autoStart,
    baseUrl,
    host: (input.host ?? current.host).trim() || current.host,
    port,
    serverBin: (input.serverBin ?? current.serverBin).trim() || current.serverBin,
    configPath: (input.configPath ?? current.configPath).trim() || current.configPath,
    cliConfigPath: (input.cliConfigPath ?? current.cliConfigPath).trim() || current.cliConfigPath,
    timeoutSeconds,
    apiKey,
    account: (input.account ?? current.account).trim(),
    user: (input.user ?? current.user).trim(),
    agentId: (input.agentId ?? current.agentId).trim(),
    corsOrigins: normalizeCorsOrigins(input.corsOrigins ?? current.corsOrigins, current.corsOrigins),
    storageWorkspace: (input.storageWorkspace ?? current.storageWorkspace).trim() || current.storageWorkspace,
    agfsBackend: (input.agfsBackend ?? current.agfsBackend).trim() || current.agfsBackend,
    vectorDbBackend: (input.vectorDbBackend ?? current.vectorDbBackend).trim() || current.vectorDbBackend,
    taskTrackerBackend: (input.taskTrackerBackend ?? current.taskTrackerBackend).trim() || current.taskTrackerBackend,
    lockTimeoutSeconds,
    lockExpireSeconds,
    logLevel: (input.logLevel ?? current.logLevel).trim() || current.logLevel,
    vlmProviderProfileId: (input.vlmProviderProfileId ?? current.vlmProviderProfileId).trim(),
    vlmProvider: (input.vlmProvider ?? current.vlmProvider).trim(),
    vlmModel: (input.vlmModel ?? current.vlmModel).trim(),
    vlmApiBase: (input.vlmApiBase ?? current.vlmApiBase).trim(),
    vlmApiKey,
    embeddingProviderProfileId: (input.embeddingProviderProfileId ?? current.embeddingProviderProfileId).trim(),
    embeddingProvider,
    embeddingModel,
    embeddingApiBase: (input.embeddingApiBase ?? current.embeddingApiBase).trim(),
    embeddingApiKey,
    embeddingDimension: effectiveEmbeddingDimension,
    codebaseEngineProvider,
    codebaseEngineIndexStrategy: normalizeCodebaseEngineIndexStrategy(input.codebaseEngineIndexStrategy ?? current.codebaseEngineIndexStrategy),
    codebaseEngineSyncMode: normalizeCodebaseEngineSyncMode(input.codebaseEngineSyncMode ?? current.codebaseEngineSyncMode),
    codebaseEngineEndpoint: (input.codebaseEngineEndpoint ?? current.codebaseEngineEndpoint).trim(),
    codebaseEngineMcpEndpoint: (input.codebaseEngineMcpEndpoint ?? current.codebaseEngineMcpEndpoint).trim(),
    codebaseEngineCommand: (input.codebaseEngineCommand ?? current.codebaseEngineCommand).trim()
      || (codebaseEngineProvider === "codegraph" ? "codegraph" : ""),
    codebaseEngineWorkspace: (input.codebaseEngineWorkspace ?? current.codebaseEngineWorkspace).trim()
      || path.join(dataDir(), "codebase-engine"),
    codebaseEngineApiKey,
    codebaseEngineIgnoreGlobs: normalizeCorsOrigins(
      input.codebaseEngineIgnoreGlobs ?? current.codebaseEngineIgnoreGlobs,
      current.codebaseEngineIgnoreGlobs,
    ),
  } satisfies KnowledgeBaseSettings;
}

export function canWriteKnowledgeVlmConfig(setting: KnowledgeBaseSettings) {
  if (!setting.vlmProvider || !setting.vlmModel) return false;
  if (setting.vlmApiKey) return true;
  const provider = setting.vlmProvider.toLowerCase();
  const model = setting.vlmModel.toLowerCase();
  return provider === "openai-codex" || (provider === "litellm" && model.startsWith("ollama/"));
}

export function getKnowledgeFoundationStatus(setting = getKnowledgeBaseSettings()): KnowledgeFoundationStatus {
  const canWriteVlmConfig = canWriteKnowledgeVlmConfig(setting);
  if (!setting.vlmProvider || !setting.vlmModel) {
    return {
      state: "missing_model",
      label: uiText("settings.knowledgeBase.status.unconfigured", "Not configured"),
      detail: uiText(
        "ui.server.knowledgeBase.foundationStatus.missingModel.detail",
        "No content understanding model is selected; the knowledge foundation can only use original content and retrieval indexes.",
      ),
      provider: setting.vlmProvider,
      model: setting.vlmModel,
      canWriteVlmConfig,
    };
  }
  if (!canWriteVlmConfig) {
    return {
      state: "pending_api_key",
      label: uiText("settings.knowledgeBase.status.apiKeyRequired", "API key required"),
      detail: uiText(
        "ui.server.knowledgeBase.foundationStatus.pendingApiKey.detail",
        "A content understanding model is selected, but no directly savable API key is available yet.",
      ),
      provider: setting.vlmProvider,
      model: setting.vlmModel,
      canWriteVlmConfig,
    };
  }
  return {
    state: "enabled",
    label: uiText("settings.knowledgeBase.status.enabled", "Enabled"),
    detail: uiText(
      "ui.server.knowledgeBase.foundationStatus.enabled.detail",
      "The content understanding model will serve as the knowledge foundation for L0 summaries, L1 overviews, and layered semantic structure.",
    ),
    provider: setting.vlmProvider,
    model: setting.vlmModel,
    canWriteVlmConfig,
  };
}

export function getKnowledgeCodebaseEngineStatus(setting = getKnowledgeBaseSettings()): KnowledgeCodebaseEngineStatus {
  if (setting.codebaseEngineProvider === "disabled") {
    return {
      state: "disabled",
      label: uiText("settings.knowledgeBase.codebaseEngine.status.disabled", "Disabled"),
      detail: uiText(
        "settings.knowledgeBase.codebaseEngine.status.disabledDetail",
        "Code knowledge will use only manually curated knowledge spaces.",
      ),
      provider: setting.codebaseEngineProvider,
      endpoint: setting.codebaseEngineEndpoint,
      mcpEndpoint: setting.codebaseEngineMcpEndpoint,
      indexStrategy: setting.codebaseEngineIndexStrategy,
      syncMode: setting.codebaseEngineSyncMode,
    };
  }

  const hasConnector =
    setting.codebaseEngineProvider === "tree_sitter"
      || (
        setting.codebaseEngineProvider === "sourcegraph"
          ? Boolean(setting.codebaseEngineEndpoint || setting.codebaseEngineMcpEndpoint)
          : Boolean(setting.codebaseEngineEndpoint || setting.codebaseEngineMcpEndpoint || setting.codebaseEngineCommand)
      );
  if (!hasConnector) {
    return {
      state: "missing_endpoint",
      label: uiText("settings.knowledgeBase.codebaseEngine.status.missingEndpoint", "Connector required"),
      detail: uiText(
        "settings.knowledgeBase.codebaseEngine.status.missingEndpointDetail",
        "Configure an endpoint, MCP endpoint, or local command before importing code knowledge automatically.",
      ),
      provider: setting.codebaseEngineProvider,
      endpoint: setting.codebaseEngineEndpoint,
      mcpEndpoint: setting.codebaseEngineMcpEndpoint,
      indexStrategy: setting.codebaseEngineIndexStrategy,
      syncMode: setting.codebaseEngineSyncMode,
    };
  }

  return {
    state: "configured",
    label: uiText("settings.knowledgeBase.codebaseEngine.status.configured", "Configured"),
    detail: uiText(
      "settings.knowledgeBase.codebaseEngine.status.configuredDetail",
      "Code knowledge can combine graph, lexical, and semantic retrieval under the selected engine.",
    ),
    provider: setting.codebaseEngineProvider,
    endpoint: setting.codebaseEngineEndpoint,
    mcpEndpoint: setting.codebaseEngineMcpEndpoint,
    indexStrategy: setting.codebaseEngineIndexStrategy,
    syncMode: setting.codebaseEngineSyncMode,
  };
}

export function getKnowledgeBaseConfigWarnings(setting = getKnowledgeBaseSettings()) {
  const foundation = getKnowledgeFoundationStatus(setting);
  const codebaseEngine = getKnowledgeCodebaseEngineStatus(setting);
  const warnings: string[] = [];
  if (foundation.state !== "enabled") {
    warnings.push(uiText("ui.server.knowledgeBase.foundationWarning", "Content understanding foundation {label}: {detail}", {
      label: foundation.label,
      detail: foundation.detail,
    }));
  }
  if (codebaseEngine.state === "missing_endpoint") {
    warnings.push(uiText("ui.server.knowledgeBase.codebaseEngineWarning", "Codebase engine {label}: {detail}", {
      label: codebaseEngine.label,
      detail: codebaseEngine.detail,
    }));
  }
  return warnings;
}

export function getKnowledgeBaseSettings() {
  const defaults = defaultSettings();
  const row = queryOne<SystemSetting>("SELECT * FROM system_settings WHERE key = ?", KNOWLEDGE_BASE_SETTINGS_KEY);
  const parsed = parseJsonRecord(row?.valueJson);

  return {
    provider: "native",
    enabled: readBoolean(parsed, "enabled", defaults.enabled),
    autoStart: readBoolean(parsed, "autoStart", defaults.autoStart),
    baseUrl: readText(parsed, "baseUrl", defaults.baseUrl).replace(/\/+$/, ""),
    host: readText(parsed, "host", defaults.host),
    port: readText(parsed, "port", defaults.port),
    serverBin: readText(parsed, "serverBin", defaults.serverBin),
    configPath: readText(parsed, "configPath", defaults.configPath),
    cliConfigPath: readText(parsed, "cliConfigPath", defaults.cliConfigPath),
    timeoutSeconds: readText(parsed, "timeoutSeconds", defaults.timeoutSeconds),
    apiKey: readOptionalText(parsed, "apiKey", defaults.apiKey),
    account: readOptionalText(parsed, "account", defaults.account),
    user: readOptionalText(parsed, "user", defaults.user),
    agentId: readOptionalText(parsed, "agentId", defaults.agentId),
    corsOrigins: readText(parsed, "corsOrigins", defaults.corsOrigins),
    storageWorkspace: readText(parsed, "storageWorkspace", defaults.storageWorkspace),
    agfsBackend: readText(parsed, "agfsBackend", defaults.agfsBackend),
    vectorDbBackend: readText(parsed, "vectorDbBackend", defaults.vectorDbBackend),
    taskTrackerBackend: readText(parsed, "taskTrackerBackend", defaults.taskTrackerBackend),
    lockTimeoutSeconds: readText(parsed, "lockTimeoutSeconds", defaults.lockTimeoutSeconds),
    lockExpireSeconds: readText(parsed, "lockExpireSeconds", defaults.lockExpireSeconds),
    logLevel: readText(parsed, "logLevel", defaults.logLevel),
    vlmProviderProfileId: readOptionalText(parsed, "vlmProviderProfileId", defaults.vlmProviderProfileId),
    vlmProvider: readOptionalText(parsed, "vlmProvider", defaults.vlmProvider),
    vlmModel: readOptionalText(parsed, "vlmModel", defaults.vlmModel),
    vlmApiBase: readOptionalText(parsed, "vlmApiBase", defaults.vlmApiBase),
    vlmApiKey: readOptionalText(parsed, "vlmApiKey", defaults.vlmApiKey),
    embeddingProviderProfileId: readOptionalText(parsed, "embeddingProviderProfileId", defaults.embeddingProviderProfileId),
    embeddingProvider: readText(parsed, "embeddingProvider", defaults.embeddingProvider),
    embeddingModel: readText(parsed, "embeddingModel", defaults.embeddingModel),
    embeddingApiBase: readOptionalText(parsed, "embeddingApiBase", defaults.embeddingApiBase),
    embeddingApiKey: readOptionalText(parsed, "embeddingApiKey", defaults.embeddingApiKey),
    embeddingDimension: readText(parsed, "embeddingDimension", defaults.embeddingDimension),
    codebaseEngineProvider: normalizeCodebaseEngineProvider(readText(parsed, "codebaseEngineProvider", defaults.codebaseEngineProvider)),
    codebaseEngineIndexStrategy: normalizeCodebaseEngineIndexStrategy(readText(parsed, "codebaseEngineIndexStrategy", defaults.codebaseEngineIndexStrategy)),
    codebaseEngineSyncMode: normalizeCodebaseEngineSyncMode(readText(parsed, "codebaseEngineSyncMode", defaults.codebaseEngineSyncMode)),
    codebaseEngineEndpoint: readOptionalText(parsed, "codebaseEngineEndpoint", defaults.codebaseEngineEndpoint),
    codebaseEngineMcpEndpoint: readOptionalText(parsed, "codebaseEngineMcpEndpoint", defaults.codebaseEngineMcpEndpoint),
    codebaseEngineCommand: readOptionalText(parsed, "codebaseEngineCommand", defaults.codebaseEngineCommand),
    codebaseEngineWorkspace: readText(parsed, "codebaseEngineWorkspace", defaults.codebaseEngineWorkspace),
    codebaseEngineApiKey: readOptionalText(parsed, "codebaseEngineApiKey", defaults.codebaseEngineApiKey),
    codebaseEngineIgnoreGlobs: readText(parsed, "codebaseEngineIgnoreGlobs", defaults.codebaseEngineIgnoreGlobs),
  } satisfies KnowledgeBaseSettings;
}

export function upsertKnowledgeBaseSettings(input: Partial<KnowledgeBaseSettings>, updatedBy = "system") {
  const normalized = normalizeSettings(input, getKnowledgeBaseSettings());
  const now = new Date().toISOString();
  execute(
    `
      INSERT INTO system_settings (key, value_json, updated_by, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `,
    KNOWLEDGE_BASE_SETTINGS_KEY,
    JSON.stringify(normalized),
    updatedBy,
    now,
  );

  return getKnowledgeBaseSettings();
}

export function getKnowledgeEngineRuntimePaths(setting = getKnowledgeBaseSettings()) {
  return {
    configPath: path.resolve(/* turbopackIgnore: true */ setting.configPath),
    cliConfigPath: path.resolve(/* turbopackIgnore: true */ setting.cliConfigPath),
    serverBin: path.resolve(/* turbopackIgnore: true */ setting.serverBin),
  };
}

export function buildKnowledgeEngineServerConfig(setting = getKnowledgeBaseSettings()): KnowledgeEngineStorageConfig {
  const server: Record<string, unknown> = {
    host: setting.host,
    port: Number(setting.port),
    cors_origins: setting.corsOrigins.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
  };
  if (setting.apiKey) server.root_api_key = setting.apiKey;

  const config: KnowledgeEngineStorageConfig = {
    server,
    storage: {
      workspace: setting.storageWorkspace,
      agfs: { backend: setting.agfsBackend },
      vectordb: { backend: setting.vectorDbBackend },
      transaction: {
        lock_timeout: Number(setting.lockTimeoutSeconds),
        lock_expire: Number(setting.lockExpireSeconds),
      },
    },
    log: {
      level: setting.logLevel,
      output: "stdout",
    },
  };

  if (canWriteKnowledgeVlmConfig(setting)) {
    config.vlm = {
      provider: setting.vlmProvider,
      model: setting.vlmModel,
      ...(setting.vlmApiBase ? { api_base: setting.vlmApiBase } : {}),
      ...(setting.vlmApiKey ? { api_key: setting.vlmApiKey } : {}),
    };
  }

  if (setting.embeddingProvider && setting.embeddingModel) {
    config.embedding = {
      dense: {
        provider: setting.embeddingProvider,
        model: setting.embeddingModel,
        ...(setting.embeddingApiBase ? { api_base: setting.embeddingApiBase } : {}),
        ...(setting.embeddingApiKey ? { api_key: setting.embeddingApiKey } : {}),
        ...(setting.embeddingDimension ? { dimension: Number(setting.embeddingDimension) } : {}),
      },
    };
  }

  const codebaseEngineCommand =
    setting.codebaseEngineProvider === "codegraph" ? setting.codebaseEngineCommand : "";

  config.codebase_engine = {
    provider: setting.codebaseEngineProvider,
    index_strategy: setting.codebaseEngineIndexStrategy,
    sync_mode: setting.codebaseEngineSyncMode,
    workspace: setting.codebaseEngineWorkspace,
    ignore_globs: setting.codebaseEngineIgnoreGlobs.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    ...(setting.codebaseEngineEndpoint ? { endpoint: setting.codebaseEngineEndpoint } : {}),
    ...(setting.codebaseEngineMcpEndpoint ? { mcp_endpoint: setting.codebaseEngineMcpEndpoint } : {}),
    ...(codebaseEngineCommand ? { command: codebaseEngineCommand } : {}),
    ...(setting.codebaseEngineApiKey ? { api_key: setting.codebaseEngineApiKey } : {}),
  };

  return config;
}

export function buildKnowledgeEngineCliConfig(setting = getKnowledgeBaseSettings()): KnowledgeEngineClientConfig {
  return {
    url: setting.baseUrl,
    timeout: Number(setting.timeoutSeconds),
    ...(setting.apiKey ? { api_key: setting.apiKey } : {}),
    ...(setting.account ? { account: setting.account } : {}),
    ...(setting.user ? { user: setting.user } : {}),
    ...(setting.agentId ? { agent_id: setting.agentId } : {}),
    codebase_engine: {
      provider: setting.codebaseEngineProvider,
      index_strategy: setting.codebaseEngineIndexStrategy,
      sync_mode: setting.codebaseEngineSyncMode,
      ...(setting.codebaseEngineEndpoint ? { endpoint: setting.codebaseEngineEndpoint } : {}),
      ...(setting.codebaseEngineMcpEndpoint ? { mcp_endpoint: setting.codebaseEngineMcpEndpoint } : {}),
      ...(setting.codebaseEngineProvider === "codegraph" && setting.codebaseEngineCommand
        ? { command: setting.codebaseEngineCommand }
        : {}),
    },
  };
}

export function writeKnowledgeEngineConfigFiles(setting = getKnowledgeBaseSettings()) {
  const { configPath, cliConfigPath } = getKnowledgeEngineRuntimePaths(setting);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.mkdirSync(path.dirname(cliConfigPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(buildKnowledgeEngineServerConfig(setting), null, 2)}\n`);
  fs.writeFileSync(cliConfigPath, `${JSON.stringify(buildKnowledgeEngineCliConfig(setting), null, 2)}\n`);
  return { configPath, cliConfigPath };
}
