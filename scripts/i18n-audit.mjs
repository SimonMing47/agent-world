import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function runRg(args) {
  const result = spawnSync("rg", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(2);
  }

  return result;
}

const scanTargets = ["src"];
const hardcodedCopyResult = runRg([
  "-n",
  "[\\p{Han}]",
  ...scanTargets,
  "--glob",
  "!src/locales/**",
  "--glob",
  "!**/*.md",
]);

if ((hardcodedCopyResult.status ?? 1) > 1) {
  process.stdout.write(hardcodedCopyResult.stdout);
  process.stderr.write(hardcodedCopyResult.stderr);
  process.exit(hardcodedCopyResult.status ?? 1);
}

const keyUsageResult = runRg([
  "-o",
  "ui\\.generated\\.[A-Za-z0-9]+",
  ...scanTargets,
  "--glob",
  "!src/locales/**",
]);

if ((keyUsageResult.status ?? 1) > 1) {
  process.stdout.write(keyUsageResult.stdout);
  process.stderr.write(keyUsageResult.stderr);
  process.exit(keyUsageResult.status ?? 1);
}

const localeText = readFileSync(new URL("../src/locales/zh-CN.ts", import.meta.url), "utf8");
const translatedKeys = new Set(
  [...localeText.matchAll(/"([a-f0-9]{11,})"\s*:/g)].map((match) => `ui.generated.${match[1]}`),
);

const referencedKeys = new Set(
  keyUsageResult.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(":").pop())
    .filter(Boolean),
);

const missingKeys = [...referencedKeys].filter((key) => !translatedKeys.has(key));

if ((hardcodedCopyResult.status ?? 1) === 0 || missingKeys.length > 0) {
  if ((hardcodedCopyResult.status ?? 1) === 0) {
    process.stdout.write(hardcodedCopyResult.stdout);
    process.stderr.write(hardcodedCopyResult.stderr);
  }

  if (missingKeys.length > 0) {
    console.error("i18n audit failed: missing generated translations:");
    for (const key of missingKeys.sort()) {
      console.error(`  - ${key}`);
    }
  }

  process.exit(1);
}

console.log("i18n audit passed: no hardcoded CJK copy outside src/locales, and all generated keys are translated.");
