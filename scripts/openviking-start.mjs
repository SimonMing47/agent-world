import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const bin = path.join(root, ".venv-openviking", "bin", "openviking-server");
const configPath = process.env.OPENVIKING_CONFIG_FILE ?? path.join(root, "data", "openviking", "ov.conf");
const host = process.env.OPENVIKING_HOST ?? "127.0.0.1";
const port = process.env.OPENVIKING_PORT ?? "1933";

if (!fs.existsSync(bin)) {
  console.error("OpenViking is not installed. Run: pnpm openviking:install");
  process.exit(1);
}

if (!fs.existsSync(configPath)) {
  console.error("OpenViking config is missing. Run: pnpm openviking:install");
  process.exit(1);
}

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

