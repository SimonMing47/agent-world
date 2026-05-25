import fs from "node:fs";
import path from "node:path";

export const root = process.cwd();
export const thirdpartyDir = path.join(root, "thirdparty", "openviking");
export const thirdpartyBinDir = path.join(thirdpartyDir, "bin");
export const venvDir = path.join(root, ".venv-openviking");
export const configDir = path.join(root, "data", "openviking");
export const defaultServerBin = path.join(thirdpartyBinDir, "openviking-server");
export const defaultServerConfig = path.join(configDir, "ov.conf");
export const defaultCliConfig = path.join(configDir, "ovcli.conf");

export function resolveServerConfigPath() {
  return path.resolve(process.env.OPENVIKING_CONFIG_FILE ?? defaultServerConfig);
}

export function resolveCliConfigPath() {
  return path.resolve(process.env.OPENVIKING_CLI_CONFIG_FILE ?? defaultCliConfig);
}

export function resolveBaseUrl() {
  return (process.env.OPENVIKING_BASE_URL ?? "http://127.0.0.1:1933").replace(/\/+$/, "");
}

export function resolveHost() {
  return process.env.OPENVIKING_HOST ?? "127.0.0.1";
}

export function resolvePort() {
  return String(process.env.OPENVIKING_PORT ?? "1933");
}

export function resolveServerBin(options = {}) {
  const allowVenvFallback = options.allowVenvFallback ?? true;
  const candidates = [
    process.env.OPENVIKING_SERVER_BIN,
    defaultServerBin,
    path.join(thirdpartyBinDir, `openviking-server-${process.platform}-${process.arch}`),
    allowVenvFallback ? path.join(venvDir, "bin", "openviking-server") : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) return resolved;
  }

  return null;
}

export function ensureOpenVikingDirs() {
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(thirdpartyBinDir, { recursive: true });
}

export function buildServerConfig() {
  const apiKey = process.env.OPENVIKING_API_KEY;
  const server = {
    host: resolveHost(),
    port: Number(resolvePort()),
    cors_origins: [
      process.env.AGENTWORLD_PUBLIC_BASE_URL ?? "http://localhost:7369",
      "http://127.0.0.1:7369",
      "http://localhost:7369",
    ],
  };
  if (apiKey) {
    server.root_api_key = apiKey;
  }

  const config = {
    server,
    storage: {
      workspace: path.join(configDir, "workspace"),
      agfs: { backend: "local" },
      vectordb: { backend: "local" },
      transaction: {
        lock_timeout: 5,
        lock_expire: 300,
      },
    },
    log: {
      level: process.env.OPENVIKING_LOG_LEVEL ?? "INFO",
      output: "stdout",
    },
  };

  const vlmProvider = process.env.OPENVIKING_VLM_PROVIDER;
  const vlmModel = process.env.OPENVIKING_VLM_MODEL;
  if (vlmProvider && vlmModel) {
    config.vlm = {
      provider: vlmProvider,
      model: vlmModel,
    };
    if (process.env.OPENVIKING_VLM_API_BASE) {
      config.vlm.api_base = process.env.OPENVIKING_VLM_API_BASE;
    }
    if (process.env.OPENVIKING_VLM_API_KEY) {
      config.vlm.api_key = process.env.OPENVIKING_VLM_API_KEY;
    }
  }

  const embeddingProvider = process.env.OPENVIKING_EMBEDDING_PROVIDER;
  const embeddingModel = process.env.OPENVIKING_EMBEDDING_MODEL;
  if (embeddingProvider && embeddingModel) {
    config.embedding = {
      dense: {
        provider: embeddingProvider,
        model: embeddingModel,
      },
    };
    if (process.env.OPENVIKING_EMBEDDING_API_BASE) {
      config.embedding.dense.api_base = process.env.OPENVIKING_EMBEDDING_API_BASE;
    }
    if (process.env.OPENVIKING_EMBEDDING_API_KEY) {
      config.embedding.dense.api_key = process.env.OPENVIKING_EMBEDDING_API_KEY;
    }
    if (process.env.OPENVIKING_EMBEDDING_DIMENSION) {
      config.embedding.dense.dimension = Number(process.env.OPENVIKING_EMBEDDING_DIMENSION);
    }
  }

  return config;
}

export function writeServerConfig(options = {}) {
  ensureOpenVikingDirs();
  const configPath = resolveServerConfigPath();
  const force = options.force ?? false;
  if (!force && fs.existsSync(configPath)) return configPath;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(buildServerConfig(), null, 2)}\n`);
  return configPath;
}

export function buildCliConfig() {
  const config = {
    url: resolveBaseUrl(),
    timeout: Number(process.env.OPENVIKING_TIMEOUT_SECONDS ?? "60"),
  };
  if (process.env.OPENVIKING_API_KEY) {
    config.api_key = process.env.OPENVIKING_API_KEY;
  }
  if (process.env.OPENVIKING_ACCOUNT) {
    config.account = process.env.OPENVIKING_ACCOUNT;
  }
  if (process.env.OPENVIKING_USER) {
    config.user = process.env.OPENVIKING_USER;
  }
  if (process.env.OPENVIKING_AGENT_ID) {
    config.agent_id = process.env.OPENVIKING_AGENT_ID;
  }
  return config;
}

export function writeCliConfig(options = {}) {
  ensureOpenVikingDirs();
  const cliConfigPath = resolveCliConfigPath();
  const force = options.force ?? false;
  if (!force && fs.existsSync(cliConfigPath)) return cliConfigPath;
  fs.mkdirSync(path.dirname(cliConfigPath), { recursive: true });
  fs.writeFileSync(cliConfigPath, `${JSON.stringify(buildCliConfig(), null, 2)}\n`);
  return cliConfigPath;
}
