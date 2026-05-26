import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  ensurePlatformServerBin,
  platformServerBin,
  root,
  writeCliConfig,
  writeServerConfig,
} from "./openviking-common.mjs";

if (process.platform !== "linux" && process.env.AGENTWORLD_ALLOW_NON_LINUX_PACKAGE !== "1") {
  console.error("Build the Linux release bundle on Linux to avoid platform-specific Next.js output.");
  process.exit(1);
}

const appVersion = process.env.npm_package_version ?? "0.1.0";
const nodeVersion = process.env.AGENTWORLD_BUNDLE_NODE_VERSION ?? process.versions.node;
const bundlePlatform = process.env.AGENTWORLD_BUNDLE_PLATFORM ?? "linux";
const bundleArch = process.env.AGENTWORLD_BUNDLE_ARCH ?? process.arch;
const nodeArch = bundleArch === "x64" ? "x64" : bundleArch === "arm64" ? "arm64" : bundleArch;
const bundleId = `${bundlePlatform}-${bundleArch}`;
const outDir = path.join(root, "dist", `agentworld-${bundleId}-${appVersion}`);
const defaultNodeTar = path.join(root, "thirdparty", "node", `node-v${nodeVersion}-${bundlePlatform}-${nodeArch}.tar.xz`);
const nodeTar = path.resolve(process.env.AGENTWORLD_NODE_RUNTIME_TARBALL ?? defaultNodeTar);
const linuxServerBin = ensurePlatformServerBin(bundlePlatform, bundleArch);
const expectedLinuxServerBin = platformServerBin(bundlePlatform, bundleArch);

function run(command, args, options = {}) {
  execFileSync(command, args, { cwd: root, stdio: "inherit", ...options });
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, force: true });
}

if (!linuxServerBin || !fs.existsSync(linuxServerBin)) {
  console.error(`OpenViking ${bundleId} binary is missing: ${path.relative(root, expectedLinuxServerBin)}`);
  console.error("Build it on a matching Linux builder with pnpm openviking:build-binary, or place an approved internal binary/archive there.");
  process.exit(1);
}

if (!fs.existsSync(nodeTar)) {
  console.error(`Node.js runtime archive is missing: ${nodeTar}`);
  console.error("Place the approved internal archive at thirdparty/node/, or set AGENTWORLD_NODE_RUNTIME_TARBALL.");
  process.exit(1);
}

writeServerConfig();
writeCliConfig();
run("pnpm", ["build"]);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

run("tar", ["-xJf", nodeTar, "-C", outDir]);
fs.renameSync(
  path.join(outDir, `node-v${nodeVersion}-${bundlePlatform}-${nodeArch}`),
  path.join(outDir, "runtime-node"),
);

copyDir(path.join(root, ".next", "standalone"), path.join(outDir, "app"));
copyDir(path.join(root, ".next", "server", "chunks"), path.join(outDir, "app", ".next", "server", "chunks"));
copyDir(path.join(root, ".next", "static"), path.join(outDir, "app", ".next", "static"));
copyDir(path.join(root, "public"), path.join(outDir, "app", "public"));
copyDir(path.join(root, "thirdparty"), path.join(outDir, "thirdparty"));
fs.copyFileSync(linuxServerBin, path.join(outDir, "thirdparty", "openviking", "bin", "openviking-server"));
fs.chmodSync(path.join(outDir, "thirdparty", "openviking", "bin", "openviking-server"), 0o755);
copyDir(path.join(root, "data", "openviking"), path.join(outDir, "data", "openviking"));
copyDir(path.join(root, "docs"), path.join(outDir, "docs"));

const launcher = `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export NODE_ENV="\${NODE_ENV:-production}"
export PORT="\${PORT:-7369}"
export HOSTNAME="\${HOSTNAME:-0.0.0.0}"
export NODE_OPTIONS="\${NODE_OPTIONS:-} --no-warnings=ExperimentalWarning"
export AGENTWORLD_OPENVIKING_AUTO_START="\${AGENTWORLD_OPENVIKING_AUTO_START:-1}"
export OPENVIKING_SERVER_BIN="\${OPENVIKING_SERVER_BIN:-$ROOT/thirdparty/openviking/bin/openviking-server}"
export OPENVIKING_CONFIG_FILE="\${OPENVIKING_CONFIG_FILE:-$ROOT/data/openviking/ov.conf}"
export OPENVIKING_CLI_CONFIG_FILE="\${OPENVIKING_CLI_CONFIG_FILE:-$ROOT/data/openviking/ovcli.conf}"
OPENVIKING_PID=""
if [ "\${AGENTWORLD_OPENVIKING_AUTO_START}" != "0" ]; then
  OPENVIKING_BASE_URL="\${OPENVIKING_BASE_URL:-http://127.0.0.1:1933}"
  if ! "$ROOT/runtime-node/bin/node" -e "fetch(process.env.OPENVIKING_BASE_URL).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    mkdir -p "$ROOT/data/openviking"
    "$OPENVIKING_SERVER_BIN" --config "$OPENVIKING_CONFIG_FILE" --host "\${OPENVIKING_HOST:-127.0.0.1}" --port "\${OPENVIKING_PORT:-1933}" > "$ROOT/data/openviking/openviking.log" 2>&1 &
    OPENVIKING_PID="$!"
    export OPENVIKING_PID
  fi
fi
cleanup() {
  if [ -n "\${OPENVIKING_PID}" ]; then
    kill "\${OPENVIKING_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM
exec "$ROOT/runtime-node/bin/node" "$ROOT/app/server.js"
`;

fs.writeFileSync(path.join(outDir, "agentworld"), launcher);
fs.chmodSync(path.join(outDir, "agentworld"), 0o755);

const openvikingLauncher = `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export OPENVIKING_CONFIG_FILE="\${OPENVIKING_CONFIG_FILE:-$ROOT/data/openviking/ov.conf}"
exec "$ROOT/thirdparty/openviking/bin/openviking-server" --config "$OPENVIKING_CONFIG_FILE" --host "\${OPENVIKING_HOST:-127.0.0.1}" --port "\${OPENVIKING_PORT:-1933}"
`;

fs.writeFileSync(path.join(outDir, "openviking-server"), openvikingLauncher);
fs.chmodSync(path.join(outDir, "openviking-server"), 0o755);

fs.writeFileSync(
  path.join(outDir, "README.txt"),
  [
    "AgentWorld Linux bundle",
    `Target: ${bundleId}`,
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
