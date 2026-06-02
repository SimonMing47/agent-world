import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const mode = process.argv[2] ?? "start";
const root = process.cwd();
const defaultAgentWorldPort = "7369";
const experimentalWarningOption = "--no-warnings=ExperimentalWarning";

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
  if (!nextChild.killed) {
    nextChild.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal));
}

nextChild.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
