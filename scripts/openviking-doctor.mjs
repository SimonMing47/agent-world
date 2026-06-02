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

writeServerConfig();
writeCliConfig();

const args = serverCommand.kind === "python"
  ? ["-c", "from openviking_cli.server_bootstrap import main; main()", "doctor"]
  : ["doctor"];
const result = spawnSync(serverCommand.command, args, {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    OPENVIKING_CONFIG_FILE: resolveServerConfigPath(),
  },
});

process.exit(result.status ?? 0);
