import { writeCliConfig, writeServerConfig } from "./openviking-common.mjs";

const force = process.argv.includes("--force");
const serverConfigPath = writeServerConfig({ force: false });
const cliConfigPath = writeCliConfig({ force });

console.log(JSON.stringify({ ok: true, serverConfigPath, cliConfigPath }, null, 2));
