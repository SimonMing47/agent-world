import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getDatabasePath, refreshDatabase } from "../src/server/db";

const envExamplePath = path.join(process.cwd(), ".env.example");
const envPath = path.join(process.cwd(), ".env.local");
const defaultTemplate =
  "AGENTWORLD_MASTER_KEY=\nAGENTWORLD_DEFAULT_RUNTIME=http://127.0.0.1:4096\n";

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, fs.existsSync(envExamplePath) ? fs.readFileSync(envExamplePath, "utf8") : defaultTemplate);
}

const envContent = fs.readFileSync(envPath, "utf8");
const masterKey = randomBytes(32).toString("hex");
let nextEnvContent = envContent;

if (!nextEnvContent.includes("AGENTWORLD_MASTER_KEY=")) {
  nextEnvContent += nextEnvContent.endsWith("\n") ? "" : "\n";
  nextEnvContent += `AGENTWORLD_MASTER_KEY=${masterKey}\n`;
} else if (nextEnvContent.includes("AGENTWORLD_MASTER_KEY=\n")) {
  nextEnvContent = nextEnvContent.replace("AGENTWORLD_MASTER_KEY=\n", `AGENTWORLD_MASTER_KEY=${masterKey}\n`);
}

if (!nextEnvContent.includes("AGENTWORLD_DEFAULT_RUNTIME=")) {
  nextEnvContent += `AGENTWORLD_DEFAULT_RUNTIME=http://127.0.0.1:4096\n`;
}

fs.writeFileSync(envPath, nextEnvContent);

refreshDatabase();

console.log(`AgentWorld bootstrap complete.`);
console.log(`Environment file: ${envPath}`);
console.log(`SQLite database: ${getDatabasePath()}`);
