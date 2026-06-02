import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  defaultServerBin,
  root,
  thirdpartyDir,
  venvDir,
  venvPython,
  resolveServerBin,
  writeCliConfig,
  writeServerConfig,
} from "./openviking-common.mjs";

const force = process.argv.includes("--force");
const requireBinary = process.argv.includes("--require-binary");
const devVenv = process.argv.includes("--dev-venv");
const pythonVenv = devVenv || process.argv.includes("--python-venv");

const configPath = writeServerConfig({ force });
const cliConfigPath = writeCliConfig({ force });

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

function installPythonRuntime() {
  const python = process.env.PYTHON ?? "python3";
  const wheelhouseDir = path.resolve(process.env.OPENVIKING_WHEELHOUSE_DIR ?? path.join(thirdpartyDir, "wheels"));
  const allowNetwork = process.env.OPENVIKING_ALLOW_NETWORK_INSTALL === "1";
  const spec =
    process.env.OPENVIKING_PIP_SPEC ??
    (process.env.OPENVIKING_VERSION
      ? `openviking[local-embed]==${process.env.OPENVIKING_VERSION}`
      : "openviking[local-embed]");

  if (!fs.existsSync(venvPython)) {
    run(python, ["-m", "venv", venvDir]);
  }

  const installArgs = ["-m", "pip", "install", "--upgrade"];
  if (!allowNetwork) {
    if (!fs.existsSync(wheelhouseDir) || fs.readdirSync(wheelhouseDir).length === 0) {
      console.error(`Offline OpenViking wheelhouse is missing or empty: ${wheelhouseDir}`);
      console.error("Populate thirdparty/openviking/wheels, set OPENVIKING_WHEELHOUSE_DIR, or set OPENVIKING_ALLOW_NETWORK_INSTALL=1 for a controlled online install.");
      process.exit(1);
    }
    installArgs.push("--no-index", "--find-links", wheelhouseDir);
  }
  installArgs.push(spec);
  run(venvPython, installArgs);
  console.log(`Python OpenViking runtime installed: ${venvPython}`);
}

if (pythonVenv) {
  installPythonRuntime();
}

const serverBin = resolveServerBin();
console.log(`Config: ${configPath}`);
console.log(`CLI config: ${cliConfigPath}`);
console.log(`Binary path: ${serverBin ?? defaultServerBin}`);
if (!serverBin) {
  console.log("No local OpenViking server binary found.");
  console.log(`Place the vetted binary at thirdparty/openviking/bin/openviking-server-${process.platform}-${process.arch}, or set OPENVIKING_SERVER_BIN.`);
  if (requireBinary) process.exit(1);
}
if (!process.env.OPENVIKING_VLM_PROVIDER || !process.env.OPENVIKING_VLM_MODEL) {
  console.log("OpenViking VLM is not configured yet.");
  console.log("Set OPENVIKING_VLM_PROVIDER and OPENVIKING_VLM_MODEL, or run: pnpm openviking:init");
}
