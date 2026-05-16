import { spawnSync } from "node:child_process";
import fs from "node:fs";
import {
  resolveServerBin,
  resolveServerConfigPath,
  root,
  writeCliConfig,
  writeServerConfig,
} from "./openviking-common.mjs";

const bin = resolveServerBin({ allowVenvFallback: true });
if (!bin || !fs.existsSync(bin)) {
  console.error("OpenViking server binary is missing.");
  console.error("Expected: thirdparty/openviking/bin/openviking-server");
  console.error("Or set OPENVIKING_SERVER_BIN=/absolute/path/to/openviking-server");
  console.error("For local development fallback: pnpm openviking:install");
  process.exit(1);
}

writeServerConfig();
writeCliConfig();

const result = spawnSync(bin, ["doctor"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    OPENVIKING_CONFIG_FILE: resolveServerConfigPath(),
  },
});

process.exit(result.status ?? 0);
