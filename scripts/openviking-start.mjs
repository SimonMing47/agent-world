import { spawn } from "node:child_process";
import fs from "node:fs";
import {
  buildOpenVikingPythonArgs,
  resolveHost,
  resolvePort,
  resolveOpenVikingServerCommand,
  resolveServerConfigPath,
  root,
  writeCliConfig,
  writeServerConfig,
} from "./openviking-common.mjs";

const serverCommand = resolveOpenVikingServerCommand();
const configPath = resolveServerConfigPath();
const host = resolveHost();
const port = resolvePort();

if (!serverCommand || serverCommand.kind === "incompatible") {
  console.error(serverCommand?.compatibility.reason ?? "OpenViking runtime is missing.");
  console.error(`Expected a compatible binary at thirdparty/openviking/bin/openviking-server-${process.platform}-${process.arch}, OPENVIKING_SERVER_BIN, or Python runtime from pnpm openviking:install-python.`);
  process.exit(1);
}

if (!fs.existsSync(configPath)) {
  writeServerConfig();
}
writeCliConfig();

const args = serverCommand.kind === "python"
  ? buildOpenVikingPythonArgs(configPath)
  : ["--config", configPath, "--host", host, "--port", port];
if (serverCommand.compatibility.reason) {
  console.warn(serverCommand.compatibility.reason);
}
const child = spawn(serverCommand.command, args, {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    OPENVIKING_CONFIG_FILE: configPath,
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
