import { spawnSync } from "node:child_process";
import fs from "node:fs";
import {
  resolveServerBin,
  resolveServerConfigPath,
  root,
  writeCliConfig,
  writeServerConfig,
} from "./openviking-common.mjs";

const bin = resolveServerBin();
if (!bin || !fs.existsSync(bin)) {
  console.error("OpenViking server binary is missing.");
  console.error("Expected: thirdparty/openviking/bin/openviking-server");
  console.error("Or set OPENVIKING_SERVER_BIN=/absolute/path/to/openviking-server");
  console.error("Offline installs do not download OpenViking. Provide the binary from an approved internal artifact.");
  process.exit(1);
}

const configPath = writeServerConfig({ force: process.argv.includes("--force") });
const cliConfigPath = writeCliConfig({ force: process.argv.includes("--force") });

const result = spawnSync(bin, ["init"], {
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
