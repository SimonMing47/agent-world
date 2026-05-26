import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  defaultServerBin,
  root,
  thirdpartyDir,
  venvDir,
  writeCliConfig,
  writeServerConfig,
} from "./openviking-common.mjs";

if (process.platform !== "linux" && process.env.AGENTWORLD_ALLOW_NON_LINUX_BINARY_BUILD !== "1") {
  console.error("OpenViking deployment binary must be built on Linux.");
  console.error("Run this script in a Linux builder, then commit thirdparty/openviking/bin/openviking-server if needed.");
  process.exit(1);
}

const python = process.env.PYTHON ?? "python3";
const venvPython = path.join(venvDir, "bin", "python");
const distDir = path.join(root, "dist", "openviking-binary-build");
const entry = path.join(root, "scripts", "openviking-server-entry.py");
const wheelhouseDir = path.resolve(process.env.OPENVIKING_WHEELHOUSE_DIR ?? path.join(thirdpartyDir, "wheels"));
const spec =
  process.env.OPENVIKING_PIP_SPEC ??
  (process.env.OPENVIKING_VERSION
    ? `openviking[local-embed]==${process.env.OPENVIKING_VERSION}`
    : "openviking[local-embed]");

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

if (!fs.existsSync(venvPython)) {
  run(python, ["-m", "venv", venvDir]);
}

if (!fs.existsSync(wheelhouseDir) || fs.readdirSync(wheelhouseDir).length === 0) {
  console.error(`Offline OpenViking wheelhouse is missing or empty: ${wheelhouseDir}`);
  console.error("Populate it from an approved internal artifact source before building the binary.");
  process.exit(1);
}

run(venvPython, [
  "-m",
  "pip",
  "install",
  "--no-index",
  "--find-links",
  wheelhouseDir,
  "--upgrade",
  spec,
  "pyinstaller",
]);

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

run(venvPython, [
  "-m",
  "PyInstaller",
  "--clean",
  "--onefile",
  "--name",
  "openviking-server",
  "--distpath",
  distDir,
  "--workpath",
  path.join(distDir, "work"),
  "--specpath",
  distDir,
  "--collect-all",
  "openviking",
  "--collect-all",
  "openviking_cli",
  entry,
]);

fs.mkdirSync(path.dirname(defaultServerBin), { recursive: true });
fs.copyFileSync(path.join(distDir, "openviking-server"), defaultServerBin);
fs.chmodSync(defaultServerBin, 0o755);
writeServerConfig();
writeCliConfig();

const manifest = {
  name: "openviking-server",
  source: spec,
  platform: process.platform,
  arch: process.arch,
  output: path.relative(root, defaultServerBin),
  builtAt: new Date().toISOString(),
  license: "AGPL-3.0",
  upstream: "volcengine/OpenViking",
};

fs.mkdirSync(thirdpartyDir, { recursive: true });
fs.writeFileSync(path.join(thirdpartyDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, manifest }, null, 2));
