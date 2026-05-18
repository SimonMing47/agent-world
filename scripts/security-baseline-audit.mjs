import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["src", "scripts"];
const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".playwright-cli",
  ".venv-openviking",
  "data",
  "dist",
  "node_modules",
  "output",
  "thirdparty",
]);
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".mjs"]);

const failRules = [
  {
    id: "dangerous-html",
    pattern: /\bdangerouslySetInnerHTML\b/,
    hint: "Avoid raw HTML injection in product code.",
  },
  {
    id: "eval",
    pattern: /\beval\s*\(/,
    hint: "Do not use eval in product code.",
  },
  {
    id: "new-function",
    pattern: /\bnew\s+Function\s*\(/,
    hint: "Do not construct code with Function at runtime.",
  },
  {
    id: "pem-private-key",
    pattern: /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
    hint: "Do not commit private key material.",
  },
  {
    id: "secret-file-fallback",
    pattern: /~\/\.config\/opencode\/secrets\.json|~\/\.agents\/config\/secrets\.json/,
    hint: "Secrets must resolve through platform refs, not local secret files.",
  },
  {
    id: "hardcoded-api-key",
    pattern: /\b(?:sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z\-_]{20,}|AKIA[0-9A-Z]{16})\b/,
    hint: "Do not commit provider credentials.",
  },
];

const warnRules = [
  {
    id: "direct-secret-env",
    pattern: /\bprocess\.env\.[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PRIVATE_KEY)[A-Z0-9_]*\b/,
    hint: "Inspect direct secret env access and keep it in controlled integration layers only.",
  },
];

const approvedSecretEnvFiles = new Set([
  "src/server/openviking-core.ts",
  "src/server/openviking-process.ts",
  "scripts/openviking-common.mjs",
  "scripts/openviking-smoke.mjs",
]);

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

const failures = [];
const warnings = [];
for (const file of scanRoots.flatMap((entry) => walk(path.join(root, entry)))) {
  const rel = path.relative(root, file);
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const rule of failRules) {
      if (rule.pattern.test(line)) {
        failures.push(`${rel}:${index + 1} [${rule.id}] ${rule.hint}`);
      }
    }
    for (const rule of warnRules) {
      if (rule.id === "direct-secret-env" && approvedSecretEnvFiles.has(rel)) {
        continue;
      }
      if (rule.pattern.test(line)) {
        warnings.push(`${rel}:${index + 1} [${rule.id}] ${rule.hint}`);
      }
    }
  });
}

console.log("security baseline audit summary:");
console.log(
  JSON.stringify(
    {
      scannedRoots: scanRoots,
      failures: failures.length,
      warnings: warnings.length,
    },
    null,
    2,
  ),
);

if (warnings.length > 0) {
  console.log("\nsecurity warnings:");
  for (const warning of warnings.slice(0, 20)) console.log(`- ${warning}`);
  if (warnings.length > 20) console.log(`- ... ${warnings.length - 20} more`);
}

if (failures.length > 0) {
  console.error("\nsecurity baseline audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nsecurity baseline audit passed.");
