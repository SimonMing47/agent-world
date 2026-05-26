#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const packageJsonPath = path.join(root, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const minNodeMajor = 20;

const commands = new Set([
  "install",
  "upgrade",
  "doctor",
  "dev",
  "start",
  "build",
  "version",
  "help",
]);

function color(code, value) {
  if (!process.stdout.isTTY || process.env.NO_COLOR) return value;
  return `\u001b[${code}m${value}\u001b[0m`;
}

function info(message) {
  console.log(`${color("36", "[agentworld]")} ${message}`);
}

function fail(message, code = 1) {
  console.error(`${color("31", "[agentworld]")} ${message}`);
  process.exit(code);
}

function run(command, args, options = {}) {
  info(`$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: options.stdio ?? "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) fail(result.error.message);
  if (result.status !== 0) {
    fail(`${command} exited with status ${result.status ?? "unknown"}`);
  }
  return result;
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  if (result.error || result.status !== 0) return null;
  return result.stdout.trim();
}

function commandExists(command) {
  const checker = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  const result = spawnSync(checker, args, {
    stdio: "ignore",
    shell: process.platform !== "win32",
  });
  return result.status === 0;
}

function parseArgs(argv) {
  const [maybeCommand, ...rest] = argv;
  if (!maybeCommand) {
    return {
      command: "start",
      args: [],
      flags: new Set(),
    };
  }
  const command = commands.has(maybeCommand) ? maybeCommand : "help";
  const args = commands.has(maybeCommand) ? rest : argv;
  return {
    command,
    args,
    flags: new Set(args.filter((arg) => arg.startsWith("--"))),
  };
}

function ensureNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  if (!Number.isFinite(major) || major < minNodeMajor) {
    fail(`Node.js ${minNodeMajor}+ is required. Current version: ${process.version}`);
  }
}

function ensurePnpm() {
  if (commandExists("pnpm")) return;
  if (!commandExists("corepack")) {
    fail("pnpm is missing and corepack is not available. Install pnpm 9+ first.");
  }
  run("corepack", ["enable"]);
  run("corepack", ["prepare", "pnpm@latest", "--activate"]);
}

function pnpm(args, options = {}) {
  ensurePnpm();
  run("pnpm", args, options);
}

function isGitRepo() {
  return fs.existsSync(path.join(root, ".git"));
}

function git(args, options = {}) {
  if (!commandExists("git")) fail("git is required for this command.");
  run("git", args, options);
}

function gitOutput(args) {
  if (!commandExists("git")) return null;
  return capture("git", args);
}

function assertCleanWorktree() {
  const status = gitOutput(["status", "--porcelain"]);
  if (status === null) fail("Unable to read git worktree status.");
  if (status.trim()) {
    fail(
      [
        "Refusing to upgrade with a dirty git worktree.",
        "Commit, stash, or move local changes first, then run agentworld upgrade again.",
      ].join("\n"),
    );
  }
}

function hasOpenVikingRuntime() {
  const candidates = [
    process.env.OPENVIKING_SERVER_BIN,
    path.join(root, "thirdparty", "openviking", "bin", "openviking-server"),
    path.join(root, "thirdparty", "openviking", "bin", `openviking-server-${process.platform}-${process.arch}`),
  ].filter(Boolean);
  return candidates.some((candidate) => fs.existsSync(path.resolve(candidate)));
}

function ensureOpenViking(options) {
  if (options.skipOpenViking) return;

  pnpm(["openviking:prepare"]);
  pnpm(["openviking:cli-config"]);

  if (!hasOpenVikingRuntime()) {
    fail([
      "OpenViking runtime is missing.",
      "Offline installs do not download binaries.",
      "Place the vetted binary at thirdparty/openviking/bin/openviking-server, or set OPENVIKING_SERVER_BIN.",
      "Use --skip-openviking only when an internal OpenViking service is already configured.",
    ].join("\n"));
  }
}

function install(options = {}) {
  ensureNodeVersion();
  ensurePnpm();
  pnpm(["install"]);
  pnpm(["bootstrap"]);
  ensureOpenViking(options);
  if (options.build) pnpm(["build"]);
  doctor({ quiet: true });
  info("Install complete. Start with: agentworld start");
}

function upgrade(options = {}) {
  ensureNodeVersion();
  ensurePnpm();

  if (!isGitRepo()) {
    fail("agentworld upgrade requires a git checkout. Use scripts/install.sh with AGENTWORLD_REPO_URL pointing to your internal mirror.");
  }

  assertCleanWorktree();
  git(["fetch", "--tags", "origin"]);
  git(["pull", "--ff-only"]);
  pnpm(["install", "--frozen-lockfile"]);
  pnpm(["bootstrap"]);
  ensureOpenViking(options);
  if (!options.noBuild) pnpm(["build"]);
  doctor({ quiet: true });
  info("Upgrade complete.");
}

async function checkUrl(url, timeoutMs = 1200) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function doctor(options = {}) {
  ensureNodeVersion();
  const checks = [];
  const push = (name, ok, detail) => checks.push({ name, ok, detail });

  push("Node.js", true, process.version);
  push("pnpm", commandExists("pnpm"), capture("pnpm", ["--version"]) ?? "missing");
  push("git", commandExists("git"), capture("git", ["--version"]) ?? "missing");
  push(".env.local", fs.existsSync(path.join(root, ".env.local")), ".env.local");
  push("SQLite data dir", fs.existsSync(path.join(root, "data")), "data/");
  push("OpenViking runtime", hasOpenVikingRuntime(), "OPENVIKING_SERVER_BIN or thirdparty/openviking/bin/openviking-server");

  const port = process.env.PORT ?? "7369";
  const appUrl = `http://127.0.0.1:${port}`;
  const openVikingUrl = (process.env.OPENVIKING_BASE_URL ?? "http://127.0.0.1:1933").replace(/\/+$/, "");
  push("AgentWorld HTTP", await checkUrl(appUrl), appUrl);
  push("OpenViking HTTP", await checkUrl(`${openVikingUrl}/health`), `${openVikingUrl}/health`);

  if (!options.quiet) {
    console.log(`AgentWorld ${packageJson.version}`);
    console.log(`Root: ${root}`);
    console.log("");
  }

  for (const check of checks) {
    const marker = check.ok ? color("32", "ok") : color("33", "warn");
    console.log(`${marker.padEnd(process.stdout.isTTY && !process.env.NO_COLOR ? 11 : 6)} ${check.name} ${check.detail ? `- ${check.detail}` : ""}`);
  }

  const requiredFailed = checks.some((check) => ["pnpm", "git", ".env.local"].includes(check.name) && !check.ok);
  if (requiredFailed) process.exitCode = 1;
}

function printHelp() {
  console.log(`AgentWorld CLI ${packageJson.version}

Usage:
  agentworld
  agentworld install [--no-build] [--skip-openviking]
  agentworld upgrade [--no-build] [--skip-openviking]
  agentworld start
  agentworld dev
  agentworld build
  agentworld doctor
  agentworld version

Commands:
  start     Start the production server after the default install/build.
  install   Install dependencies, bootstrap local config, install OpenViking, and build.
  upgrade   Pull the latest git revision, reinstall dependencies, bootstrap, install/verify OpenViking, and build.
  dev       Explicitly start the local development server on PORT or 7369.
  build     Build the standalone Next.js app.
  doctor    Check local prerequisites and service health.

Environment:
  PORT                         AgentWorld port. Default: 7369.
  AGENTWORLD_OPENVIKING_AUTO_START=0 disables launcher-managed OpenViking startup.
  OPENVIKING_BASE_URL          OpenViking endpoint. Default: http://127.0.0.1:1933.
`);
}

const parsed = parseArgs(process.argv.slice(2));
const skipOpenViking = parsed.flags.has("--skip-openviking");

if (parsed.command === "install") {
  install({
    build: !parsed.flags.has("--no-build"),
    skipOpenViking,
  });
} else if (parsed.command === "upgrade") {
  upgrade({
    noBuild: parsed.flags.has("--no-build"),
    skipOpenViking,
  });
} else if (parsed.command === "doctor") {
  await doctor();
} else if (parsed.command === "dev") {
  pnpm(["dev"]);
} else if (parsed.command === "start") {
  pnpm(["start"]);
} else if (parsed.command === "build") {
  pnpm(["build"]);
} else if (parsed.command === "version") {
  console.log(packageJson.version);
} else {
  printHelp();
}
