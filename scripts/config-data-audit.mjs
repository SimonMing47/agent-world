import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["package.json", "src/app", "src/components", "src/server", "src/db"].map((entry) =>
  path.join(root, entry),
);

const ignoredDirectories = new Set(["node_modules", ".next", ".git", "data", "output", ".venv-openviking"]);
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json"]);

const rules = [
  {
    id: "db-seed-entry",
    pattern: /\bdb:seed\b|src\/db\/seed\.ts|function\s+seed\s*\(|ensure[A-Za-z0-9_]*Seed\s*\(/,
    hint: "Do not add seed scripts or database seed functions for configurable product data.",
  },
  {
    id: "first-row-default",
    pattern:
      /\b(?:businessTeams|agentTeams|providers|runtimeBindings|codebases|tenantSpaces|providerAdapters|environments|taskRuns)\[0\]\?\.id|\[0\]\?\.id\s*\?\?/,
    hint: "Do not auto-select the first database row as a new resource default.",
  },
  {
    id: "hardcoded-demo-case",
    pattern:
      /Open Frontier|platform-team|release-team|pr-vanguard|Shield Inspection|GLM-5\.1 Coding|CodeHub MR Webhook|codehub-mr|task-template-|env-codehub|agent-shield|agent-code-quality|agentworld\.git|new-team|new-tenant|repo-executor|repository-name|viking:\/\/teams\/new-team/,
    hint: "Do not hardcode demo teams, task blueprints, agents, codebases, webhooks, or knowledge spaces.",
  },
  {
    id: "extension-import-example",
    pattern: /buildExtensionImportExample|importExample\s*:/,
    hint: "Plugin bundle examples must not be returned by the runtime API as configured data.",
  },
  {
    id: "builtin-plugin-manifest-data",
    pattern: /listBuiltinPluginManifests|builtin\.(?:notify|repo|trigger|output|provider)\./,
    hint: "Plugin manifests shown in the product must come from imported database records.",
  },
];

function walk(entry, files = []) {
  if (!fs.existsSync(entry)) return files;
  const stat = fs.statSync(entry);
  if (stat.isDirectory()) {
    if (ignoredDirectories.has(path.basename(entry))) return files;
    for (const child of fs.readdirSync(entry)) {
      walk(path.join(entry, child), files);
    }
    return files;
  }
  if (!allowedExtensions.has(path.extname(entry))) return files;
  files.push(entry);
  return files;
}

const findings = [];
for (const file of scanRoots.flatMap((entry) => walk(entry))) {
  const rel = path.relative(root, file);
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const rule of rules) {
      if (rule.pattern.test(line)) {
        findings.push({
          file: rel,
          line: index + 1,
          rule: rule.id,
          text: line.trim(),
          hint: rule.hint,
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error("config data audit failed:");
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} [${finding.rule}] ${finding.text}`);
    console.error(`  ${finding.hint}`);
  }
  process.exit(1);
}

console.log("config data audit passed: no hardcoded configurable seed/default data detected.");
