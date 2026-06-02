#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const storageRoot = path.resolve(process.env.KNOWLEDGE_ENGINE_STORAGE ?? path.join(root, "data", "knowledge-engine"));
const shadowRoot = path.join(storageRoot, "shadow");
const packsRoot = path.join(storageRoot, "packs");
const smokeFile = path.join(shadowRoot, "_smoke", "knowledge-engine-smoke.md");

function ensureStorage() {
  fs.mkdirSync(path.dirname(smokeFile), { recursive: true });
  fs.mkdirSync(packsRoot, { recursive: true });
}

ensureStorage();

if (process.argv.includes("--prepare-only")) {
  console.log(JSON.stringify({ ok: true, storageRoot, prepared: true }, null, 2));
  process.exit(0);
}

if (process.argv.includes("--doctor")) {
  console.log(JSON.stringify({
    ok: fs.existsSync(shadowRoot) && fs.existsSync(packsRoot),
    storageRoot,
    shadowRoot,
    packsRoot,
  }, null, 2));
  process.exit(0);
}

const content = [
  "# AgentWorld Knowledge Engine Smoke",
  "",
  "Local write/read path is healthy.",
  `- checkedAt: ${new Date().toISOString()}`,
].join("\n");

fs.writeFileSync(smokeFile, content, "utf8");
const readback = fs.readFileSync(smokeFile, "utf8");
if (!readback.includes("Local write/read path is healthy.")) {
  throw new Error("Knowledge engine readback did not match smoke content");
}

console.log(JSON.stringify({ ok: true, storageRoot, smokeFile }, null, 2));
