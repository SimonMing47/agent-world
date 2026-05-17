import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_BASE_URL = "http://127.0.0.1:1933";
const STARTUP_TIMEOUT_MS = 3500;

type OpenVikingProcessState = {
  child: ChildProcessWithoutNullStreams | null;
  status: "idle" | "healthy" | "starting" | "started" | "missing_binary" | "remote" | "disabled" | "failed";
  startedAt: string | null;
  baseUrl: string;
  binaryPath: string | null;
  configPath: string;
  lastError: string | null;
  logs: string[];
};

const globalState = globalThis as typeof globalThis & {
  __agentWorldOpenViking?: OpenVikingProcessState;
};

function dataDir() {
  return path.join("data", "openviking");
}

function thirdpartyBinDir() {
  return path.join("thirdparty", "openviking", "bin");
}

export function resolveOpenVikingBaseUrl() {
  return (process.env.OPENVIKING_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export function resolveOpenVikingHost() {
  return process.env.OPENVIKING_HOST ?? "127.0.0.1";
}

export function resolveOpenVikingPort() {
  return String(process.env.OPENVIKING_PORT ?? "1933");
}

export function resolveOpenVikingConfigPath() {
  return path.resolve(/* turbopackIgnore: true */ process.env.OPENVIKING_CONFIG_FILE ?? path.join(dataDir(), "ov.conf"));
}

export function resolveOpenVikingCliConfigPath() {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.OPENVIKING_CLI_CONFIG_FILE ?? path.join(dataDir(), "ovcli.conf"),
  );
}

function appendLog(state: OpenVikingProcessState, message: string) {
  state.logs = [...state.logs.slice(-40), `${new Date().toISOString()} ${message}`];
}

function initialState(): OpenVikingProcessState {
  return {
    child: null,
    status: "idle",
    startedAt: null,
    baseUrl: resolveOpenVikingBaseUrl(),
    binaryPath: null,
    configPath: resolveOpenVikingConfigPath(),
    lastError: null,
    logs: [],
  };
}

function state() {
  globalState.__agentWorldOpenViking ??= initialState();
  return globalState.__agentWorldOpenViking;
}

function isLocalBaseUrl(value: string) {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "::1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return true;
  }
}

function resolveOpenVikingServerBin() {
  const candidates = [
    process.env.OPENVIKING_SERVER_BIN,
    path.join(thirdpartyBinDir(), "openviking-server"),
    path.join(thirdpartyBinDir(), `openviking-server-${process.platform}-${process.arch}`),
    path.join(".venv-openviking", "bin", "openviking-server"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const resolved = path.resolve(/* turbopackIgnore: true */ candidate);
    if (fs.existsSync(/* turbopackIgnore: true */ resolved)) return resolved;
  }

  return null;
}

function buildServerConfig() {
  const config: Record<string, unknown> = {
    server: {
      host: resolveOpenVikingHost(),
      port: Number(resolveOpenVikingPort()),
      cors_origins: [
        process.env.AGENTWORLD_PUBLIC_BASE_URL ?? "http://localhost:7369",
        "http://127.0.0.1:7369",
        "http://localhost:7369",
      ],
      ...(process.env.OPENVIKING_API_KEY ? { root_api_key: process.env.OPENVIKING_API_KEY } : {}),
    },
    storage: {
      workspace: path.join(dataDir(), "workspace"),
      agfs: { backend: "local" },
      vectordb: { backend: "local" },
      transaction: {
        lock_timeout: 5,
        lock_expire: 300,
      },
      task_tracker: { backend: "persistent" },
    },
    log: {
      level: process.env.OPENVIKING_LOG_LEVEL ?? "INFO",
      output: "stdout",
    },
  };

  if (process.env.OPENVIKING_VLM_PROVIDER && process.env.OPENVIKING_VLM_MODEL) {
    config.vlm = {
      provider: process.env.OPENVIKING_VLM_PROVIDER,
      model: process.env.OPENVIKING_VLM_MODEL,
      ...(process.env.OPENVIKING_VLM_API_BASE ? { api_base: process.env.OPENVIKING_VLM_API_BASE } : {}),
      ...(process.env.OPENVIKING_VLM_API_KEY ? { api_key: process.env.OPENVIKING_VLM_API_KEY } : {}),
    };
  }

  if (process.env.OPENVIKING_EMBEDDING_PROVIDER && process.env.OPENVIKING_EMBEDDING_MODEL) {
    config.embedding = {
      dense: {
        provider: process.env.OPENVIKING_EMBEDDING_PROVIDER,
        model: process.env.OPENVIKING_EMBEDDING_MODEL,
        ...(process.env.OPENVIKING_EMBEDDING_API_BASE ? { api_base: process.env.OPENVIKING_EMBEDDING_API_BASE } : {}),
        ...(process.env.OPENVIKING_EMBEDDING_API_KEY ? { api_key: process.env.OPENVIKING_EMBEDDING_API_KEY } : {}),
        ...(process.env.OPENVIKING_EMBEDDING_DIMENSION
          ? { dimension: Number(process.env.OPENVIKING_EMBEDDING_DIMENSION) }
          : {}),
      },
    };
  }

  return config;
}

export function ensureOpenVikingConfigFiles() {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.mkdirSync(thirdpartyBinDir(), { recursive: true });

  const configPath = resolveOpenVikingConfigPath();
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify(buildServerConfig(), null, 2)}\n`);
  }

  const cliConfigPath = resolveOpenVikingCliConfigPath();
  if (!fs.existsSync(cliConfigPath)) {
    fs.mkdirSync(path.dirname(cliConfigPath), { recursive: true });
    fs.writeFileSync(
      cliConfigPath,
      `${JSON.stringify(
        {
          url: resolveOpenVikingBaseUrl(),
          timeout: Number(process.env.OPENVIKING_TIMEOUT_SECONDS ?? "60"),
          ...(process.env.OPENVIKING_API_KEY ? { api_key: process.env.OPENVIKING_API_KEY } : {}),
          ...(process.env.OPENVIKING_ACCOUNT ? { account: process.env.OPENVIKING_ACCOUNT } : {}),
          ...(process.env.OPENVIKING_USER ? { user: process.env.OPENVIKING_USER } : {}),
        },
        null,
        2,
      )}\n`,
    );
  }

  return { configPath, cliConfigPath };
}

async function checkHealth(baseUrl: string, timeoutMs = 900) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function shouldSkipAutoStart() {
  return (
    process.env.AGENTWORLD_OPENVIKING_AUTO_START === "0" ||
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  );
}

export async function ensureOpenVikingServerStarted(reason = "agentworld-startup") {
  const current = state();
  current.baseUrl = resolveOpenVikingBaseUrl();
  current.configPath = resolveOpenVikingConfigPath();

  if (shouldSkipAutoStart()) {
    current.status = "disabled";
    appendLog(current, `auto start skipped: ${reason}`);
    return getOpenVikingProcessStatus();
  }

  if (await checkHealth(current.baseUrl)) {
    current.status = "healthy";
    current.lastError = null;
    appendLog(current, `healthy remote detected: ${current.baseUrl}`);
    return getOpenVikingProcessStatus();
  }

  if (!isLocalBaseUrl(current.baseUrl)) {
    current.status = "remote";
    current.lastError = `remote OpenViking is not reachable: ${current.baseUrl}`;
    appendLog(current, current.lastError);
    return getOpenVikingProcessStatus();
  }

  if (current.child && !current.child.killed) {
    current.status = "starting";
    return getOpenVikingProcessStatus();
  }

  ensureOpenVikingConfigFiles();
  const binaryPath = resolveOpenVikingServerBin();
  current.binaryPath = binaryPath;

  if (!binaryPath) {
    current.status = "missing_binary";
    current.lastError =
      "OpenViking server binary missing. Put it at thirdparty/openviking/bin/openviking-server or run pnpm openviking:install for local development.";
    appendLog(current, current.lastError);
    return getOpenVikingProcessStatus();
  }

  current.status = "starting";
  current.startedAt = new Date().toISOString();
  current.lastError = null;
  appendLog(current, `spawning ${binaryPath} for ${reason}`);

  const child = spawn(binaryPath, ["--config", current.configPath, "--host", resolveOpenVikingHost(), "--port", resolveOpenVikingPort()], {
    cwd: ".",
    env: {
      ...process.env,
      OPENVIKING_CONFIG_FILE: current.configPath,
    },
  });

  current.child = child;

  child.stdout.on("data", (chunk) => appendLog(current, `[stdout] ${String(chunk).trim()}`));
  child.stderr.on("data", (chunk) => appendLog(current, `[stderr] ${String(chunk).trim()}`));
  child.on("error", (error) => {
    current.status = "failed";
    current.lastError = error.message;
    appendLog(current, `[error] ${error.message}`);
  });
  child.on("exit", (code, signal) => {
    current.child = null;
    if (current.status !== "healthy") {
      current.status = "failed";
      current.lastError = `OpenViking exited with code ${code ?? "null"} signal ${signal ?? "null"}`;
    }
    appendLog(current, `[exit] code=${code ?? "null"} signal=${signal ?? "null"}`);
  });

  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await checkHealth(current.baseUrl, 700)) {
      current.status = "healthy";
      current.lastError = null;
      appendLog(current, "health check passed after spawn");
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  if (current.status === "starting") {
    current.status = "started";
    appendLog(current, "process started; health is still warming up");
  }

  return getOpenVikingProcessStatus();
}

export function getOpenVikingProcessStatus() {
  const current = state();
  return {
    status: current.status,
    startedAt: current.startedAt,
    baseUrl: current.baseUrl,
    binaryPath: current.binaryPath,
    configPath: current.configPath,
    pid: current.child?.pid ?? null,
    lastError: current.lastError,
    logs: current.logs.slice(-12),
  };
}
