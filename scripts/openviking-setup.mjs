import {
  defaultServerBin,
  resolveServerBin,
  writeCliConfig,
  writeServerConfig,
} from "./openviking-common.mjs";

const force = process.argv.includes("--force");
const requireBinary = process.argv.includes("--require-binary");
const devVenv = process.argv.includes("--dev-venv");

const configPath = writeServerConfig({ force });
const cliConfigPath = writeCliConfig({ force });

if (devVenv) {
  console.error("Networked OpenViking pip installation is disabled for offline deployments.");
  console.error("Provide a vetted OpenViking server binary via OPENVIKING_SERVER_BIN or thirdparty/openviking/bin/openviking-server.");
  process.exit(1);
}

const serverBin = resolveServerBin();
console.log(`Config: ${configPath}`);
console.log(`CLI config: ${cliConfigPath}`);
console.log(`Binary path: ${serverBin ?? defaultServerBin}`);
if (!serverBin) {
  console.log("No local OpenViking server binary found.");
  console.log("Place the vetted binary at thirdparty/openviking/bin/openviking-server, or set OPENVIKING_SERVER_BIN.");
  if (requireBinary) process.exit(1);
}
if (!process.env.OPENVIKING_VLM_PROVIDER || !process.env.OPENVIKING_VLM_MODEL) {
  console.log("OpenViking VLM is not configured yet.");
  console.log("Set OPENVIKING_VLM_PROVIDER and OPENVIKING_VLM_MODEL, or run: pnpm openviking:init");
}
