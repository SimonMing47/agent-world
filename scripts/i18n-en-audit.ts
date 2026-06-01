import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { enUSLanguagePack } from "../src/locales/en-US";
import { translateWithPack } from "../src/lib/language-pack";

function walk(dir: string, output: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "public", "locales"].includes(entry.name)) continue;

    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(filePath, output);
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) {
      output.push(filePath);
    }
  }

  return output;
}

const root = process.cwd();
const files = [
  ...walk(path.join(root, "src")),
  ...walk(path.join(root, "scripts")),
];
const usedKeys = new Set<string>();
const bareKeys = new Set<string>();
const quotedDottedKeyPattern = /["'`]([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_-]+)+)["'`]/g;
const bareLanguageKeyPattern =
  /\b(?:actions|agent|agentDefinition|agentTeam|agentTeams|agents|businessTeams|common|console|developmentAccess|identityAccess|knowledge|labels|nav|overview|providerProfile|runtimeBinding|settings|teamWallboard|terminology|ui)\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+\b/g;
const languageKeyValuePattern =
  /^(?:actions|agent|agentDefinition|agentTeam|agentTeams|agents|businessTeams|common|console|developmentAccess|identityAccess|knowledge|labels|nav|overview|providerProfile|runtimeBinding|settings|teamWallboard|terminology|ui)\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/;
const languageKeyPrefixPattern =
  /^(?:actions|agent|agentDefinition|agentTeam|agentTeams|agents|businessTeams|common|console|developmentAccess|identityAccess|knowledge|labels|nav|overview|providerProfile|runtimeBinding|settings|teamWallboard|terminology|ui)\./;
const quotedStringPattern = /(["'`])(?:\\.|(?!\1)[\s\S])*\1/g;
const codeAccessPattern = /\.(trim|toLowerCase|map|slice)$/;
const codeAccessKeys = new Set(["settings.languageConfiguration.languageName"]);
const cjkPattern = /\p{Script=Han}/u;

function isProbableCodeAccess(key: string) {
  return codeAccessPattern.test(key) || codeAccessKeys.has(key);
}

for (const filePath of files) {
  const source = readFileSync(filePath, "utf8");
  for (const match of source.matchAll(quotedDottedKeyPattern)) {
    usedKeys.add(match[1]);
  }
  const sourceWithoutQuotedStrings = source.replace(quotedStringPattern, " ");
  for (const match of sourceWithoutQuotedStrings.matchAll(bareLanguageKeyPattern)) {
    usedKeys.add(match[0]);
    bareKeys.add(match[0]);
  }
}

function shouldResolveToText(key: string) {
  return languageKeyPrefixPattern.test(key) && (bareKeys.has(key) || key.split(".").length >= 3);
}

const offenders = [...usedKeys]
  .map((key) => [key, translateWithPack(enUSLanguagePack, key)] as const)
  .filter(([key, value]) => !isProbableCodeAccess(key) && ((value === key && shouldResolveToText(key)) || cjkPattern.test(value)));

if (offenders.length > 0) {
  console.error("i18n audit failed: en-US resolves raw keys or CJK fallback for referenced keys:");
  for (const [key, value] of offenders.sort(([left], [right]) => left.localeCompare(right))) {
    console.error(`  - ${key}: ${value.replace(/\n/g, "\\n").slice(0, 180)}`);
  }
  process.exit(1);
}

const languagePackValueOffenders: Array<[string, string, string]> = [];
function walkLanguagePackValues(value: unknown, currentPath: string) {
  if (typeof value === "string") {
    if (cjkPattern.test(value)) languagePackValueOffenders.push([currentPath, value, "CJK fallback"]);
    if (languageKeyValuePattern.test(value)) languagePackValueOffenders.push([currentPath, value, "raw key"]);
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const [key, nextValue] of Object.entries(value as Record<string, unknown>)) {
    walkLanguagePackValues(nextValue, currentPath ? `${currentPath}.${key}` : key);
  }
}

walkLanguagePackValues(enUSLanguagePack, "");
if (languagePackValueOffenders.length > 0) {
  console.error("i18n audit failed: en-US language pack still contains raw-key or CJK values:");
  for (const [key, value, reason] of languagePackValueOffenders.sort(([left], [right]) => left.localeCompare(right))) {
    console.error(`  - ${key} (${reason}): ${value.replace(/\n/g, "\\n").slice(0, 180)}`);
  }
  process.exit(1);
}

console.log("en-US audit passed: referenced language keys and full language pack resolve without raw-key or CJK fallback.");
