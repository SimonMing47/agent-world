import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  defaultServerBin,
  platformServerBin,
  root,
  thirdpartyDir,
  writeCliConfig,
  writeServerConfig,
} from "./openviking-common.mjs";

if (process.platform !== "linux" && process.env.AGENTWORLD_ALLOW_NON_LINUX_BINARY_BUILD !== "1") {
  console.error("OpenViking deployment binary must be built on Linux.");
  console.error("Run this script in a Linux builder, then commit thirdparty/openviking/bin/openviking-server-linux-x64 if needed.");
  process.exit(1);
}

const python = process.env.PYTHON ?? "python3";
const buildVenvDir = path.resolve(process.env.OPENVIKING_BUILD_VENV_DIR ?? path.join(root, ".venv-openviking-build"));
const venvPython = path.join(buildVenvDir, "bin", "python");
const distDir = path.join(root, "dist", "openviking-binary-build");
const entry = path.join(root, "scripts", "openviking-server-entry.py");
const wheelhouseDir = path.resolve(process.env.OPENVIKING_WHEELHOUSE_DIR ?? path.join(thirdpartyDir, "wheels"));
const outputBin = path.resolve(process.env.OPENVIKING_BINARY_OUTPUT ?? platformServerBin());
const spec =
  process.env.OPENVIKING_PIP_SPEC ??
  (process.env.OPENVIKING_VERSION
    ? `openviking[local-embed]==${process.env.OPENVIKING_VERSION}`
    : "openviking[local-embed]");

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

function findFile(dir, predicate) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(fullPath, predicate);
      if (found) return found;
      continue;
    }
    if (entry.isFile() && predicate(fullPath)) return fullPath;
  }
  return null;
}

if (!fs.existsSync(venvPython)) {
  run(python, ["-m", "venv", buildVenvDir]);
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

const ragfsBinding = findFile(path.join(buildVenvDir, "lib"), (filePath) => {
  return (
    filePath.includes(`${path.sep}openviking${path.sep}lib${path.sep}`) &&
    path.basename(filePath).startsWith("ragfs_python") &&
    path.extname(filePath) === ".so"
  );
});
const litellmModelPrices = findFile(path.join(buildVenvDir, "lib"), (filePath) => {
  return (
    filePath.includes(`${path.sep}litellm${path.sep}`) &&
    path.basename(filePath) === "model_prices_and_context_window_backup.json"
  );
});
const litellmTokenizersInit = findFile(path.join(buildVenvDir, "lib"), (filePath) => {
  return (
    filePath.includes(
      `${path.sep}litellm${path.sep}litellm_core_utils${path.sep}tokenizers${path.sep}`,
    ) && path.basename(filePath) === "__init__.py"
  );
});
const litellmTokenizersDir = litellmTokenizersInit ? path.dirname(litellmTokenizersInit) : null;
const litellmEndpoints = findFile(path.join(buildVenvDir, "lib"), (filePath) => {
  return (
    filePath.includes(`${path.sep}litellm${path.sep}containers${path.sep}`) &&
    path.basename(filePath) === "endpoints.json"
  );
});
const assetArgs = [
  ...(ragfsBinding ? ["--add-binary", `${ragfsBinding}:openviking/lib`] : []),
  ...(litellmModelPrices ? ["--add-data", `${litellmModelPrices}:litellm`] : []),
  ...(litellmEndpoints ? ["--add-data", `${litellmEndpoints}:litellm/containers`] : []),
  ...(litellmTokenizersDir
    ? [
        "--hidden-import",
        "litellm.litellm_core_utils.tokenizers",
        "--add-data",
        `${litellmTokenizersDir}:litellm/litellm_core_utils/tokenizers`,
      ]
    : []),
];

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
  "--collect-submodules",
  "tiktoken_ext",
  ...assetArgs,
  entry,
]);

fs.mkdirSync(path.dirname(outputBin), { recursive: true });
fs.copyFileSync(path.join(distDir, "openviking-server"), outputBin);
fs.chmodSync(outputBin, 0o755);
if (process.platform === "linux" && process.arch === "x64" && outputBin !== defaultServerBin) {
  fs.copyFileSync(outputBin, defaultServerBin);
  fs.chmodSync(defaultServerBin, 0o755);
}
writeServerConfig();
writeCliConfig();

const manifest = {
  name: "openviking-server",
  source: spec,
  platform: process.platform,
  arch: process.arch,
  output: path.relative(root, outputBin),
  builtAt: new Date().toISOString(),
  license: "AGPL-3.0",
  upstream: "volcengine/OpenViking",
};

fs.mkdirSync(thirdpartyDir, { recursive: true });
fs.writeFileSync(path.join(thirdpartyDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, manifest }, null, 2));
