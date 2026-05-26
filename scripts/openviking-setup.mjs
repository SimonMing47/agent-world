import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  defaultServerBin,
  root,
  venvDir,
  writeCliConfig,
  writeServerConfig,
} from "./openviking-common.mjs";

const python = process.env.PYTHON ?? "python3";
const venvPython = path.join(venvDir, "bin", "python");
const force = process.argv.includes("--force");
const devVenv = process.argv.includes("--dev-venv");

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

const configPath = writeServerConfig({ force });
const cliConfigPath = writeCliConfig({ force });

if (devVenv) {
  const spec =
    process.env.OPENVIKING_PIP_SPEC ??
    (process.env.OPENVIKING_VERSION
      ? `openviking[local-embed]==${process.env.OPENVIKING_VERSION}`
      : "openviking[local-embed]");

  if (!fs.existsSync(venvPython)) {
    run(python, ["-m", "venv", venvDir]);
  }

  run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"]);
  run(venvPython, ["-m", "pip", "install", "--upgrade", spec]);
}

console.log(`Config: ${configPath}`);
console.log(`CLI config: ${cliConfigPath}`);
console.log(`Binary path: ${defaultServerBin}`);
if (!fs.existsSync(defaultServerBin) && !devVenv) {
  console.log("No bundled OpenViking server binary found yet.");
  console.log("For deployment, place the Linux binary at thirdparty/openviking/bin/openviking-server.");
  console.log("For a managed source install, run: pnpm openviking:install");
}
if (!process.env.OPENVIKING_VLM_PROVIDER || !process.env.OPENVIKING_VLM_MODEL) {
  console.log("OpenViking VLM is not configured yet.");
  console.log("Set OPENVIKING_VLM_PROVIDER and OPENVIKING_VLM_MODEL, or run: pnpm openviking:init");
}
