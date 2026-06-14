import fs from "node:fs";
import path from "node:path";
import {
  type ExecutablePluginModule,
  type ExecutableToolBundle,
  type PluginRuntimeContext,
} from "@/server/plugin-sdk-core";
import { uiText } from "@/lib/language-pack";

type JsonRecord = Record<string, unknown>;

type CleanCodeFinding = {
  ruleId: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  filePath: string;
  lineNumber: number | null;
  evidenceLine: string;
};

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".playwright-cli",
  "coverage",
  "data",
  "dist",
  "node_modules",
  "out",
  "output",
]);

const defaultExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const todoMarkerPattern = new RegExp("\\bTO" + "DO\\b|\\bFIX" + "ME\\b");
const looseTypePattern = new RegExp("(?:\\bas\\s+" + "any\\b|:\\s*" + "any\\b|<" + "any>)");
const lintDisablePattern = new RegExp("eslint-" + "disable");
const secretAssignmentPattern = new RegExp(
  "(?:api[_-]?key|private[_-]?key|passwd|password|secret|token)\\s*[:=]\\s*['\\\"`][^'\\\"`\\s]{8,}",
  "i",
);
const dynamicCodePattern = new RegExp("\\b(?:eval|Function)\\s*\\(");
const shellInputPattern = new RegExp(
  "\\b(?:exec|execFile|execSync|spawn|spawnSync)\\s*\\([^\\n]*(?:argv|body|query|params|request|req\\.)",
  "i",
);
const sqlInterpolationPattern = new RegExp("\\b(?:SELECT|INSERT|UPDATE|DELETE)\\b[^\\n]*\\$\\{", "i");

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseRecord(value: unknown): JsonRecord {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readString(source: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function readNumber(source: JsonRecord, key: string, fallback: number, min: number, max: number) {
  const parsed = Number(source[key]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function readStringList(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) {
    const items = value.map(String).map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? items : fallback;
  }
  if (typeof value === "string" && value.trim()) {
    const items = value.split(",").map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? items : fallback;
  }
  return fallback;
}

function normalizeRepoValue(value: string) {
  return value
    .replace(/\\/g, "/")
    .replace(/\.git$/i, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^ssh:\/\/git@/i, "")
    .replace(/^git@/i, "")
    .replace(/:/g, "/")
    .toLowerCase();
}

function resolveTaskWorktreePath(context: JsonRecord) {
  const taskRun = isRecord(context.taskRun) ? context.taskRun : {};
  const output = isRecord(taskRun.outputPayload) ? taskRun.outputPayload : {};
  const worktree = isRecord(output.taskWorktree) ? output.taskWorktree : {};
  return readString(worktree, "path");
}

async function resolveScanRoot(input: JsonRecord, ctx: PluginRuntimeContext) {
  const explicitPath = readString(input, "workspacePath", "workspace_path", "repositoryPath", "repository_path", "path");
  if (explicitPath) return explicitPath;

  const context = await ctx.readTaskContext();
  const worktreePath = resolveTaskWorktreePath(context);
  if (worktreePath) return worktreePath;

  const repositoryUrl = readString(input, "repositoryUrl", "repository_url", "repo_url");
  if (repositoryUrl && fs.existsSync(path.join(path.resolve(repositoryUrl), ".git"))) {
    return repositoryUrl;
  }

  return "";
}

function shouldScanFile(filePath: string, extensions: Set<string>) {
  return extensions.has(path.extname(filePath));
}

function walkFiles(root: string, options: { extensions: Set<string>; maxFiles: number }) {
  const output: string[] = [];
  const stack = [root];

  while (stack.length > 0 && output.length < options.maxFiles) {
    const current = stack.pop();
    if (!current) continue;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(current);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      if (ignoredDirectories.has(path.basename(current))) continue;
      for (const child of fs.readdirSync(current)) stack.push(path.join(current, child));
      continue;
    }

    if (stat.isFile() && shouldScanFile(current, options.extensions)) output.push(current);
  }

  return output;
}

function lineThresholdFor(filePath: string, defaults: JsonRecord) {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.startsWith("src/locales/")) return readNumber(defaults, "locales", 2500, 100, 20_000);
  if (normalized.startsWith("src/server/")) return readNumber(defaults, "server", 1400, 100, 20_000);
  if (normalized.startsWith("src/components/")) return readNumber(defaults, "components", 900, 100, 20_000);
  if (normalized.startsWith("src/app/")) return readNumber(defaults, "app", 650, 100, 20_000);
  return readNumber(defaults, "default", 900, 100, 20_000);
}

function pushFinding(findings: CleanCodeFinding[], finding: CleanCodeFinding, maxFindings: number) {
  if (findings.length < maxFindings) findings.push(finding);
}

export function scanCleanCodeFindings(args: {
  root: string;
  extensions?: string[];
  maxFiles?: number;
  maxFindings?: number;
  lineThresholds?: JsonRecord;
}) {
  const root = path.resolve(args.root);
  const extensions = new Set(args.extensions?.length ? args.extensions : [...defaultExtensions]);
  const maxFiles = Math.max(1, Math.min(args.maxFiles ?? 800, 5_000));
  const maxFindings = Math.max(1, Math.min(args.maxFindings ?? 80, 500));
  const files = walkFiles(root, { extensions, maxFiles });
  const findings: CleanCodeFinding[] = [];

  for (const file of files) {
    if (findings.length >= maxFindings) break;
    const relativePath = path.relative(root, file).replace(/\\/g, "/");
    let content = "";
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    const threshold = lineThresholdFor(relativePath, args.lineThresholds ?? {});
    if (lines.length > threshold) {
      pushFinding(
        findings,
        {
          ruleId: "cleancode.large_file",
          category: "cleancode",
          severity: "medium",
          title: uiText("softwareTeam.cleanCode.rules.largeFile.title"),
          description: uiText("softwareTeam.cleanCode.rules.largeFile.description", undefined, {
            filePath: relativePath,
            lineCount: lines.length,
            threshold,
          }),
          recommendation: uiText("softwareTeam.cleanCode.rules.largeFile.recommendation"),
          filePath: relativePath,
          lineNumber: null,
          evidenceLine: "",
        },
        maxFindings,
      );
    }

    for (const [lineIndex, rawLine] of lines.entries()) {
      if (findings.length >= maxFindings) break;
      const line = rawLine.trim();
      const lineNumber = lineIndex + 1;
      if (todoMarkerPattern.test(rawLine)) {
        pushFinding(
          findings,
          {
            ruleId: "cleancode.todo_marker",
            category: "cleancode",
            severity: "low",
            title: uiText("softwareTeam.cleanCode.rules.todo.title"),
            description: uiText("softwareTeam.cleanCode.rules.todo.description", undefined, {
              filePath: relativePath,
              lineNumber,
            }),
            recommendation: uiText("softwareTeam.cleanCode.rules.todo.recommendation"),
            filePath: relativePath,
            lineNumber,
            evidenceLine: line,
          },
          maxFindings,
        );
      }

      if (looseTypePattern.test(rawLine)) {
        pushFinding(
          findings,
          {
            ruleId: "cleancode.any_type",
            category: "cleancode",
            severity: "medium",
            title: uiText("softwareTeam.cleanCode.rules.anyType.title"),
            description: uiText("softwareTeam.cleanCode.rules.anyType.description", undefined, {
              filePath: relativePath,
              lineNumber,
            }),
            recommendation: uiText("softwareTeam.cleanCode.rules.anyType.recommendation"),
            filePath: relativePath,
            lineNumber,
            evidenceLine: line,
          },
          maxFindings,
        );
      }

      if (lintDisablePattern.test(rawLine)) {
        pushFinding(
          findings,
          {
            ruleId: "cleancode.eslint_disable",
            category: "cleancode",
            severity: "medium",
            title: uiText("softwareTeam.cleanCode.rules.eslintDisable.title"),
            description: uiText("softwareTeam.cleanCode.rules.eslintDisable.description", undefined, {
              filePath: relativePath,
              lineNumber,
            }),
            recommendation: uiText("softwareTeam.cleanCode.rules.eslintDisable.recommendation"),
            filePath: relativePath,
            lineNumber,
            evidenceLine: line,
          },
          maxFindings,
        );
      }
    }
  }

  return {
    root,
    scannedFiles: files.length,
    findings,
  };
}

export function scanCodeShieldFindings(args: {
  root: string;
  extensions?: string[];
  maxFiles?: number;
  maxFindings?: number;
}) {
  const root = path.resolve(args.root);
  const extensions = new Set(args.extensions?.length ? args.extensions : [...defaultExtensions]);
  const maxFiles = Math.max(1, Math.min(args.maxFiles ?? 800, 5_000));
  const maxFindings = Math.max(1, Math.min(args.maxFindings ?? 80, 500));
  const files = walkFiles(root, { extensions, maxFiles });
  const findings: CleanCodeFinding[] = [];

  for (const file of files) {
    if (findings.length >= maxFindings) break;
    const relativePath = path.relative(root, file).replace(/\\/g, "/");
    let content = "";
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (const [lineIndex, rawLine] of lines.entries()) {
      if (findings.length >= maxFindings) break;
      const line = rawLine.trim();
      const lineNumber = lineIndex + 1;

      if (secretAssignmentPattern.test(rawLine)) {
        pushFinding(
          findings,
          {
            ruleId: "code_shield.secret_like_assignment",
            category: "security",
            severity: "high",
            title: uiText("softwareTeam.codeShield.rules.secret.title"),
            description: uiText("softwareTeam.codeShield.rules.secret.description", undefined, {
              filePath: relativePath,
              lineNumber,
            }),
            recommendation: uiText("softwareTeam.codeShield.rules.secret.recommendation"),
            filePath: relativePath,
            lineNumber,
            evidenceLine: line,
          },
          maxFindings,
        );
      }

      if (dynamicCodePattern.test(rawLine)) {
        pushFinding(
          findings,
          {
            ruleId: "code_shield.dynamic_code_execution",
            category: "security",
            severity: "high",
            title: uiText("softwareTeam.codeShield.rules.dynamicCode.title"),
            description: uiText("softwareTeam.codeShield.rules.dynamicCode.description", undefined, {
              filePath: relativePath,
              lineNumber,
            }),
            recommendation: uiText("softwareTeam.codeShield.rules.dynamicCode.recommendation"),
            filePath: relativePath,
            lineNumber,
            evidenceLine: line,
          },
          maxFindings,
        );
      }

      if (shellInputPattern.test(rawLine)) {
        pushFinding(
          findings,
          {
            ruleId: "code_shield.shell_input_execution",
            category: "security",
            severity: "medium",
            title: uiText("softwareTeam.codeShield.rules.shellInput.title"),
            description: uiText("softwareTeam.codeShield.rules.shellInput.description", undefined, {
              filePath: relativePath,
              lineNumber,
            }),
            recommendation: uiText("softwareTeam.codeShield.rules.shellInput.recommendation"),
            filePath: relativePath,
            lineNumber,
            evidenceLine: line,
          },
          maxFindings,
        );
      }

      if (sqlInterpolationPattern.test(rawLine)) {
        pushFinding(
          findings,
          {
            ruleId: "code_shield.sql_interpolation",
            category: "security",
            severity: "medium",
            title: uiText("softwareTeam.codeShield.rules.sqlInterpolation.title"),
            description: uiText("softwareTeam.codeShield.rules.sqlInterpolation.description", undefined, {
              filePath: relativePath,
              lineNumber,
            }),
            recommendation: uiText("softwareTeam.codeShield.rules.sqlInterpolation.recommendation"),
            filePath: relativePath,
            lineNumber,
            evidenceLine: line,
          },
          maxFindings,
        );
      }
    }
  }

  return {
    root,
    scannedFiles: files.length,
    findings,
  };
}

async function runCleanCodeLocalScan(input: JsonRecord, ctx: PluginRuntimeContext) {
  const root = await resolveScanRoot(input, ctx);
  if (!root) {
    return {
      status: "drafted",
      reason: uiText("softwareTeam.cleanCode.errors.workspaceMissing"),
      createdCount: 0,
      findings: [],
    };
  }

  const resolvedRoot = path.resolve(root);
  if (!fs.existsSync(resolvedRoot)) {
    return {
      status: "drafted",
      reason: uiText("softwareTeam.cleanCode.errors.workspaceNotFound", undefined, { path: resolvedRoot }),
      createdCount: 0,
      findings: [],
    };
  }

  await ctx.requestPermission({ resource: "repo.read", scope: resolvedRoot });
  const lineThresholds = parseRecord(input.lineThresholds);
  const scan = scanCleanCodeFindings({
    root: resolvedRoot,
    extensions: readStringList(input.extensions, [...defaultExtensions]),
    maxFiles: readNumber(input, "maxFiles", 800, 1, 5_000),
    maxFindings: readNumber(input, "maxFindings", 80, 1, 500),
    lineThresholds,
  });
  const repoId = readString(input, "repo_id", "repositoryName", "repository_name", "codebase_name") ||
    normalizeRepoValue(resolvedRoot);
  const created = [];

  for (const finding of scan.findings) {
    const findingId = await ctx.createFinding({
      sourceAgent: "software-team-cleancode",
      category: finding.category,
      severity: finding.severity,
      confidence: 0.88,
      title: finding.title,
      description: finding.description,
      recommendation: finding.recommendation,
      evidence: {
        repo_id: repoId,
        repository_path: resolvedRoot,
        file_path: finding.filePath,
        line_start: finding.lineNumber,
        matched_line: finding.evidenceLine,
        rule_id: finding.ruleId,
      },
      fingerprint: [
        "cleancode",
        repoId,
        finding.filePath,
        finding.lineNumber ?? 0,
        finding.ruleId,
        finding.evidenceLine,
      ].join(":"),
      skillRefs: ["cleancode"],
      knowledgeRefs: ["cleancode"],
    });
    created.push({
      findingId,
      ruleId: finding.ruleId,
      filePath: finding.filePath,
      line: finding.lineNumber,
      severity: finding.severity,
    });
  }

  await ctx.emitEvent({
    type: "cleancode_scan_completed",
    payload: {
      title: uiText("softwareTeam.cleanCode.events.completedTitle"),
      root: resolvedRoot,
      scannedFiles: scan.scannedFiles,
      findingCount: created.length,
    },
  });

  return {
    status: "completed",
    root: resolvedRoot,
    scannedFiles: scan.scannedFiles,
    createdCount: created.length,
    findings: created,
  };
}

async function runCodeShieldLocalScan(input: JsonRecord, ctx: PluginRuntimeContext) {
  const root = await resolveScanRoot(input, ctx);
  if (!root) {
    return {
      status: "drafted",
      reason: uiText("softwareTeam.codeShield.errors.workspaceMissing"),
      createdCount: 0,
      findings: [],
    };
  }

  const resolvedRoot = path.resolve(root);
  if (!fs.existsSync(resolvedRoot)) {
    return {
      status: "drafted",
      reason: uiText("softwareTeam.codeShield.errors.workspaceNotFound", undefined, { path: resolvedRoot }),
      createdCount: 0,
      findings: [],
    };
  }

  await ctx.requestPermission({ resource: "repo.read", scope: resolvedRoot });
  const scan = scanCodeShieldFindings({
    root: resolvedRoot,
    extensions: readStringList(input.extensions, [...defaultExtensions]),
    maxFiles: readNumber(input, "maxFiles", 800, 1, 5_000),
    maxFindings: readNumber(input, "maxFindings", 80, 1, 500),
  });
  const repoId = readString(input, "repo_id", "repositoryName", "repository_name", "codebase_name") ||
    normalizeRepoValue(resolvedRoot);
  const created = [];

  for (const finding of scan.findings) {
    const findingId = await ctx.createFinding({
      sourceAgent: "software-team-code-shield",
      category: finding.category,
      severity: finding.severity,
      confidence: 0.9,
      title: finding.title,
      description: finding.description,
      recommendation: finding.recommendation,
      evidence: {
        repo_id: repoId,
        repository_path: resolvedRoot,
        file_path: finding.filePath,
        line_start: finding.lineNumber,
        matched_line: finding.evidenceLine,
        rule_id: finding.ruleId,
      },
      fingerprint: [
        "code_shield",
        repoId,
        finding.filePath,
        finding.lineNumber ?? 0,
        finding.ruleId,
        finding.evidenceLine,
      ].join(":"),
      skillRefs: ["security", "code_shield"],
      knowledgeRefs: ["security", "code_shield"],
    });
    created.push({
      findingId,
      ruleId: finding.ruleId,
      filePath: finding.filePath,
      line: finding.lineNumber,
      severity: finding.severity,
    });
  }

  await ctx.emitEvent({
    type: "code_shield_scan_completed",
    payload: {
      title: uiText("softwareTeam.codeShield.events.completedTitle"),
      root: resolvedRoot,
      scannedFiles: scan.scannedFiles,
      findingCount: created.length,
    },
  });

  return {
    status: "completed",
    root: resolvedRoot,
    scannedFiles: scan.scannedFiles,
    createdCount: created.length,
    findings: created,
  };
}

const toolBundle: ExecutableToolBundle = {
  id: "official.software_team.tool_bundle",
  tools: [
    {
      id: "software_team.cleancode.local_scan",
      title: uiText("softwareTeam.tools.cleanCodeLocalScan.title"),
      description: uiText("softwareTeam.tools.cleanCodeLocalScan.description"),
    },
    {
      id: "software_team.code_shield.local_scan",
      title: uiText("softwareTeam.tools.codeShieldLocalScan.title"),
      description: uiText("softwareTeam.tools.codeShieldLocalScan.description"),
    },
  ],
  async executeTool(toolId, input, ctx) {
    if (toolId === "software_team.cleancode.local_scan") {
      return runCleanCodeLocalScan(input, ctx);
    }
    if (toolId === "software_team.code_shield.local_scan") {
      return runCodeShieldLocalScan(input, ctx);
    }
    throw new Error(uiText("softwareTeam.errors.unsupportedTool", undefined, { toolId }));
  },
};

export const softwareTeamExecutablePlugin: ExecutablePluginModule = {
  manifest: {
    apiVersion: "agentworld.io/v1",
    kind: "AgentWorldPlugin",
    metadata: {
      id: "official.software_team",
      name: uiText("softwareTeam.plugin.name"),
      version: "1.0.0",
      description: uiText("softwareTeam.plugin.description"),
    },
    spec: {
      runtime: {
        type: "node",
        entry: "src/server/plugins/official/software-team.ts",
      },
      permissions: {
        requested: ["repo.read", "tool.finding.create"],
      },
      contributions: {
        toolBundles: [{ id: toolBundle.id }],
      },
    },
  },
  toolBundles: [toolBundle],
};
