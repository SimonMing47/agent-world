import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getDatabasePath, refreshDatabase } from "../src/server/db";

const envExamplePath = path.join(process.cwd(), ".env.example");
const envPath = path.join(process.cwd(), ".env.local");

if (!fs.existsSync(envPath)) {
  const masterKey = randomBytes(32).toString("hex");
  const template = fs.existsSync(envExamplePath)
    ? fs.readFileSync(envExamplePath, "utf8")
    : "AGENTHELIX_MASTER_KEY=\nAGENTHELIX_DEFAULT_RUNTIME=http://127.0.0.1:4096\n";

  fs.writeFileSync(envPath, template.replace("AGENTHELIX_MASTER_KEY=", `AGENTHELIX_MASTER_KEY=${masterKey}`));
}

refreshDatabase();

console.log(`AgentHelix bootstrap complete.`);
console.log(`Environment file: ${envPath}`);
console.log(`SQLite database: ${getDatabasePath()}`);
