import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type TextContent } from "@earendil-works/pi-ai";
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
      execute: async (_toolCallId, params, signal) => {
        const input = params as { query: string; glob?: string; limit?: number };
        return executeGuarded("search_repo", async () => {
          const args = ["-n", "--hidden", "--max-count", String(input.limit ?? 20)];
          if (input.glob) args.push("-g", input.glob);
          args.push(input.query, workspaceRoot);
          const { stdout } = await execFileAsync("rg", args, { signal });
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
      execute: async (_toolCallId, params, signal) => {
        const input = params as { path: string; startLine?: number; endLine?: number };
        return executeGuarded("read_file", async () => {
          const targetPath = input.path.startsWith("/")
            ? input.path
            : `${workspaceRoot}/${input.path}`;
          const { stdout } = await execFileAsync(
            "sed",
            [
              "-n",
              `${input.startLine ?? 1},${input.endLine ?? Math.max((input.startLine ?? 1) + 120, 160)}p`,
              targetPath,
            ],
            { signal },
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
      execute: async (_toolCallId, params, signal) => {
        const input = params as { path?: string };
        return executeGuarded("list_dir", async () => {
          const targetPath = input.path ? `${workspaceRoot}/${input.path}` : workspaceRoot;
          const { stdout } = await execFileAsync("ls", ["-la", targetPath], { signal });
          return {
            content: buildTextBlocks(stdout.trim()),
            details: { path: targetPath },
          };
        });
      },
    },
  ];
}
