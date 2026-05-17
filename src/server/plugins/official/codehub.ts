import {
  type ExecutableOutputPublisher,
  type ExecutablePluginModule,
  type ExecutableRepositoryConnector,
  type ExecutableToolBundle,
  type ExecutableWebhookParser,
} from "@/server/plugin-sdk-core";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPath(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const part of path) {
    if (!isRecord(current)) return null;
    current = current[part];
  }
  return current;
}

function firstString(value: unknown, paths: string[][]) {
  for (const path of paths) {
    const candidate = readPath(value, path);
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number") return String(candidate);
  }
  return null;
}

async function requestJson(args: {
  baseUrl: string;
  token: string;
  path: string;
  method?: string;
  body?: Record<string, unknown>;
}) {
  const response = await fetch(new URL(args.path, args.baseUrl), {
    method: args.method ?? "GET",
    headers: {
      "PRIVATE-TOKEN": args.token,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(
      `CodeHub request failed: ${response.status} ${response.statusText} ${typeof payload === "string" ? payload : JSON.stringify(payload)}`,
    );
  }

  return payload;
}

async function resolveCodeHubConfig(input: Record<string, unknown>) {
  const baseUrl =
    typeof input.baseUrl === "string" && input.baseUrl
      ? input.baseUrl
      : process.env.CODEHUB_HOST ?? "";
  const tokenRef =
    typeof input.tokenRef === "string" && input.tokenRef
      ? input.tokenRef
      : "env:CODEHUB_TOKEN";
  const token = tokenRef.startsWith("env:") ? process.env[tokenRef.slice(4)] ?? null : null;

  if (!baseUrl) throw new Error("CodeHub baseUrl 未配置。");
  if (!token) throw new Error(`CodeHub token 未配置：${tokenRef}`);

  return { baseUrl, token };
}

const repositoryConnector: ExecutableRepositoryConnector = {
  id: "official.codehub.repository",
  async getProject(input) {
    const config = await resolveCodeHubConfig(input);
    const projectId = encodeURIComponent(String(input.projectId ?? input.project_id ?? ""));
    return (await requestJson({
      ...config,
      path: `/api/v4/projects/${projectId}`,
    })) as Record<string, unknown>;
  },
  async compare(input) {
    const config = await resolveCodeHubConfig(input);
    const projectId = encodeURIComponent(String(input.projectId ?? input.project_id ?? ""));
    const from = encodeURIComponent(String(input.fromRef ?? input.from_ref ?? ""));
    const to = encodeURIComponent(String(input.toRef ?? input.to_ref ?? ""));
    return (await requestJson({
      ...config,
      path: `/api/v4/projects/${projectId}/repository/compare?from=${from}&to=${to}&compare_type=${encodeURIComponent(String(input.compareType ?? input.compare_type ?? "branch"))}`,
    })) as Record<string, unknown>;
  },
  async getMergeRequestChanges(input) {
    const config = await resolveCodeHubConfig(input);
    const projectId = encodeURIComponent(String(input.projectId ?? input.project_id ?? ""));
    const mrIid = encodeURIComponent(String(input.mergeRequestIid ?? input.merge_request_iid ?? input.mr_iid ?? ""));
    return (await requestJson({
      ...config,
      path: `/api/v4/projects/${projectId}/merge_requests/${mrIid}/changes?exclude_sub_mr=true&ignore_whitespace_change=false&view=simple&filters=diffs`,
    })) as Record<string, unknown>;
  },
  async getRepoFile(input) {
    const config = await resolveCodeHubConfig(input);
    const projectId = encodeURIComponent(String(input.projectId ?? input.project_id ?? ""));
    const ref = encodeURIComponent(String(input.ref ?? ""));
    const filePath = encodeURIComponent(String(input.filePath ?? input.file_path ?? ""));
    return (await requestJson({
      ...config,
      path: `/api/v4/projects/${projectId}/repository/files?ref=${ref}&file_path=${filePath}`,
    })) as Record<string, unknown>;
  },
  async merge(input) {
    const config = await resolveCodeHubConfig(input);
    const projectId = encodeURIComponent(String(input.projectId ?? input.project_id ?? ""));
    const mrIid = encodeURIComponent(String(input.mergeRequestIid ?? input.merge_request_iid ?? input.mr_iid ?? ""));
    return (await requestJson({
      ...config,
      path: `/api/v4/projects/${projectId}/merge_requests/${mrIid}/merge`,
      method: "PUT",
      body: isRecord(input.body) ? input.body : {},
    })) as Record<string, unknown>;
  },
};

const webhookParser: ExecutableWebhookParser = {
  id: "official.codehub.webhook.merge_request",
  async verify(args) {
    const secretRef =
      typeof args.configuration?.webhookSecretRef === "string"
        ? String(args.configuration.webhookSecretRef)
        : "env:CODEHUB_WEBHOOK_SECRET";
    const expected = await args.resolveSecretRef(secretRef);
    if (!expected) return;

    const provided =
      args.request.headers.get("x-agentworld-webhook-secret") ??
      args.request.headers.get("x-webhook-secret") ??
      args.request.headers.get("x-hook-secret");

    if (provided !== expected) {
      throw new Error("CodeHub webhook secret mismatch.");
    }
  },
  async parse(args) {
    const payload = args.payload;
    const sourceCommitSha =
      firstString(payload, [
        ["object_attributes", "last_commit", "id"],
        ["object_attributes", "source_branch_sha"],
        ["after"],
        ["source_commit_sha"],
      ]) ?? null;

    return {
      webhook_path_key: args.pathKey,
      event_name:
        args.request.headers.get("x-codehub-event") ??
        firstString(payload, [["event_type"], ["event"], ["object_kind"]]) ??
        "merge_request",
      received_at: new Date().toISOString(),
      repo_id:
        firstString(payload, [
          ["project", "path_with_namespace"],
          ["project", "id"],
          ["repository", "name"],
          ["repo_id"],
        ]) ?? "unknown-repository",
      repo_url:
        firstString(payload, [
          ["project", "git_http_url"],
          ["project", "http_url"],
          ["repository", "clone_url"],
        ]) ?? null,
      project_id:
        firstString(payload, [["project", "id"], ["project_id"]]) ?? null,
      mr_id:
        firstString(payload, [
          ["object_attributes", "iid"],
          ["merge_request", "iid"],
          ["mr_id"],
        ]) ?? null,
      mr_title:
        firstString(payload, [
          ["object_attributes", "title"],
          ["merge_request", "title"],
          ["title"],
        ]) ?? null,
      diff_ref: sourceCommitSha ?? firstString(payload, [["diff_ref"]]) ?? null,
      source_commit_sha: sourceCommitSha,
      diff_refs: {
        base_sha:
          firstString(payload, [["object_attributes", "diff_refs", "base_sha"], ["diff_refs", "base_sha"]]) ??
          null,
        start_sha:
          firstString(payload, [["object_attributes", "diff_refs", "start_sha"], ["diff_refs", "start_sha"]]) ??
          null,
        head_sha:
          firstString(payload, [["object_attributes", "diff_refs", "head_sha"], ["diff_refs", "head_sha"]]) ??
          null,
      },
      author:
        firstString(payload, [["user", "username"], ["user", "name"], ["author"], ["sender", "login"]]) ??
        "webhook",
      target_branch:
        firstString(payload, [["object_attributes", "target_branch"], ["target_branch"]]) ?? null,
      source_branch:
        firstString(payload, [["object_attributes", "source_branch"], ["source_branch"]]) ?? null,
      raw_payload: payload,
    };
  },
  buildIdempotencyKey(input) {
    return [
      String(input.repo_id ?? "unknown"),
      String(input.mr_id ?? "unknown"),
      String(input.diff_ref ?? "unknown"),
    ].join(":");
  },
};

const outputPublisher: ExecutableOutputPublisher = {
  id: "official.codehub.publisher.merge_request_review",
  async publish(input) {
    const projectIdValue = String(input.projectId ?? input.project_id ?? "");
    const mrIidValue = String(input.mergeRequestIid ?? input.merge_request_iid ?? input.mr_iid ?? "");
    const body = isRecord(input.body) ? input.body : { body: String(input.comment ?? "") };
    if (!projectIdValue || !mrIidValue) {
      return {
        publicationStatus: "drafted",
        reason: "CodeHub projectId or mergeRequestIid is missing.",
        body,
      };
    }

    let config: { baseUrl: string; token: string };
    try {
      config = await resolveCodeHubConfig(input);
    } catch (error) {
      return {
        publicationStatus: "drafted",
        reason: error instanceof Error ? error.message : "CodeHub credentials are not configured.",
        projectId: projectIdValue,
        mergeRequestIid: mrIidValue,
        body,
      };
    }

    const projectId = encodeURIComponent(projectIdValue);
    const mrIid = encodeURIComponent(mrIidValue);
    return (await requestJson({
      ...config,
      path: `/api/v4/projects/${projectId}/merge_requests/${mrIid}/discussions`,
      method: "POST",
      body,
    })) as Record<string, unknown>;
  },
};

const toolBundle: ExecutableToolBundle = {
  id: "official.codehub.tool_bundle",
  tools: [
    {
      id: "codehub.project.get",
      title: "获取项目信息",
      description: "读取 CodeHub 项目元数据。",
    },
    {
      id: "codehub.merge_request.changes",
      title: "获取 MR 变更",
      description: "读取 Merge Request 变更详情。",
    },
    {
      id: "codehub.merge_request.review.publish",
      title: "发布 MR 审查评论",
      description: "向 Merge Request 写入普通评论或行级评论。",
    },
  ],
  async executeTool(toolId, input, ctx) {
    if (toolId === "codehub.project.get") {
      return repositoryConnector.getProject?.(input, ctx) ?? {};
    }
    if (toolId === "codehub.merge_request.changes") {
      return repositoryConnector.getMergeRequestChanges?.(input, ctx) ?? {};
    }
    if (toolId === "codehub.merge_request.review.publish") {
      return outputPublisher.publish(input, ctx);
    }
    throw new Error(`Unsupported CodeHub tool: ${toolId}`);
  },
};

export const codehubExecutablePlugin: ExecutablePluginModule = {
  manifest: {
    apiVersion: "agentworld.io/v1",
    kind: "AgentWorldPlugin",
    metadata: {
      id: "official.codehub",
      name: "CodeHub Connector",
      version: "1.0.0",
      description: "Repository connector, webhook parser, publisher and tool bundle for CodeHub API v4.",
    },
    spec: {
      runtime: {
        type: "node",
        entry: "src/server/plugins/official/codehub.ts",
      },
      permissions: {
        requested: [
          "repo.read",
          "repo.mr.comment",
          "webhook.receive",
          "secret.use",
        ],
      },
      contributions: {
        repositoryConnectors: [{ id: repositoryConnector.id }],
        webhookParsers: [{ id: webhookParser.id }],
        outputPublishers: [{ id: outputPublisher.id }],
        toolBundles: [{ id: toolBundle.id }],
      },
      configSchema: {
        type: "object",
        properties: {
          baseUrl: { type: "string" },
          tokenRef: { type: "string" },
          webhookSecretRef: { type: "string" },
        },
        required: ["baseUrl", "tokenRef"],
      },
    },
  },
  repositoryConnectors: [repositoryConnector],
  webhookParsers: [webhookParser],
  outputPublishers: [outputPublisher],
  toolBundles: [toolBundle],
};
