import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  getKnowledgeBaseSettings,
  writeOpenVikingConfigFiles,
} from "@/server/knowledge-base-settings";

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

function thirdpartyBinDir() {
  return path.join("thirdparty", "openviking", "bin");
}

export function resolveOpenVikingBaseUrl() {
  return getKnowledgeBaseSettings().baseUrl.replace(/\/+$/, "");
}

export function resolveOpenVikingHost() {
  return getKnowledgeBaseSettings().host;
}

export function resolveOpenVikingPort() {
  return getKnowledgeBaseSettings().port;
}

export function resolveOpenVikingConfigPath() {
  return path.resolve(/* turbopackIgnore: true */ getKnowledgeBaseSettings().configPath);
}

export function resolveOpenVikingCliConfigPath() {
  return path.resolve(/* turbopackIgnore: true */ getKnowledgeBaseSettings().cliConfigPath);
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
  const setting = getKnowledgeBaseSettings();
  const candidates = [
    setting.serverBin,
    path.join(thirdpartyBinDir(), `openviking-server-${process.platform}-${process.arch}`),
    path.join(thirdpartyBinDir(), "openviking-server"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const resolved = path.resolve(/* turbopackIgnore: true */ candidate);
    if (fs.existsSync(/* turbopackIgnore: true */ resolved)) return resolved;
  }

  return null;
}

export function ensureOpenVikingConfigFiles() {
  fs.mkdirSync(thirdpartyBinDir(), { recursive: true });
  return writeOpenVikingConfigFiles();
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
  const setting = getKnowledgeBaseSettings();
  return (
    !setting.enabled ||
    !setting.autoStart ||
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
      `OpenViking server binary missing. Put it at thirdparty/openviking/bin/openviking-server-${process.platform}-${process.arch} or set OPENVIKING_SERVER_BIN.`;
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
