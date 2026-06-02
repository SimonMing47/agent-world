import { spawnSync } from "node:child_process";
import {
  resolveOpenVikingServerCommand,
  resolveServerConfigPath,
  root,
  writeCliConfig,
  writeServerConfig,
} from "./openviking-common.mjs";

const serverCommand = resolveOpenVikingServerCommand();
if (!serverCommand || serverCommand.kind === "incompatible") {
  console.error(serverCommand?.compatibility.reason ?? "OpenViking runtime is missing.");
  console.error(`Expected a compatible binary at thirdparty/openviking/bin/openviking-server-${process.platform}-${process.arch}, OPENVIKING_SERVER_BIN, or Python runtime from pnpm openviking:install-python.`);
  process.exit(1);
}

const configPath = writeServerConfig({ force: process.argv.includes("--force") });
const cliConfigPath = writeCliConfig({ force: process.argv.includes("--force") });

const args = serverCommand.kind === "python"
  ? ["-c", "from openviking_cli.server_bootstrap import main; main()", "init"]
  : ["init"];
const result = spawnSync(serverCommand.command, args, {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    OPENVIKING_CONFIG_FILE: resolveServerConfigPath(),
  },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(JSON.stringify({ ok: true, configPath, cliConfigPath }, null, 2));
