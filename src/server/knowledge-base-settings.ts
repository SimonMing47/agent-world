import fs from "node:fs";
import path from "node:path";
import { execute, queryOne, type SystemSetting } from "@/server/db";

export const KNOWLEDGE_BASE_SETTINGS_KEY = "knowledge-base";
export const DEFAULT_OPENVIKING_BASE_URL = "http://127.0.0.1:1933";
const FALLBACK_OPENVIKING_DEFAULT_EMBEDDING_PROVIDER = "local";
const FALLBACK_OPENVIKING_DEFAULT_EMBEDDING_MODEL = "";
const FALLBACK_OPENVIKING_DEFAULT_EMBEDDING_DIMENSION = "";

export type KnowledgeBaseProvider = "openviking";

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
};

type OpenVikingServerConfig = Record<string, unknown>;
type OpenVikingCliConfig = Record<string, unknown>;

export type OpenVikingModelDefaults = {
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

export type KnowledgeFoundationStatus = {
  state: KnowledgeFoundationState;
  label: string;
  detail: string;
  provider: string;
  model: string;
  canWriteVlmConfig: boolean;
};

function dataDir() {
  return path.join("data", "openviking");
}

function modelDefaultsPath() {
  return process.env.OPENVIKING_MODEL_DEFAULTS_FILE ?? path.join(dataDir(), "model-defaults.json");
}

function readString(source: Record<string, unknown>, key: string, fallback = "") {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function getOpenVikingModelDefaults(): OpenVikingModelDefaults {
  const fallback: OpenVikingModelDefaults = {
    contentUnderstanding: {
      providerProfileId: "",
      provider: "",
      model: "",
      apiBase: "",
    },
    embedding: {
      providerProfileId: "",
      provider: FALLBACK_OPENVIKING_DEFAULT_EMBEDDING_PROVIDER,
      model: FALLBACK_OPENVIKING_DEFAULT_EMBEDDING_MODEL,
      apiBase: "",
      dimension: FALLBACK_OPENVIKING_DEFAULT_EMBEDDING_DIMENSION,
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
  const modelDefaults = getOpenVikingModelDefaults();
  return {
    provider: "openviking",
    enabled: true,
    autoStart: process.env.AGENTWORLD_OPENVIKING_AUTO_START !== "0",
    baseUrl: (process.env.OPENVIKING_BASE_URL ?? DEFAULT_OPENVIKING_BASE_URL).replace(/\/+$/, ""),
    host: process.env.OPENVIKING_HOST ?? "127.0.0.1",
    port: String(process.env.OPENVIKING_PORT ?? "1933"),
    serverBin: process.env.OPENVIKING_SERVER_BIN ?? path.join("thirdparty", "openviking", "bin", "openviking-server"),
    configPath: process.env.OPENVIKING_CONFIG_FILE ?? path.join(dataDir(), "ov.conf"),
    cliConfigPath: process.env.OPENVIKING_CLI_CONFIG_FILE ?? path.join(dataDir(), "ovcli.conf"),
    timeoutSeconds: String(process.env.OPENVIKING_TIMEOUT_SECONDS ?? "60"),
    apiKey: process.env.OPENVIKING_API_KEY ?? "",
    account: process.env.OPENVIKING_ACCOUNT ?? "",
    user: process.env.OPENVIKING_USER ?? "",
    agentId: process.env.OPENVIKING_AGENT_ID ?? "",
    corsOrigins: defaultCorsOrigins(),
    storageWorkspace: path.join(dataDir(), "workspace"),
    agfsBackend: "local",
    vectorDbBackend: "local",
    taskTrackerBackend: "persistent",
    lockTimeoutSeconds: "5",
    lockExpireSeconds: "300",
    logLevel: process.env.OPENVIKING_LOG_LEVEL ?? "INFO",
    vlmProviderProfileId: modelDefaults.contentUnderstanding.providerProfileId,
    vlmProvider: process.env.OPENVIKING_VLM_PROVIDER ?? modelDefaults.contentUnderstanding.provider,
    vlmModel: process.env.OPENVIKING_VLM_MODEL ?? modelDefaults.contentUnderstanding.model,
    vlmApiBase: process.env.OPENVIKING_VLM_API_BASE ?? modelDefaults.contentUnderstanding.apiBase,
    vlmApiKey: process.env.OPENVIKING_VLM_API_KEY ?? "",
    embeddingProviderProfileId: modelDefaults.embedding.providerProfileId,
    embeddingProvider: process.env.OPENVIKING_EMBEDDING_PROVIDER ?? modelDefaults.embedding.provider,
    embeddingModel: process.env.OPENVIKING_EMBEDDING_MODEL ?? modelDefaults.embedding.model,
    embeddingApiBase: process.env.OPENVIKING_EMBEDDING_API_BASE ?? modelDefaults.embedding.apiBase,
    embeddingApiKey: process.env.OPENVIKING_EMBEDDING_API_KEY ?? "",
    embeddingDimension: process.env.OPENVIKING_EMBEDDING_DIMENSION ?? modelDefaults.embedding.dimension,
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

function normalizeUrl(value: string, fallback: string) {
  const nextValue = value.trim() || fallback;
  try {
    return new URL(nextValue).toString().replace(/\/+$/, "");
  } catch {
    throw new Error("OpenViking Base URL 格式不正确");
  }
}

function normalizePositiveNumberText(value: string, fallback: string, label: string) {
  const nextValue = value.trim() || fallback;
  const numeric = Number(nextValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`${label} 必须是大于 0 的数字`);
  }
  return String(nextValue);
}

function normalizeOptionalPositiveNumberText(value: string, label: string) {
  const nextValue = value.trim();
  if (!nextValue) return "";
  const numeric = Number(nextValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`${label} 必须是大于 0 的数字`);
  }
  return nextValue;
}

function normalizePort(value: string, fallback: string) {
  const nextValue = normalizePositiveNumberText(value, fallback, "OpenViking Port");
  const numeric = Number(nextValue);
  if (numeric > 65535) throw new Error("OpenViking Port 不能大于 65535");
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
    throw new Error(`${label} 不再支持 env: 环境变量引用，请直接保存配置值。`);
  }
}

function normalizeSettings(input: Partial<KnowledgeBaseSettings>, current: KnowledgeBaseSettings) {
  const baseUrl = normalizeUrl(input.baseUrl ?? current.baseUrl, current.baseUrl);
  const port = normalizePort(input.port ?? current.port, current.port);
  const timeoutSeconds = normalizePositiveNumberText(
    input.timeoutSeconds ?? current.timeoutSeconds,
    current.timeoutSeconds,
    "OpenViking Timeout",
  );
  const lockTimeoutSeconds = normalizePositiveNumberText(
    input.lockTimeoutSeconds ?? current.lockTimeoutSeconds,
    current.lockTimeoutSeconds,
    "OpenViking lock timeout",
  );
  const lockExpireSeconds = normalizePositiveNumberText(
    input.lockExpireSeconds ?? current.lockExpireSeconds,
    current.lockExpireSeconds,
    "OpenViking lock expire",
  );
  const embeddingDimension = normalizeOptionalPositiveNumberText(
    input.embeddingDimension ?? current.embeddingDimension,
    "OpenViking embedding dimension",
  );
  const embeddingProvider =
    (input.embeddingProvider ?? current.embeddingProvider).trim() || getOpenVikingModelDefaults().embedding.provider;
  const embeddingModel =
    (input.embeddingModel ?? current.embeddingModel).trim()
    || (embeddingProvider === getOpenVikingModelDefaults().embedding.provider ? getOpenVikingModelDefaults().embedding.model : "");
  const effectiveEmbeddingDimension =
    embeddingDimension
    || (
      embeddingProvider === getOpenVikingModelDefaults().embedding.provider
      && embeddingModel === getOpenVikingModelDefaults().embedding.model
        ? getOpenVikingModelDefaults().embedding.dimension
        : ""
    );
  const apiKey = (input.apiKey ?? current.apiKey).trim();
  const vlmApiKey = (input.vlmApiKey ?? current.vlmApiKey).trim();
  const embeddingApiKey = (input.embeddingApiKey ?? current.embeddingApiKey).trim();

  assertNoEnvSecretReference(apiKey, "OpenViking Root API Key");
  assertNoEnvSecretReference(vlmApiKey, "OpenViking VLM API Key");
  assertNoEnvSecretReference(embeddingApiKey, "OpenViking Embedding API Key");

  return {
    provider: "openviking",
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
  } satisfies KnowledgeBaseSettings;
}

export function canWriteOpenVikingVlmConfig(setting: KnowledgeBaseSettings) {
  if (!setting.vlmProvider || !setting.vlmModel) return false;
  if (setting.vlmApiKey) return true;
  const provider = setting.vlmProvider.toLowerCase();
  const model = setting.vlmModel.toLowerCase();
  return provider === "openai-codex" || (provider === "litellm" && model.startsWith("ollama/"));
}

export function getKnowledgeFoundationStatus(setting = getKnowledgeBaseSettings()): KnowledgeFoundationStatus {
  const canWriteVlmConfig = canWriteOpenVikingVlmConfig(setting);
  if (!setting.vlmProvider || !setting.vlmModel) {
    return {
      state: "missing_model",
      label: "未配置",
      detail: "尚未选择内容理解模型，知识底座只能使用原文和检索索引。",
      provider: setting.vlmProvider,
      model: setting.vlmModel,
      canWriteVlmConfig,
    };
  }
  if (!canWriteVlmConfig) {
    return {
      state: "pending_api_key",
      label: "待补 API Key",
      detail: "内容理解模型已经选定，但缺少可直接保存的 API Key；OpenViking 暂不会写入 VLM 配置。",
      provider: setting.vlmProvider,
      model: setting.vlmModel,
      canWriteVlmConfig,
    };
  }
  return {
    state: "enabled",
    label: "已启用",
    detail: "内容理解模型会作为 OpenViking L0 摘要、L1 概览和多层语义结构的知识底座。",
    provider: setting.vlmProvider,
    model: setting.vlmModel,
    canWriteVlmConfig,
  };
}

export function getKnowledgeBaseConfigWarnings(setting = getKnowledgeBaseSettings()) {
  const foundation = getKnowledgeFoundationStatus(setting);
  if (foundation.state === "enabled") return [];
  return [`内容理解知识底座${foundation.label}：${foundation.detail}`];
}

export function getKnowledgeBaseSettings() {
  const defaults = defaultSettings();
  const row = queryOne<SystemSetting>("SELECT * FROM system_settings WHERE key = ?", KNOWLEDGE_BASE_SETTINGS_KEY);
  const parsed = parseJsonRecord(row?.valueJson);

  return {
    provider: "openviking",
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

export function getOpenVikingRuntimePaths(setting = getKnowledgeBaseSettings()) {
  return {
    configPath: path.resolve(/* turbopackIgnore: true */ setting.configPath),
    cliConfigPath: path.resolve(/* turbopackIgnore: true */ setting.cliConfigPath),
    serverBin: path.resolve(/* turbopackIgnore: true */ setting.serverBin),
  };
}

export function buildOpenVikingServerConfig(setting = getKnowledgeBaseSettings()): OpenVikingServerConfig {
  const server: Record<string, unknown> = {
    host: setting.host,
    port: Number(setting.port),
    cors_origins: setting.corsOrigins.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
  };
  if (setting.apiKey) server.root_api_key = setting.apiKey;

  const config: OpenVikingServerConfig = {
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

  if (canWriteOpenVikingVlmConfig(setting)) {
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

  return config;
}

export function buildOpenVikingCliConfig(setting = getKnowledgeBaseSettings()): OpenVikingCliConfig {
  return {
    url: setting.baseUrl,
    timeout: Number(setting.timeoutSeconds),
    ...(setting.apiKey ? { api_key: setting.apiKey } : {}),
    ...(setting.account ? { account: setting.account } : {}),
    ...(setting.user ? { user: setting.user } : {}),
    ...(setting.agentId ? { agent_id: setting.agentId } : {}),
  };
}

export function writeOpenVikingConfigFiles(setting = getKnowledgeBaseSettings()) {
  const { configPath, cliConfigPath } = getOpenVikingRuntimePaths(setting);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.mkdirSync(path.dirname(cliConfigPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(buildOpenVikingServerConfig(setting), null, 2)}\n`);
  fs.writeFileSync(cliConfigPath, `${JSON.stringify(buildOpenVikingCliConfig(setting), null, 2)}\n`);
  return { configPath, cliConfigPath };
}
