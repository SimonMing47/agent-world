import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  getKnowledgeBaseSettings,
  writeOpenVikingConfigFiles,
} from "@/server/knowledge-base-settings";

const STARTUP_TIMEOUT_MS = 3500;

type OpenVikingProcessState = {
  child: ChildProcessWithoutNullStreams | null;
  status: "idle" | "healthy" | "starting" | "started" | "missing_binary" | "incompatible" | "remote" | "disabled" | "failed";
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

const BUNDLED_LINUX_OPENVIKING_MIN_GLIBC = "2.35";

function parseVersion(value: string | null | undefined) {
  const match = String(value ?? "").match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? "0")];
}

function compareVersions(left: number[], right: number[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const leftPart = left[index] ?? 0;
    const rightPart = right[index] ?? 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }
  return 0;
}

function detectHostGlibcVersion() {
  const getconf = spawnSync("getconf", ["GNU_LIBC_VERSION"], { encoding: "utf8" });
  const getconfVersion = parseVersion(getconf.stdout);
  if (getconfVersion) return getconfVersion;

  const ldd = spawnSync("ldd", ["--version"], { encoding: "utf8" });
  return parseVersion(`${ldd.stdout} ${ldd.stderr}`);
}

function isBundledOpenVikingBinary(binaryPath: string) {
  const resolved = path.resolve(/* turbopackIgnore: true */ binaryPath);
  const resolvedBinDir = path.resolve(/* turbopackIgnore: true */ thirdpartyBinDir());
  return (
    resolved === path.join(resolvedBinDir, "openviking-server") ||
    resolved.startsWith(`${resolvedBinDir}${path.sep}openviking-server-`)
  );
}

function getOpenVikingBinaryCompatibility(binaryPath: string) {
  if (process.platform !== "linux" || process.env.OPENVIKING_SKIP_GLIBC_CHECK === "1") {
    return { compatible: true, reason: null as string | null };
  }
  if (!isBundledOpenVikingBinary(binaryPath)) {
    return { compatible: true, reason: null as string | null };
  }

  const required = parseVersion(process.env.OPENVIKING_MIN_GLIBC_VERSION ?? BUNDLED_LINUX_OPENVIKING_MIN_GLIBC);
  const current = detectHostGlibcVersion();
  if (!required || !current || compareVersions(current, required) >= 0) {
    return { compatible: true, reason: null as string | null };
  }

  const requiredText = required.slice(0, 2).join(".");
  const currentText = current.slice(0, 2).join(".");
  return {
    compatible: false,
    reason:
      `Bundled OpenViking binary requires glibc >= ${requiredText}, but this host has glibc ${currentText}. ` +
      "Set OPENVIKING_SERVER_BIN to a binary built on a compatible Linux target, point OPENVIKING_BASE_URL at a remote OpenViking service, " +
      "or set AGENTWORLD_OPENVIKING_AUTO_START=0 to disable launcher-managed startup.",
  };
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

  const compatibility = getOpenVikingBinaryCompatibility(binaryPath);
  if (!compatibility.compatible) {
    current.status = "incompatible";
    current.lastError = compatibility.reason;
    appendLog(current, compatibility.reason ?? "OpenViking binary is incompatible with this host.");
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
