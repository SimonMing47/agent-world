import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type TextContent } from "@earendil-works/pi-ai";
import { readKnowledgeContent, searchKnowledgeEntries } from "@/server/knowledge-engine";
import { uiText } from "@/lib/language-pack";

const execFileAsync = promisify(execFile);

function buildTextBlocks(text: string): TextContent[] {
  return [{ type: "text", text }];
}

function maskToken(value: string) {
  if (value.length <= 8) return "[REDACTED]";
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

function redactSensitiveText(value: string) {
  return value
    .replace(
      /((?:API|ACCESS|AUTH|TOKEN|SECRET|PASSWORD|PRIVATE|KEY)[A-Z0-9_ -]*\s*[:=]\s*)([^\s"']+)/gim,
      (_match, prefix: string, secret: string) => `${prefix}${maskToken(secret)}`,
    )
    .replace(
      /-----BEGIN [^-]+-----[\s\S]+?-----END [^-]+-----/g,
      "[REDACTED KEY MATERIAL]",
    )
    .replace(/\b[a-z0-9]{24,}\.[A-Za-z0-9._-]{12,}\b/g, (match) => maskToken(match))
    .replace(/\bsk-[A-Za-z0-9]{16,}\b/g, (match) => maskToken(match));
}

function resolveWorkspacePath(workspaceRoot: string, requestedPath?: string) {
  const rootPath = path.resolve(workspaceRoot);
  const targetPath = path.resolve(rootPath, requestedPath || ".");
  const relativePath = path.relative(rootPath, targetPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Path is outside workspace: ${requestedPath || "."}`);
  }
  return targetPath;
}

function normalizeMemoryLevels(levels: unknown) {
  if (!Array.isArray(levels)) return undefined;
  const normalized = levels
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value === "L0" || value === "L1" || value === "L2")
    .filter((value, index, array) => array.indexOf(value) === index);
  return normalized.length ? (normalized as Array<"L0" | "L1" | "L2">) : undefined;
}

function parseKnowledgeCategories(value: unknown) {
  if (!value) return undefined;
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [value];
  const normalized = values
    .flatMap((item) => (typeof item === "string" ? item.split(",") : []))
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item === "public" || item === "domain" || item === "repository");
  return [...new Set(normalized)];
}

function parseRepositoryNames(value: unknown) {
  if (!value) return undefined;
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [value];
  const normalized = values
    .flatMap((item) => (typeof item === "string" ? item.split(",") : []))
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.toLowerCase());
  return [...new Set(normalized)];
}

function normalizeMemoryLevel(level: string | undefined) {
  if (level === "L0" || level === "L1" || level === "L2") return level;
  return "L2";
}

function normalizeKnowledgeLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return undefined;
  return Math.max(1, Math.min(parsed, 64));
}

function normalizeBooleanFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return undefined;
}

export type WorkspaceToolPolicy = {
  approvalMode?: "allow" | "ask" | "deny" | "manual";
  allowedToolNames?: string[];
  deniedToolNames?: string[];
};

export function buildReadOnlyWorkspaceTools(
  workspaceRoot: string,
  policy: WorkspaceToolPolicy = {},
): AgentTool[] {
  const approvalMode = policy.approvalMode ?? "allow";
  const allowedToolNames =
    policy.allowedToolNames && policy.allowedToolNames.length > 0
      ? new Set(policy.allowedToolNames)
      : null;
  const deniedToolNames = new Set(policy.deniedToolNames ?? []);
  const blockedMessage =
    approvalMode === "deny"
      ? uiText("ui.generated.c5c42d9c8cb")
      : uiText("ui.generated.cf7631103d5");

  const guardTool = (toolName: string) => {
    if (approvalMode !== "allow") {
      return blockedMessage;
    }
    if (deniedToolNames.has(toolName)) {
      return uiText("ui.server.tools.harnessBlocked", undefined, { toolName });
    }
    if (allowedToolNames && !allowedToolNames.has(toolName)) {
      return uiText("ui.server.tools.harnessNotAllowed", undefined, { toolName });
    }
    return null;
  };

  const executeGuarded = async <T extends { content: TextContent[]; details?: Record<string, unknown> }>(
    toolName: string,
    fn: () => Promise<T>,
  ) => {
    const blocked = guardTool(toolName);
    if (blocked) {
      return { content: buildTextBlocks(blocked), details: { blocked: true, toolName } };
    }
    return fn();
  };

  return [
    {
      name: "search_repo",
      label: "Search Repo",
      description: "Search the current workspace with ripgrep.",
      parameters: Type.Object({
        query: Type.String(),
        glob: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
      }),
      execute: async (_toolCallId, params, _signal) => {
        const input = params as { query: string; glob?: string; limit?: number };
        return executeGuarded("search_repo", async () => {
          const args = ["-n", "--hidden", "--max-count", String(input.limit ?? 20)];
          if (input.glob) args.push("-g", input.glob);
          args.push(input.query, workspaceRoot);
          const { stdout } = await execFileAsync("rg", args, { signal: _signal });
          return {
            content: buildTextBlocks(redactSensitiveText(stdout.trim() || "No matches.")),
            details: { matchCount: stdout.split("\n").filter(Boolean).length },
          };
        });
      },
    },
    {
      name: "read_file",
      label: "Read File",
      description: "Read a text file from the workspace.",
      parameters: Type.Object({
        path: Type.String(),
        startLine: Type.Optional(Type.Number({ minimum: 1 })),
        endLine: Type.Optional(Type.Number({ minimum: 1 })),
      }),
      execute: async (_toolCallId, params, _signal) => {
        const input = params as { path: string; startLine?: number; endLine?: number };
        return executeGuarded("read_file", async () => {
          const targetPath = resolveWorkspacePath(workspaceRoot, input.path);
          const { stdout } = await execFileAsync(
            "sed",
            [
              "-n",
              `${input.startLine ?? 1},${input.endLine ?? Math.max((input.startLine ?? 1) + 120, 160)}p`,
              targetPath,
            ],
            { signal: _signal },
          );
          return {
            content: buildTextBlocks(redactSensitiveText(stdout.trim() || "File is empty.")),
            details: { path: targetPath },
          };
        });
      },
    },
    {
      name: "list_dir",
      label: "List Directory",
      description: "List files in the workspace.",
      parameters: Type.Object({
        path: Type.Optional(Type.String()),
      }),
      execute: async (_toolCallId, params, _signal) => {
        const input = params as { path?: string };
        return executeGuarded("list_dir", async () => {
          const targetPath = resolveWorkspacePath(workspaceRoot, input.path);
          const { stdout } = await execFileAsync("ls", ["-la", targetPath], { signal: _signal });
          return {
            content: buildTextBlocks(stdout.trim()),
            details: { path: targetPath },
          };
        });
      },
    },
    {
      name: "memory.search",
      label: "Search Knowledge",
      description: "Search the knowledge base with optional filters.",
      parameters: Type.Object({
        query: Type.String(),
        knowledgeSpaceIds: Type.Optional(Type.Array(Type.String())),
        scopeUris: Type.Optional(Type.Array(Type.String())),
        knowledgeCategories: Type.Optional(Type.Array(Type.String())),
        repositoryNames: Type.Optional(Type.Array(Type.String())),
        levels: Type.Optional(Type.Array(Type.String())),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 64 })),
        includeOutboundUris: Type.Optional(Type.Boolean()),
      }),
      execute: async (_toolCallId, params) => {
        const input = params as {
          query: string;
          knowledgeSpaceIds?: string[];
          scopeUris?: string[];
          knowledgeCategories?: unknown;
          repositoryNames?: unknown;
          levels?: unknown;
          limit?: unknown;
          includeOutboundUris?: unknown;
        };
        return executeGuarded("memory.search", async () => {
          const query = input.query.trim();
          const result = searchKnowledgeEntries({
            query,
          knowledgeSpaceIds: input.knowledgeSpaceIds?.filter(Boolean),
          scopeUris: input.scopeUris?.filter(Boolean),
          knowledgeCategories: parseKnowledgeCategories(input.knowledgeCategories),
          repositoryNames: parseRepositoryNames(input.repositoryNames),
          levels: normalizeMemoryLevels(input.levels),
            limit: normalizeKnowledgeLimit(input.limit),
            includeOutboundUris: normalizeBooleanFlag(input.includeOutboundUris),
          });
          return {
            content: buildTextBlocks(JSON.stringify(result, null, 2)),
            details: {
              query: result.query,
              totalEntries: result.totalEntries,
              totalCandidates: result.totalCandidates,
              hitCount: result.hits.length,
            },
          };
        });
      },
    },
    {
      name: "memory.retrieve",
      label: "Search Knowledge (Legacy)",
      description: "Compatibility alias for memory.search.",
      parameters: Type.Object({
        query: Type.String(),
        knowledgeSpaceIds: Type.Optional(Type.Array(Type.String())),
        scopeUris: Type.Optional(Type.Array(Type.String())),
        knowledgeCategories: Type.Optional(Type.Array(Type.String())),
        repositoryNames: Type.Optional(Type.Array(Type.String())),
        levels: Type.Optional(Type.Array(Type.String())),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 64 })),
        includeOutboundUris: Type.Optional(Type.Boolean()),
      }),
      execute: async (_toolCallId, params) => {
        const input = params as {
          query: string;
          knowledgeSpaceIds?: string[];
          scopeUris?: string[];
          knowledgeCategories?: unknown;
          repositoryNames?: unknown;
          levels?: unknown;
          limit?: unknown;
          includeOutboundUris?: unknown;
        };
        return executeGuarded("memory.retrieve", async () => {
          const query = input.query.trim();
          const result = searchKnowledgeEntries({
            query,
          knowledgeSpaceIds: input.knowledgeSpaceIds?.filter(Boolean),
          scopeUris: input.scopeUris?.filter(Boolean),
          knowledgeCategories: parseKnowledgeCategories(input.knowledgeCategories),
          repositoryNames: parseRepositoryNames(input.repositoryNames),
          levels: normalizeMemoryLevels(input.levels),
            limit: normalizeKnowledgeLimit(input.limit),
            includeOutboundUris: normalizeBooleanFlag(input.includeOutboundUris),
          });
          return {
            content: buildTextBlocks(JSON.stringify(result, null, 2)),
            details: {
              query: result.query,
              totalEntries: result.totalEntries,
              totalCandidates: result.totalCandidates,
              hitCount: result.hits.length,
            },
          };
        });
      },
    },
    {
      name: "memory.read",
      label: "Read Knowledge",
      description: "Read a knowledge URI at L0/L1/L2 level.",
      parameters: Type.Object({
        uri: Type.String(),
        level: Type.Optional(Type.String()),
      }),
      execute: async (_toolCallId, params) => {
        const input = params as { uri?: string; level?: string };
        return executeGuarded("memory.read", async () => {
          const uri = (input.uri ?? "").trim();
          const level = normalizeMemoryLevel(input.level);
          const content = await readKnowledgeContent(uri, level);
          return {
            content: buildTextBlocks(content),
            details: {
              uri,
              level,
              contentLength: content.length,
            },
          };
        });
      },
    },
  ];
}
