import { spawnSync } from "node:child_process";

const scanTargets = ["src"];
const args = [
  "-n",
  "[\\p{Han}]",
  ...scanTargets,
  "--glob",
  "!src/locales/**",
  "--glob",
  "!**/*.md",
];

const result = spawnSync("rg", args, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (result.status === 1) {
  console.log("i18n audit passed: no hardcoded CJK copy outside src/locales.");
  process.exit(0);
}

if (result.error) {
  console.error(result.error.message);
  process.exit(2);
}

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
