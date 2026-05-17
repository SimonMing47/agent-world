import { type ExecutionEnvironment, type TaskBlueprint } from "@/server/db";

function parseRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function maskSecretRef(secretRef: string) {
  if (!secretRef) return "";
  const [prefix, rest] = secretRef.split(":", 2);
  if (!rest) return "secret:****";
  const tail = rest.split("/").pop() ?? "secret";
  return `${prefix}:****/${tail}`;
}

export function buildEnvironmentSnapshotPayload(args: {
  taskRunId: string;
  blueprint: TaskBlueprint;
  environment: ExecutionEnvironment | null;
  inputPayload: Record<string, unknown>;
}) {
  const environmentSelector = parseRecord(args.blueprint.environmentSelectorJson);
  const environmentSandbox = args.environment ? parseRecord(args.environment.sandboxProfileJson) : {};
  const sandbox = {
    ...environmentSandbox,
    mode: environmentSelector.sandboxMode ?? environmentSandbox.mode ?? "inherit",
    ref: environmentSelector.sandboxRef ?? null,
  };
  const memoryLayerRefs = args.environment ? parseArray(args.environment.memoryLayerRefsJson) : [];
  const repoId = String(args.inputPayload.repo_id ?? args.inputPayload.repository ?? args.environment?.repositoryName ?? "");
  const branch = String(args.inputPayload.target_branch ?? args.inputPayload.branch ?? args.environment?.defaultBranch ?? "");
  const commitSha = String(
    args.inputPayload.source_commit_sha ??
      args.inputPayload.commit_sha ??
      args.inputPayload.commitSha ??
      "unresolved",
  );

  return {
    taskRunId: args.taskRunId,
    blueprintId: args.blueprint.id,
    blueprintVersion: args.blueprint.version,
    environmentSelector,
    repository: {
      provider: args.environment?.repositoryProvider ?? environmentSelector.repositoryProvider ?? "plugin",
      binding: environmentSelector.repoBinding ?? null,
      repoId,
      name: args.environment?.repositoryName ?? repoId,
      url: args.environment?.repositoryUrl ?? null,
      branch,
      commitSha,
      diffRef: args.inputPayload.diff_ref ?? args.inputPayload.diffRef ?? null,
      checkoutMode: environmentSelector.checkoutMode ?? "full_clone",
    },
    executor: {
      identity: args.environment?.executorRef ?? environmentSelector.executorIdentity ?? "system",
      privateKeyRef: args.environment ? maskSecretRef(args.environment.privateKeyRef) : null,
      rawSecretReadable: false,
    },
    workspace: {
      id: `workspace:${args.taskRunId}`,
      path:
        typeof environmentSelector.executionPath === "string" && environmentSelector.executionPath.trim()
          ? environmentSelector.executionPath
          : args.environment?.workingDirectory ?? ".",
      snapshotKind: "environment_snapshot",
    },
    sandbox,
    memoryLayerRefs,
    providerAdapterId: args.blueprint.providerAdapterId,
    capturedAt: new Date().toISOString(),
  };
}
