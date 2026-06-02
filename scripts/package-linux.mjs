import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "linux" && process.env.AGENTWORLD_ALLOW_NON_LINUX_PACKAGE !== "1") {
  console.error("Build the Linux release bundle on Linux to avoid platform-specific Next.js output.");
  process.exit(1);
}

const root = process.cwd();
const appVersion = process.env.npm_package_version ?? "0.1.0";
const bundlePlatform = process.env.AGENTWORLD_BUNDLE_PLATFORM ?? "linux";
const bundleArch = process.env.AGENTWORLD_BUNDLE_ARCH ?? process.arch;
const bundleId = `${bundlePlatform}-${bundleArch}`;
const outDir = path.join(root, "dist", `agentworld-${bundleId}-${appVersion}`);

function run(command, args, options = {}) {
  execFileSync(command, args, { cwd: root, stdio: "inherit", ...options });
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, force: true });
}

run("pnpm", ["build"]);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

copyDir(path.join(root, ".next", "standalone"), path.join(outDir, "app"));
copyDir(path.join(root, ".next", "server", "chunks"), path.join(outDir, "app", ".next", "server", "chunks"));
copyDir(path.join(root, ".next", "static"), path.join(outDir, "app", ".next", "static"));
copyDir(path.join(root, "public"), path.join(outDir, "app", "public"));
copyDir(path.join(root, "docs"), path.join(outDir, "docs"));
fs.mkdirSync(path.join(outDir, "data", "knowledge-engine", "shadow"), { recursive: true });
fs.mkdirSync(path.join(outDir, "data", "knowledge-engine", "packs"), { recursive: true });

const launcher = `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export NODE_ENV="\${NODE_ENV:-production}"
export PORT="\${PORT:-7369}"
export HOSTNAME="\${HOSTNAME:-0.0.0.0}"
export NODE_OPTIONS="\${NODE_OPTIONS:-} --no-warnings=ExperimentalWarning"
mkdir -p "$ROOT/data/knowledge-engine/shadow" "$ROOT/data/knowledge-engine/packs"
exec node "$ROOT/app/server.js"
`;

fs.writeFileSync(path.join(outDir, "agentworld"), launcher);
fs.chmodSync(path.join(outDir, "agentworld"), 0o755);

fs.writeFileSync(
  path.join(outDir, "README.txt"),
  [
    "AgentWorld Linux bundle",
    `Target: ${bundleId}`,
    "",
    "1. Edit .env or export required environment variables.",
    "2. Start AgentWorld: ./agentworld",
    "3. AgentWorld uses its built-in SQLite-backed knowledge engine.",
    "",
    "This bundle expects Node.js to be available on the target host and does not require an external knowledge service.",
  ].join("\n"),
);

run("tar", ["-czf", `${outDir}.tar.gz`, "-C", path.dirname(outDir), path.basename(outDir)]);
console.log(JSON.stringify({ ok: true, outDir, archive: `${outDir}.tar.gz` }, null, 2));
