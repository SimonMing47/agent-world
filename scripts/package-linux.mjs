import { execFileSync } from "node:child_process";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { defaultServerBin, root, writeCliConfig, writeServerConfig } from "./openviking-common.mjs";

if (process.platform !== "linux" && process.env.AGENTWORLD_ALLOW_NON_LINUX_PACKAGE !== "1") {
  console.error("Build the Linux release bundle on Linux to avoid platform-specific Next.js output.");
  process.exit(1);
}

const appVersion = process.env.npm_package_version ?? "0.1.0";
const nodeVersion = process.env.AGENTWORLD_BUNDLE_NODE_VERSION ?? process.versions.node;
const outDir = path.join(root, "dist", `agentworld-linux-x64-${appVersion}`);
const nodeTar = path.join(root, "dist", `node-v${nodeVersion}-linux-x64.tar.xz`);
const nodeUrl = `https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}-linux-x64.tar.xz`;

function run(command, args, options = {}) {
  execFileSync(command, args, { cwd: root, stdio: "inherit", ...options });
}

function download(url, target) {
  if (fs.existsSync(target)) return Promise.resolve();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(target);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          file.close();
          fs.rmSync(target, { force: true });
          reject(new Error(`download failed: ${response.statusCode} ${response.statusMessage}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (error) => {
        file.close();
        fs.rmSync(target, { force: true });
        reject(error);
      });
  });
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

if (!fs.existsSync(defaultServerBin)) {
  console.error("OpenViking binary is missing: thirdparty/openviking/bin/openviking-server");
  console.error("Run pnpm openviking:build-binary on Linux, or place the upstream-compatible binary there.");
  process.exit(1);
}

writeServerConfig();
writeCliConfig();
run("pnpm", ["build"]);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

await download(nodeUrl, nodeTar);
run("tar", ["-xJf", nodeTar, "-C", outDir]);
fs.renameSync(
  path.join(outDir, `node-v${nodeVersion}-linux-x64`),
  path.join(outDir, "runtime-node"),
);

copyDir(path.join(root, ".next", "standalone"), path.join(outDir, "app"));
copyDir(path.join(root, ".next", "static"), path.join(outDir, "app", ".next", "static"));
copyDir(path.join(root, "public"), path.join(outDir, "app", "public"));
copyDir(path.join(root, "thirdparty"), path.join(outDir, "thirdparty"));
copyDir(path.join(root, "data", "openviking"), path.join(outDir, "data", "openviking"));
copyDir(path.join(root, "docs"), path.join(outDir, "docs"));

const launcher = `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export NODE_ENV="\${NODE_ENV:-production}"
export PORT="\${PORT:-3002}"
export HOSTNAME="\${HOSTNAME:-0.0.0.0}"
export AGENTWORLD_OPENVIKING_AUTO_START="\${AGENTWORLD_OPENVIKING_AUTO_START:-1}"
export OPENVIKING_SERVER_BIN="\${OPENVIKING_SERVER_BIN:-$ROOT/thirdparty/openviking/bin/openviking-server}"
export OPENVIKING_CONFIG_FILE="\${OPENVIKING_CONFIG_FILE:-$ROOT/data/openviking/ov.conf}"
export OPENVIKING_CLI_CONFIG_FILE="\${OPENVIKING_CLI_CONFIG_FILE:-$ROOT/data/openviking/ovcli.conf}"
exec "$ROOT/runtime-node/bin/node" "$ROOT/app/server.js"
`;

fs.writeFileSync(path.join(outDir, "agentworld"), launcher);
fs.chmodSync(path.join(outDir, "agentworld"), 0o755);

const openvikingLauncher = `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export OPENVIKING_CONFIG_FILE="\${OPENVIKING_CONFIG_FILE:-$ROOT/data/openviking/ov.conf}"
exec "$ROOT/thirdparty/openviking/bin/openviking-server" --config "$OPENVIKING_CONFIG_FILE" --host "\${OPENVIKING_HOST:-127.0.0.1}" --port "\${OPENVIKING_PORT:-1933}"
`;

fs.writeFileSync(path.join(outDir, "openviking-server"), openvikingLauncher);
fs.chmodSync(path.join(outDir, "openviking-server"), 0o755);

fs.writeFileSync(
  path.join(outDir, "README.txt"),
  [
    "AgentWorld Linux bundle",
    "",
    "1. Edit .env or export required environment variables.",
    "2. Start AgentWorld: ./agentworld",
    "3. AgentWorld starts OpenViking automatically when AGENTWORLD_OPENVIKING_AUTO_START=1.",
    "4. Optional manual OpenViking start: ./openviking-server",
    "",
    "This bundle includes a Node.js runtime and expects the OpenViking server binary under thirdparty/openviking/bin/openviking-server.",
  ].join("\n"),
);

run("tar", ["-czf", `${outDir}.tar.gz`, "-C", path.dirname(outDir), path.basename(outDir)]);
console.log(JSON.stringify({ ok: true, outDir, archive: `${outDir}.tar.gz` }, null, 2));
