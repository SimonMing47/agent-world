import { spawn } from "node:child_process";
import fs from "node:fs";
import {
  resolveHost,
  resolvePort,
  resolveServerBin,
  resolveServerConfigPath,
  root,
  writeCliConfig,
  writeServerConfig,
} from "./openviking-common.mjs";

const bin = resolveServerBin({ allowVenvFallback: true });
const configPath = resolveServerConfigPath();
const host = resolveHost();
const port = resolvePort();

if (!bin || !fs.existsSync(bin)) {
  console.error("OpenViking server binary is missing.");
  console.error("Expected: thirdparty/openviking/bin/openviking-server");
  console.error("Or set OPENVIKING_SERVER_BIN=/absolute/path/to/openviking-server");
  console.error("For a managed source install: pnpm openviking:install");
  process.exit(1);
}

if (!fs.existsSync(configPath)) {
  writeServerConfig();
}
writeCliConfig();

const child = spawn(bin, ["--config", configPath, "--host", host, "--port", port], {
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
