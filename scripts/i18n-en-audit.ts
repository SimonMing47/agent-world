import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
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
const codeAccessPattern = /\.(trim|toLowerCase|map|slice)$/;
const codeAccessKeys = new Set(["settings.languageConfiguration.languageName"]);
const cjkPattern = /\p{Script=Han}/u;
const generatedKeyPattern = /ui\.generated\.[A-Za-z0-9_-]+/;
const localizingChildComponents = new Set([
  "Badge",
  "Button",
  "DataTableCell",
  "DataTableHead",
  "DialogDescription",
  "DialogTitle",
  "Select",
]);

function isProbableCodeAccess(key: string) {
  return codeAccessPattern.test(key) || codeAccessKeys.has(key);
}

function jsxTagName(node: ts.JsxTagNameExpression) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.getText();
  return node.getText();
}

function isIntrinsicJsxTag(name: string) {
  return /^[a-z]/.test(name);
}

function sourcePosition(sourceFile: ts.SourceFile, node: ts.Node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${path.relative(root, sourceFile.fileName)}:${position.line + 1}:${position.character + 1}`;
}

function collectRawGeneratedKeyJsxLeaks() {
  const findings: string[] = [];
  const uiFiles = files.filter((filePath) => /\.(tsx|jsx)$/.test(filePath) && /\/src\/(?:app|components)\//.test(filePath));

  for (const filePath of uiFiles) {
    const source = readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    function visit(node: ts.Node, localizingDepth = 0, intrinsicDepth = 0) {
      let nextLocalizingDepth = localizingDepth;
      let nextIntrinsicDepth = intrinsicDepth;

      if (ts.isJsxElement(node)) {
        const name = jsxTagName(node.openingElement.tagName);
        if (localizingChildComponents.has(name)) nextLocalizingDepth += 1;
        if (isIntrinsicJsxTag(name)) nextIntrinsicDepth += 1;
      } else if (ts.isJsxSelfClosingElement(node)) {
        const name = jsxTagName(node.tagName);
        if (localizingChildComponents.has(name)) nextLocalizingDepth += 1;
        if (isIntrinsicJsxTag(name)) nextIntrinsicDepth += 1;
      }

      if (ts.isJsxText(node) && generatedKeyPattern.test(node.getText()) && intrinsicDepth > 0 && localizingDepth === 0) {
        findings.push(`${sourcePosition(sourceFile, node)} raw JSX text ${JSON.stringify(node.getText().trim().replace(/\s+/g, " "))}`);
      }

      if (ts.isStringLiteral(node) && generatedKeyPattern.test(node.text)) {
        const parent = node.parent;
        if (ts.isJsxAttribute(parent)) {
          const owner = parent.parent?.parent;
          const name =
            owner && (ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner))
              ? jsxTagName(owner.tagName)
              : "";
          if (isIntrinsicJsxTag(name) && localizingDepth === 0) {
            findings.push(`${sourcePosition(sourceFile, node)} raw ${parent.name.getText(sourceFile)} attribute ${JSON.stringify(node.text)}`);
          }
        } else if (ts.isJsxExpression(parent) && intrinsicDepth > 0 && localizingDepth === 0) {
          findings.push(`${sourcePosition(sourceFile, node)} raw JSX expression ${JSON.stringify(node.text)}`);
        }
      }

      if (
        ts.isJsxExpression(node) &&
        !ts.isJsxAttribute(node.parent) &&
        node.expression &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "message" &&
        intrinsicDepth > 0 &&
        localizingDepth === 0
      ) {
        findings.push(`${sourcePosition(sourceFile, node)} raw status message expression {message}`);
      }

      ts.forEachChild(node, (child) => visit(child, nextLocalizingDepth, nextIntrinsicDepth));
    }

    visit(sourceFile);
  }

  return findings;
}

function hasStringOpeningContext(source: string, index: number) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(source[cursor] ?? "")) cursor -= 1;
  if (cursor < 0) return true;

  const previous = source[cursor] ?? "";
  if ("([{,:;=!?&|+-*%~<>".includes(previous)) return true;

  const wordMatch = source.slice(0, cursor + 1).match(/[A-Za-z_$][\w$]*$/);
  return Boolean(wordMatch && /^(?:return|throw|case|yield|await|typeof|void|delete|in|of|new)$/.test(wordMatch[0]));
}

function stripQuotedStrings(source: string) {
  const output = source.split("");

  for (let index = 0; index < source.length; index += 1) {
    const delimiter = source[index];
    if ((delimiter !== "\"" && delimiter !== "'" && delimiter !== "`") || !hasStringOpeningContext(source, index)) {
      continue;
    }

    const start = index;
    index += 1;
    while (index < source.length) {
      const current = source[index];
      if (current === "\\") {
        index += 2;
        continue;
      }
      if (current === delimiter) {
        index += 1;
        break;
      }
      index += 1;
    }

    output.fill(" ", start, index);
    index -= 1;
  }

  return output.join("");
}

for (const filePath of files) {
  const source = readFileSync(filePath, "utf8");
  for (const match of source.matchAll(quotedDottedKeyPattern)) {
    usedKeys.add(match[1]);
  }
  const sourceWithoutQuotedStrings = stripQuotedStrings(source);
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

const rawGeneratedKeyJsxLeaks = collectRawGeneratedKeyJsxLeaks();
if (rawGeneratedKeyJsxLeaks.length > 0) {
  console.error("i18n audit failed: generated language keys are rendered directly in intrinsic JSX:");
  for (const finding of rawGeneratedKeyJsxLeaks.slice(0, 40)) {
    console.error(`  - ${finding}`);
  }
  if (rawGeneratedKeyJsxLeaks.length > 40) {
    console.error(`  - ... ${rawGeneratedKeyJsxLeaks.length - 40} more`);
  }
  process.exit(1);
}

console.log("en-US audit passed: referenced language keys and full language pack resolve without raw-key or CJK fallback.");
