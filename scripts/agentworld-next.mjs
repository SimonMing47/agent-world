import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  resolveBaseUrl,
  resolveHost,
  resolvePort,
  resolveServerBin,
  root,
  writeCliConfig,
  writeServerConfig,
} from "./openviking-common.mjs";

const mode = process.argv[2] ?? "dev";
const defaultAgentWorldPort = "7369";
const startupTimeoutMs = Number(process.env.OPENVIKING_STARTUP_TIMEOUT_MS ?? "3500");
const experimentalWarningOption = "--no-warnings=ExperimentalWarning";

function isLocalBaseUrl(value) {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "::1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return true;
  }
}

async function checkHealth(baseUrl, timeoutMs = 900) {
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

async function waitForOpenViking(baseUrl) {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (await checkHealth(baseUrl, 700)) return true;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return false;
}

async function startOpenVikingIfNeeded() {
  if (process.env.AGENTWORLD_OPENVIKING_AUTO_START === "0") {
    return null;
  }

  const baseUrl = resolveBaseUrl();
  if (await checkHealth(baseUrl)) {
    console.log(`[agentworld] OpenViking already healthy at ${baseUrl}`);
    return null;
  }

  if (!isLocalBaseUrl(baseUrl)) {
    console.warn(`[agentworld] Remote OpenViking is not reachable: ${baseUrl}`);
    return null;
  }

  const binary = resolveServerBin({ allowVenvFallback: mode !== "start" });
  if (!binary) {
    console.warn(
      "[agentworld] OpenViking server binary missing. Put it at thirdparty/openviking/bin/openviking-server or run pnpm openviking:install for local development.",
    );
    return null;
  }

  const configPath = writeServerConfig();
  writeCliConfig();

  console.log(`[agentworld] Starting OpenViking: ${binary}`);
  const child = spawn(
    binary,
    ["--config", configPath, "--host", resolveHost(), "--port", resolvePort()],
    {
      cwd: root,
      env: {
        ...process.env,
        OPENVIKING_CONFIG_FILE: configPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) console.log(`[openviking] ${text}`);
  });
  child.stderr.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) console.warn(`[openviking] ${text}`);
  });

  child.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      console.warn(`[agentworld] OpenViking exited with code=${code ?? "null"} signal=${signal ?? "null"}`);
    }
  });

  const healthy = await waitForOpenViking(baseUrl);
  if (healthy) {
    console.log(`[agentworld] OpenViking healthy at ${baseUrl}`);
  } else {
    console.warn("[agentworld] OpenViking started but health check is still warming up.");
  }

  return child;
}

function nextCommand() {
  return path.join(root, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
}

function nodeOptions() {
  const existing = process.env.NODE_OPTIONS ?? "";
  return existing.includes(experimentalWarningOption)
    ? existing
    : [existing, experimentalWarningOption].filter(Boolean).join(" ");
}

function nextLaunch() {
  const standaloneServer = path.join(root, ".next", "standalone", "server.js");
  if (mode === "start" && fs.existsSync(standaloneServer)) {
    ensureStandaloneAssets();
    return {
      command: process.execPath,
      args: [standaloneServer],
    };
  }

  return {
    command: nextCommand(),
    args: mode === "start" ? ["start"] : ["dev"],
  };
}

function copyIfExists(source, target) {
  if (!fs.existsSync(source)) return;

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
}

function ensureStandaloneAssets() {
  copyIfExists(
    path.join(root, ".next", "server", "chunks"),
    path.join(root, ".next", "standalone", ".next", "server", "chunks"),
  );
  copyIfExists(
    path.join(root, ".next", "static"),
    path.join(root, ".next", "standalone", ".next", "static"),
  );
  copyIfExists(
    path.join(root, "public"),
    path.join(root, ".next", "standalone", "public"),
  );
}

const openVikingChild = await startOpenVikingIfNeeded();
const launch = nextLaunch();
const nextChild = spawn(launch.command, launch.args, {
  cwd: root,
  env: {
    ...process.env,
    PORT: process.env.PORT ?? defaultAgentWorldPort,
    AGENTWORLD_DATA_DIR: process.env.AGENTWORLD_DATA_DIR ?? path.join(root, "data"),
    NODE_OPTIONS: nodeOptions(),
  },
  stdio: "inherit",
});

function shutdown(signal) {
  if (openVikingChild && !openVikingChild.killed) {
    openVikingChild.kill("SIGTERM");
  }
  if (!nextChild.killed) {
    nextChild.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal));
}

nextChild.on("exit", (code, signal) => {
  if (openVikingChild && !openVikingChild.killed) {
    openVikingChild.kill("SIGTERM");
  }
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
