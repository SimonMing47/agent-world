import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const venvDir = path.join(root, ".venv-openviking");
const python = process.env.PYTHON ?? "python3";
const venvPython = path.join(venvDir, "bin", "python");
const configDir = path.join(root, "data", "openviking");
const configPath = path.join(configDir, "ov.conf");
const port = Number(process.env.OPENVIKING_PORT ?? 1933);

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

if (!fs.existsSync(venvPython)) {
  run(python, ["-m", "venv", venvDir]);
}

run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"]);
run(venvPython, ["-m", "pip", "install", "openviking[local-embed]"]);

fs.mkdirSync(configDir, { recursive: true });
if (!fs.existsSync(configPath) || process.argv.includes("--force")) {
  const config = {
    server: {
      host: "127.0.0.1",
      port,
      cors_origins: ["http://localhost:3002", "http://127.0.0.1:3002"],
    },
    storage: {
      workspace: "./data/openviking/workspace",
      agfs: { backend: "local" },
      vectordb: { backend: "local" },
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

console.log(`OpenViking is ready at ${venvDir}`);
console.log(`Config: ${configPath}`);

