import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const root = process.cwd();
export const thirdpartyDir = path.join(root, "thirdparty", "openviking");
export const thirdpartyBinDir = path.join(thirdpartyDir, "bin");
export const venvDir = path.join(root, ".venv-openviking");
export const configDir = path.join(root, "data", "openviking");
export const defaultServerBin = path.join(thirdpartyBinDir, "openviking-server");
export const currentPlatformServerBin = path.join(
  thirdpartyBinDir,
  `openviking-server-${process.platform}-${process.arch}`,
);
export const defaultServerConfig = path.join(configDir, "ov.conf");
export const defaultCliConfig = path.join(configDir, "ovcli.conf");

const bundledLinuxOpenVikingMinGlibc = "2.35";

function parseVersion(value) {
  const match = String(value ?? "").match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? "0")];
}

function compareVersions(left, right) {
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

function isBundledOpenVikingBinary(binaryPath) {
  const resolved = path.resolve(binaryPath);
  const resolvedBinDir = path.resolve(thirdpartyBinDir);
  return resolved === path.join(resolvedBinDir, "openviking-server") || resolved.startsWith(`${resolvedBinDir}${path.sep}openviking-server-`);
}

export function getOpenVikingBinaryCompatibility(binaryPath) {
  if (process.platform !== "linux" || process.env.OPENVIKING_SKIP_GLIBC_CHECK === "1") {
    return { compatible: true, reason: null };
  }
  if (!isBundledOpenVikingBinary(binaryPath)) {
    return { compatible: true, reason: null };
  }

  const required = parseVersion(process.env.OPENVIKING_MIN_GLIBC_VERSION ?? bundledLinuxOpenVikingMinGlibc);
  const current = detectHostGlibcVersion();
  if (!required || !current || compareVersions(current, required) >= 0) {
    return { compatible: true, reason: null };
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

export function platformServerBin(platform = process.platform, arch = process.arch) {
  return path.join(thirdpartyBinDir, `openviking-server-${platform}-${arch}`);
}

export function platformServerArchive(platform = process.platform, arch = process.arch) {
  return `${platformServerBin(platform, arch)}.xz`;
}

function platformServerArchiveParts(platform = process.platform, arch = process.arch) {
  const archive = platformServerArchive(platform, arch);
  const dir = path.dirname(archive);
  const prefix = `${path.basename(archive)}.part-`;
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(prefix))
    .sort()
    .map((name) => path.join(dir, name));
}

function concatenateParts(parts, outputPath) {
  const fd = fs.openSync(outputPath, "w");
  try {
    for (const part of parts) {
      fs.writeSync(fd, fs.readFileSync(part));
    }
  } finally {
    fs.closeSync(fd);
  }
}

function extractXz(archivePath, outputPath) {
  const tempOutput = `${outputPath}.tmp-${process.pid}`;
  const fd = fs.openSync(tempOutput, "w", 0o755);
  let extracted = false;
  try {
    const result = spawnSync("xz", ["-dc", archivePath], {
      cwd: root,
      stdio: ["ignore", fd, "inherit"],
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`xz exited with status ${result.status}`);
    }
    extracted = true;
  } finally {
    fs.closeSync(fd);
    if (!extracted) fs.rmSync(tempOutput, { force: true });
  }
  fs.renameSync(tempOutput, outputPath);
  fs.chmodSync(outputPath, 0o755);
}

export function ensurePlatformServerBin(platform = process.platform, arch = process.arch) {
  const outputPath = platformServerBin(platform, arch);
  if (fs.existsSync(outputPath)) return outputPath;

  const archivePath = platformServerArchive(platform, arch);
  const parts = platformServerArchiveParts(platform, arch);
  const tempArchivePath = `${archivePath}.tmp-${process.pid}`;
  const sourceArchivePath = fs.existsSync(archivePath) ? archivePath : parts.length > 0 ? tempArchivePath : null;
  if (!sourceArchivePath) return null;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  try {
    if (parts.length > 0 && !fs.existsSync(archivePath)) {
      concatenateParts(parts, tempArchivePath);
    }
    extractXz(sourceArchivePath, outputPath);
    return outputPath;
  } finally {
    fs.rmSync(tempArchivePath, { force: true });
  }
}

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

export function resolveServerBin() {
  const candidates = [process.env.OPENVIKING_SERVER_BIN].filter(Boolean);
  const extractedPlatformBin = ensurePlatformServerBin();
  if (extractedPlatformBin) candidates.push(extractedPlatformBin);
  candidates.push(currentPlatformServerBin, defaultServerBin);

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
