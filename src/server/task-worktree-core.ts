import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
  execute,
  queryAll,
  queryOne,
  type CodebaseProfile,
  type TaskBlueprint,
  type TaskRun,
} from "@/server/db";
import { appendTaskRunEvent } from "@/server/task-run-event-store";
import { uiText } from "@/lib/language-pack";

const execFileAsync = promisify(execFile);

type JsonRecord = Record<string, unknown>;

export type TaskWorktreePolicy = {
  enabled: boolean;
  baseDir: string;
  cleanupOnComplete: boolean;
  cloneDepth: number;
  failureMode: "degrade" | "fail";
};

export type TaskWorktreeState = {
  status: "prepared" | "skipped" | "failed" | "cleaned";
  codebaseId?: string | null;
  repositoryUrl?: string | null;
  branch?: string | null;
  ref?: string | null;
  path?: string | null;
  strategy?: "local_worktree" | "remote_clone" | "metadata_only";
  error?: string | null;
  preparedAt?: string;
  cleanedAt?: string;
};

const outputKey = "taskWorktree";

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseRecord(value: string | null | undefined): JsonRecord {
  try {
    const parsed = JSON.parse(value ?? "{}") as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readString(source: JsonRecord, key: string, fallback = "") {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readBoolean(source: JsonRecord, key: string, fallback: boolean) {
  return typeof source[key] === "boolean" ? source[key] : fallback;
}

function readNumber(source: JsonRecord, key: string, fallback: number, min: number, max: number) {
  const value = Number(source[key]);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function readFirstString(source: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function normalizeRepoValue(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/\.git$/i, "")
    .replace(/^ssh:\/\/git@/i, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^git@/i, "")
    .replace(/:/g, "/")
    .toLowerCase();
}

export function resolveTaskWorktreePolicy(blueprint: TaskBlueprint | null): TaskWorktreePolicy {
  const executionPolicy = parseRecord(blueprint?.executionPolicyJson);
  const worktree = isRecord(executionPolicy.worktree) ? executionPolicy.worktree : {};
  const failureMode = worktree.failureMode === "fail" ? "fail" : "degrade";
  return {
    enabled: readBoolean(worktree, "enabled", false),
    baseDir: readString(worktree, "baseDir", "data/worktrees"),
    cleanupOnComplete: readBoolean(worktree, "cleanupOnComplete", true),
    cloneDepth: readNumber(worktree, "cloneDepth", 1, 1, 50),
    failureMode,
  };
}

function taskRunInput(taskRun: TaskRun) {
  return parseRecord(taskRun.inputPayloadJson);
}

export function resolveTaskRunCodebase(taskRun: TaskRun) {
  const input = taskRunInput(taskRun);
  const explicitId = readFirstString(input, ["codebase_id", "codebaseId"]);
  if (explicitId) {
    const codebase = queryOne<CodebaseProfile>(
      "SELECT * FROM codebase_profiles WHERE id = ? AND status <> 'deleted'",
      explicitId,
    );
    if (codebase) return codebase;
  }

  const repoCandidates = [
    readFirstString(input, ["repo_url", "repositoryUrl", "repository_url"]),
    readFirstString(input, ["repo_id", "repositoryName", "repository_name"]),
  ]
    .map(normalizeRepoValue)
    .filter(Boolean);
  if (repoCandidates.length === 0) return null;

  return (
    queryAll<CodebaseProfile>("SELECT * FROM codebase_profiles WHERE status <> 'deleted'")
      .find((codebase) => {
        const values = [
          normalizeRepoValue(codebase.repositoryUrl),
          normalizeRepoValue(codebase.name),
        ].filter(Boolean);
        return repoCandidates.some((candidate) =>
          values.some((value) => value === candidate || value.endsWith(`/${candidate}`) || candidate.endsWith(`/${value}`)),
        );
      }) ?? null
  );
}

export function attachRegisteredCodebaseToInput(input: JsonRecord) {
  const codebase = resolveTaskRunCodebase({
    inputPayloadJson: JSON.stringify(input),
  } as TaskRun);
  if (!codebase) return input;
  return {
    ...input,
    codebase_id: codebase.id,
    codebase_name: codebase.name,
    codebase_provider: codebase.provider,
    repository_url: codebase.repositoryUrl,
    repository_default_branch: codebase.defaultBranch,
  };
}

function mergeOutputPayload(taskRun: TaskRun, next: JsonRecord) {
  const current = parseRecord(taskRun.outputPayloadJson);
  execute(
    "UPDATE task_runs SET output_payload_json = ? WHERE id = ?",
    JSON.stringify({ ...current, ...next }, null, 2),
    taskRun.id,
  );
}

function ensureInsideBase(baseDir: string, targetPath: string) {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  const relative = path.relative(base, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Worktree path escapes configured base directory.");
  }
}

function localGitRoot(repositoryUrl: string) {
  if (!repositoryUrl || /^https?:\/\//i.test(repositoryUrl) || /^ssh:\/\//i.test(repositoryUrl) || /^git@/i.test(repositoryUrl)) {
    return null;
  }
  const resolved = path.resolve(repositoryUrl);
  return fs.existsSync(path.join(resolved, ".git")) ? resolved : null;
}

async function runGit(args: string[], cwd?: string) {
  const result = await execFileAsync("git", args, {
    cwd,
    timeout: 120_000,
    maxBuffer: 1024 * 1024 * 8,
  });
  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}

function refForTask(taskRun: TaskRun, codebase: CodebaseProfile) {
  const input = taskRunInput(taskRun);
  return readFirstString(input, ["diff_ref", "source_commit_sha", "commitSha"]) || codebase.defaultBranch;
}

export async function prepareTaskWorktree(args: {
  taskRun: TaskRun;
  blueprint: TaskBlueprint | null;
}) {
  const policy = resolveTaskWorktreePolicy(args.blueprint);
  if (!policy.enabled) return null;
  const currentOutput = parseRecord(args.taskRun.outputPayloadJson);
  const existing = isRecord(currentOutput[outputKey]) ? (currentOutput[outputKey] as TaskWorktreeState) : null;
  if (existing?.status === "prepared" || existing?.status === "skipped") return existing;

  const codebase = resolveTaskRunCodebase(args.taskRun);
  if (!codebase) {
    const skipped: TaskWorktreeState = {
      status: "skipped",
      strategy: "metadata_only",
      error: "No registered codebase matched this task input.",
    };
    mergeOutputPayload(args.taskRun, { [outputKey]: skipped });
    appendTaskRunEvent({
      traceId: args.taskRun.traceId,
      taskRunId: args.taskRun.id,
      phase: "worktree.skipped",
      foldGroup: "Execution",
      title: uiText("taskWorktree.events.skippedTitle"),
      content: uiText("taskWorktree.events.noCodebase"),
      metadata: skipped,
    });
    return skipped;
  }

  const baseDir = path.resolve(policy.baseDir);
  const targetPath = path.join(baseDir, args.taskRun.id);
  ensureInsideBase(baseDir, targetPath);
  fs.mkdirSync(baseDir, { recursive: true });
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }

  const ref = refForTask(args.taskRun, codebase);
  const branch = codebase.defaultBranch;
  const localRoot = localGitRoot(codebase.repositoryUrl);
  try {
    if (localRoot) {
      await runGit(["worktree", "add", "--detach", targetPath, ref], localRoot);
    } else {
      await runGit([
        "clone",
        "--depth",
        String(policy.cloneDepth),
        "--branch",
        branch,
        codebase.repositoryUrl,
        targetPath,
      ]);
      if (ref && ref !== branch) {
        await runGit(["checkout", ref], targetPath);
      }
    }
    const prepared: TaskWorktreeState = {
      status: "prepared",
      codebaseId: codebase.id,
      repositoryUrl: codebase.repositoryUrl,
      branch,
      ref,
      path: targetPath,
      strategy: localRoot ? "local_worktree" : "remote_clone",
      preparedAt: new Date().toISOString(),
    };
    mergeOutputPayload(args.taskRun, { [outputKey]: prepared });
    appendTaskRunEvent({
      traceId: args.taskRun.traceId,
      taskRunId: args.taskRun.id,
      phase: "worktree.prepared",
      foldGroup: "Execution",
      title: uiText("taskWorktree.events.preparedTitle"),
      content: targetPath,
      metadata: prepared,
    });
    return prepared;
  } catch (error) {
    const failed: TaskWorktreeState = {
      status: "failed",
      codebaseId: codebase.id,
      repositoryUrl: codebase.repositoryUrl,
      branch,
      ref,
      path: targetPath,
      strategy: localRoot ? "local_worktree" : "remote_clone",
      error: error instanceof Error ? error.message : "Failed to prepare worktree.",
    };
    mergeOutputPayload(args.taskRun, { [outputKey]: failed });
    appendTaskRunEvent({
      traceId: args.taskRun.traceId,
      taskRunId: args.taskRun.id,
      phase: policy.failureMode === "fail" ? "worktree.failed" : "worktree.degraded",
      foldGroup: "Execution",
      title: uiText("taskWorktree.events.failedTitle"),
      content: failed.error ?? "",
      metadata: failed,
    });
    if (policy.failureMode === "fail") throw error;
    return failed;
  }
}

export async function cleanupTaskWorktree(args: {
  taskRun: TaskRun;
  blueprint: TaskBlueprint | null;
}) {
  const policy = resolveTaskWorktreePolicy(args.blueprint);
  if (!policy.cleanupOnComplete) return null;
  const currentOutput = parseRecord(args.taskRun.outputPayloadJson);
  const state = isRecord(currentOutput[outputKey]) ? (currentOutput[outputKey] as TaskWorktreeState) : null;
  if (!state?.path || state.status !== "prepared") return state;

  try {
    ensureInsideBase(path.resolve(policy.baseDir), state.path);
    if (state.strategy === "local_worktree" && state.repositoryUrl) {
      const localRoot = localGitRoot(state.repositoryUrl);
      if (localRoot) {
        await runGit(["worktree", "remove", "--force", state.path], localRoot);
      } else {
        fs.rmSync(state.path, { recursive: true, force: true });
      }
    } else {
      fs.rmSync(state.path, { recursive: true, force: true });
    }
    const cleaned: TaskWorktreeState = {
      ...state,
      status: "cleaned",
      cleanedAt: new Date().toISOString(),
    };
    mergeOutputPayload(args.taskRun, { [outputKey]: cleaned });
    appendTaskRunEvent({
      traceId: args.taskRun.traceId,
      taskRunId: args.taskRun.id,
      phase: "worktree.cleaned",
      foldGroup: "Execution",
      title: uiText("taskWorktree.events.cleanedTitle"),
      content: state.path,
      metadata: cleaned,
    });
    return cleaned;
  } catch (error) {
    appendTaskRunEvent({
      traceId: args.taskRun.traceId,
      taskRunId: args.taskRun.id,
      phase: "worktree.cleanup_failed",
      foldGroup: "Execution",
      title: uiText("taskWorktree.events.cleanupFailedTitle"),
      content: error instanceof Error ? error.message : "Failed to clean worktree.",
      metadata: state,
    });
    return state;
  }
}
