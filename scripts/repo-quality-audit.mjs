import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["src", "scripts"];
const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".playwright-cli",
  "data",
  "dist",
  "node_modules",
  "output",
]);
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".mjs"]);

const hotspots = [];
const findings = {
  todo: [],
  anyType: [],
  eslintDisable: [],
};

function thresholdFor(file) {
  if (file.startsWith("src/locales/")) return 2500;
  if (file.startsWith("src/server/")) return 1400;
  if (file.startsWith("src/components/")) return 900;
  if (file.startsWith("src/app/")) return 650;
  return 900;
}

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

const files = scanRoots.flatMap((entry) => walk(path.join(root, entry)));
for (const file of files) {
  const rel = path.relative(root, file);
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);

  if (lines.length > thresholdFor(rel)) {
    hotspots.push({
      file: rel,
      lines: lines.length,
      threshold: thresholdFor(rel),
    });
  }

  lines.forEach((line, index) => {
    if (rel !== "scripts/repo-quality-audit.mjs" && /\bTODO\b|\bFIXME\b/.test(line)) {
      findings.todo.push(`${rel}:${index + 1} ${line.trim()}`);
    }
    if (rel !== "scripts/repo-quality-audit.mjs" && /(?:\bas\s+any\b|:\s*any\b|<any>)/.test(line)) {
      findings.anyType.push(`${rel}:${index + 1} ${line.trim()}`);
    }
    if (rel !== "scripts/repo-quality-audit.mjs" && /eslint-disable/.test(line)) {
      findings.eslintDisable.push(`${rel}:${index + 1} ${line.trim()}`);
    }
  });
}

const summary = {
  scannedFiles: files.length,
  hotspots: hotspots.length,
  todo: findings.todo.length,
  anyType: findings.anyType.length,
  eslintDisable: findings.eslintDisable.length,
};

console.log("repo quality audit summary:");
console.log(JSON.stringify(summary, null, 2));

if (hotspots.length > 0) {
  console.log("\ncomplexity hotspots:");
  for (const hotspot of hotspots.sort((a, b) => b.lines - a.lines).slice(0, 12)) {
    console.log(`- ${hotspot.file}: ${hotspot.lines} lines (threshold ${hotspot.threshold})`);
  }
}

for (const [label, items] of Object.entries(findings)) {
  if (items.length === 0) continue;
  console.log(`\n${label} findings:`);
  for (const item of items.slice(0, 20)) console.log(`- ${item}`);
  if (items.length > 20) console.log(`- ... ${items.length - 20} more`);
}

if (findings.todo.length > 0) {
  console.error("\nrepo quality audit failed: remove TODO/FIXME markers before delivery.");
  process.exit(1);
}

console.log("\nrepo quality audit completed.");
