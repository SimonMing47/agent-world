import {
  type ExecutableOutputPublisher,
  type ExecutablePluginModule,
  type ExecutableRepositoryConnector,
  type ExecutableToolBundle,
  type ExecutableWebhookParser,
  type PluginRuntimeContext,
} from "@/server/plugin-sdk-core";
import { uiText } from "@/lib/language-pack";

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

function stringInput(input: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function parseOwnerRepo(input: Record<string, unknown>) {
  const owner = stringInput(input, "owner", "repoOwner", "repo_owner", "repositoryOwner", "repository_owner");
  const repo = stringInput(input, "repo", "repoName", "repo_name", "repositoryName", "repository_name");
  if (owner && repo) return { owner, repo };

  const repoId = stringInput(input, "repo_id", "repoId", "repository", "repositoryFullName", "repository_full_name");
  const [repoOwner, repoName] = repoId.split("/");
  if (repoOwner && repoName) return { owner: repoOwner, repo: repoName };

  const repoUrl = stringInput(input, "repo_url", "repoUrl", "repositoryUrl", "repository_url");
  try {
    const url = new URL(repoUrl);
    const parts = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
    if (parts.length >= 2) return { owner: parts.at(-2) ?? "", repo: parts.at(-1) ?? "" };
  } catch {
    // Keep returning the empty shape below.
  }
  return { owner: "", repo: "" };
}

async function requestJson(args: {
  baseUrl: string;
  token?: string | null;
  path: string;
  method?: string;
  body?: Record<string, unknown>;
}) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=UTF-8",
  };
  if (args.token) headers.Authorization = `token ${args.token}`;

  const response = await fetch(new URL(args.path, args.baseUrl), {
    method: args.method ?? "GET",
    headers,
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
      `Gitea request failed: ${response.status} ${response.statusText} ${typeof payload === "string" ? payload : JSON.stringify(payload)}`,
    );
  }

  return isRecord(payload) ? payload : { value: payload };
}

async function resolveGiteaConfig(input: Record<string, unknown>, ctx?: PluginRuntimeContext) {
  const contextConfiguration = isRecord(ctx?.configuration) ? ctx.configuration : {};
  const baseUrl =
    stringInput(input, "baseUrl", "base_url") ||
    stringInput(contextConfiguration, "baseUrl", "base_url") ||
    "";
  const tokenRef =
    stringInput(input, "tokenRef", "token_ref") ||
    stringInput(contextConfiguration, "tokenRef", "token_ref");
  if (tokenRef.toLowerCase().startsWith("env:")) {
    throw new Error(uiText("pluginSdk.errors.envSecretRefUnsupported"));
  }
  const token = tokenRef ? (ctx ? await ctx.resolveSecretRef(tokenRef) : tokenRef) : null;

  if (!baseUrl) throw new Error(uiText("gitea.errors.baseUrlMissing"));
  return { baseUrl, token };
}

function requireGiteaToken(config: Awaited<ReturnType<typeof resolveGiteaConfig>>) {
  if (!config.token) throw new Error(uiText("gitea.errors.tokenMissing"));
  return { baseUrl: config.baseUrl, token: config.token };
}

async function ensurePermission(ctx: PluginRuntimeContext, resource: string, scope?: string) {
  const decision = await ctx.requestPermission({ resource, scope });
  if (decision.effect === "deny") {
    throw new Error(decision.reason ?? uiText("gitea.errors.permissionDenied"));
  }
  if (decision.effect === "ask") {
    throw new Error(decision.reason ?? uiText("gitea.errors.permissionApprovalRequired"));
  }
}

function commentBody(input: Record<string, unknown>) {
  return isRecord(input.body) ? input.body : { body: String(input.comment ?? "") };
}

function readWebhookSharedSecret(request: Request) {
  const explicit =
    request.headers.get("x-agentworld-webhook-secret") ??
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-hook-secret");
  if (explicit) return explicit;

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return bearer;
  return authorization || null;
}

function normalizePublishedCommentRef(payload: Record<string, unknown>) {
  return {
    id: payload.id ?? payload.commentId ?? null,
    url: payload.html_url ?? payload.url ?? null,
    body: payload.body ?? null,
  };
}

function pathForContent(filePath: string) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function compileRuleRegex(pattern: unknown) {
  if (typeof pattern !== "string" || !pattern.trim()) return null;
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

function decodeRepoContent(payload: Record<string, unknown>) {
  const content = typeof payload.content === "string" ? payload.content : "";
  if (!content.trim()) return "";
  try {
    return Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf8");
  } catch {
    return "";
  }
}

async function readPullRequestFilesWithContent(args: {
  owner: string;
  repo: string;
  pullIndex: string;
  config: { baseUrl: string; token: string };
}) {
  const pull = await requestJson({
    ...args.config,
    path: `/api/v1/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}/pulls/${encodeURIComponent(args.pullIndex)}`,
  });
  const head = isRecord(pull.head) ? pull.head : {};
  const headSha = stringInput(head, "sha", "ref") || stringInput(pull, "head_sha");
  const filesPayload = await requestJson({
    ...args.config,
    path: `/api/v1/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}/pulls/${encodeURIComponent(args.pullIndex)}/files`,
  });
  const files = Array.isArray(filesPayload.value) ? filesPayload.value : Array.isArray(filesPayload) ? filesPayload : [];
  const records = files.filter(isRecord);
  const output = [];
  for (const file of records) {
    const filename = stringInput(file, "filename", "name", "path");
    if (!filename) continue;
    let content = "";
    if (headSha) {
      try {
        const contentPayload = await requestJson({
          ...args.config,
          path: `/api/v1/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}/contents/${pathForContent(filename)}?ref=${encodeURIComponent(headSha)}`,
        });
        content = decodeRepoContent(contentPayload);
      } catch {
        content = "";
      }
    }
    output.push({
      filename,
      status: stringInput(file, "status"),
      additions: Number(file.additions ?? 0),
      deletions: Number(file.deletions ?? 0),
      changes: Number(file.changes ?? 0),
      htmlUrl: stringInput(file, "html_url"),
      rawUrl: stringInput(file, "raw_url"),
      content,
    });
  }
  return { headSha, files: output };
}

function firstMatchingLine(content: string, regex: RegExp | null, includesAny: string[]) {
  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (regex?.test(line)) return { line: index + 1, text: line.trim() };
    if (includesAny.some((needle) => line.includes(needle))) return { line: index + 1, text: line.trim() };
  }
  return null;
}

function contentMatchesRule(args: {
  content: string;
  lineRegex: RegExp | null;
  contentRegex: RegExp | null;
  includesAll: string[];
  includesAny: string[];
}) {
  if (args.includesAll.length > 0 && !args.includesAll.every((needle) => args.content.includes(needle))) {
    return null;
  }
  if (args.contentRegex && !args.contentRegex.test(args.content)) {
    return null;
  }
  if (args.lineRegex || args.includesAny.length > 0) {
    return firstMatchingLine(args.content, args.lineRegex, args.includesAny);
  }
  if (args.includesAll.length > 0 || args.contentRegex) {
    return { line: 1, text: "" };
  }
  return null;
}

async function scanPullRequestByRules(input: Record<string, unknown>, ctx: PluginRuntimeContext) {
  const { owner, repo } = parseOwnerRepo(input);
  const pullIndex = stringInput(input, "pullRequestIndex", "pull_request_index", "pullRequestIid", "pr_id", "mr_id");
  if (!owner || !repo || !pullIndex) {
    return {
      status: "drafted",
      reason: uiText("gitea.errors.pullRequestTargetMissing"),
      createdCount: 0,
      findings: [],
    };
  }

  await ensurePermission(ctx, "repo.read", `${owner}/${repo}:${pullIndex}`);
  const config = await resolveGiteaConfig(input, ctx);
  if (!config.token) {
    return {
      status: "drafted",
      reason: uiText("gitea.errors.tokenMissing"),
      createdCount: 0,
      findings: [],
    };
  }

  const contextConfiguration = isRecord(ctx.configuration) ? ctx.configuration : {};
  const rules = Array.isArray(input.rules)
    ? input.rules.filter(isRecord)
    : Array.isArray(contextConfiguration.skillRules)
      ? contextConfiguration.skillRules.filter(isRecord)
      : [];
  const { headSha, files } = await readPullRequestFilesWithContent({
    owner,
    repo,
    pullIndex,
    config: requireGiteaToken(config),
  });
  const created = [];
  for (const rule of rules) {
    const pathRegex = compileRuleRegex(rule.pathRegex ?? rule.filePathRegex);
    const lineRegex = compileRuleRegex(rule.lineRegex ?? rule.anyLineRegex);
    const contentRegex = compileRuleRegex(rule.contentRegex);
    const includesAll = parseStringArray(rule.includesAll ?? rule.allIncludes ?? rule.allLineIncludes);
    const includesAny = parseStringArray(rule.includesAny ?? rule.anyIncludes ?? rule.anyLineIncludes);
    const skillRefs = parseStringArray(rule.knowledgeRefs ?? rule.skillRefs);

    for (const file of files) {
      if (pathRegex && !pathRegex.test(file.filename)) continue;
      const match = contentMatchesRule({
        content: file.content,
        lineRegex,
        contentRegex,
        includesAll,
        includesAny,
      });
      if (!match) continue;

      const ruleId = stringInput(rule, "id", "ruleId") || "gitea-rule";
      const title = stringInput(rule, "title") || uiText("gitea.ruleScan.defaultTitle", undefined, { ruleId });
      const findingId = await ctx.createFinding({
        sourceAgent: stringInput(rule, "sourceAgent") || "gitea-rule-scan",
        category: stringInput(rule, "category") || "code_review",
        severity: stringInput(rule, "severity") || "medium",
        confidence: Number(rule.confidence ?? 0.9),
        title,
        description: stringInput(rule, "description") || title,
        recommendation: stringInput(rule, "recommendation"),
        knowledgeRefs: skillRefs,
        skillRefs,
        evidence: {
          repo_id: `${owner}/${repo}`,
          pull_request_index: pullIndex,
          commit_sha: headSha,
          file_path: file.filename,
          line_start: match.line,
          matched_line: match.text,
          rule_id: ruleId,
          file_status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          url: file.htmlUrl,
        },
        fingerprint: [`${owner}/${repo}`, pullIndex, headSha, file.filename, match.line, ruleId].join(":"),
      });
      created.push({
        findingId,
        ruleId,
        title,
        filePath: file.filename,
        line: match.line,
      });
      if (rule.oncePerRule !== false) break;
    }
  }

  await ctx.emitEvent({
    type: "gitea_rule_scan_completed",
    payload: {
      title: uiText("gitea.ruleScan.completedTitle"),
      owner,
      repo,
      pullRequestIndex: pullIndex,
      ruleCount: rules.length,
      fileCount: files.length,
      findingCount: created.length,
    },
  });

  return {
    status: "completed",
    owner,
    repo,
    pullRequestIndex: pullIndex,
    headSha,
    fileCount: files.length,
    ruleCount: rules.length,
    createdCount: created.length,
    findings: created,
  };
}

const repositoryConnector: ExecutableRepositoryConnector = {
  id: "official.gitea.repository",
  async getProject(input, ctx) {
    const { owner, repo } = parseOwnerRepo(input);
    await ensurePermission(ctx, "repo.read", `${owner}/${repo}`);
    const config = await resolveGiteaConfig(input, ctx);
    return requestJson({
      ...requireGiteaToken(config),
      path: `/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    });
  },
  async getMergeRequestChanges(input, ctx) {
    const { owner, repo } = parseOwnerRepo(input);
    const pullIndex = stringInput(input, "pullRequestIndex", "pull_request_index", "pullRequestIid", "pr_id", "mr_id");
    await ensurePermission(ctx, "repo.read", `${owner}/${repo}:${pullIndex}`);
    const config = await resolveGiteaConfig(input, ctx);
    return requestJson({
      ...requireGiteaToken(config),
      path: `/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${encodeURIComponent(pullIndex)}/files`,
    });
  },
};

const webhookParser: ExecutableWebhookParser = {
  id: "official.gitea.webhook.pull_request",
  async verify(args) {
    const secretRef = (
      typeof args.configuration?.webhookSecretRef === "string"
        ? String(args.configuration.webhookSecretRef)
        : ""
    ).trim();
    if (!secretRef) {
      throw new Error(uiText("gitea.errors.webhookSecretMissing"));
    }
    const expected = await args.resolveSecretRef(secretRef);
    if (!expected) {
      throw new Error(uiText("gitea.errors.webhookSecretMissing"));
    }

    const provided = readWebhookSharedSecret(args.request);
    if (provided !== expected) {
      throw new Error(uiText("gitea.errors.webhookSecretMismatch"));
    }
  },
  async parse(args) {
    const payload = args.payload;
    const owner = firstString(payload, [["repository", "owner", "login"], ["repository", "owner", "username"]]);
    const repo = firstString(payload, [["repository", "name"]]);
    const repoId =
      firstString(payload, [["repository", "full_name"], ["repository", "fullName"]]) ??
      [owner, repo].filter(Boolean).join("/") ??
      "unknown-repository";
    const pullIndex =
      firstString(payload, [["pull_request", "number"], ["pull_request", "id"], ["number"], ["issue", "number"]]) ??
      null;

    return {
      webhook_path_key: args.pathKey,
      event_name:
        args.request.headers.get("x-gitea-event") ??
        firstString(payload, [["event_type"], ["action"]]) ??
        "pull_request",
      received_at: new Date().toISOString(),
      repo_id: repoId,
      repo_url:
        firstString(payload, [["repository", "clone_url"], ["repository", "html_url"], ["repository", "ssh_url"]]) ??
        null,
      repository_owner: owner ?? null,
      repository_name: repo ?? null,
      pull_request_index: pullIndex,
      pr_id: pullIndex,
      issue_iid: pullIndex,
      mr_id: pullIndex,
      pr_title:
        firstString(payload, [["pull_request", "title"], ["issue", "title"], ["title"]]) ?? null,
      diff_ref:
        firstString(payload, [["pull_request", "head", "sha"], ["after"], ["pull_request", "merge_base"]]) ??
        null,
      source_commit_sha:
        firstString(payload, [["pull_request", "head", "sha"], ["after"]]) ?? null,
      author:
        firstString(payload, [["sender", "login"], ["sender", "username"], ["pull_request", "user", "login"]]) ??
        "webhook",
      target_branch:
        firstString(payload, [["pull_request", "base", "ref"], ["pull_request", "base", "name"]]) ?? null,
      source_branch:
        firstString(payload, [["pull_request", "head", "ref"], ["pull_request", "head", "name"]]) ?? null,
      raw_payload: payload,
    };
  },
  buildIdempotencyKey(input) {
    return [
      String(input.repo_id ?? "unknown"),
      String(input.pr_id ?? input.pull_request_index ?? "unknown"),
      String(input.diff_ref ?? "unknown"),
    ].join(":");
  },
};

const issueCommentPublisher: ExecutableOutputPublisher = {
  id: "official.gitea.publisher.issue_comment",
  async publish(input, ctx) {
    const { owner, repo } = parseOwnerRepo(input);
    const issueIndex = stringInput(input, "issueIid", "issue_iid", "issueIndex", "issue_index", "issueId", "issue_id");
    const body = commentBody(input);
    if (!owner || !repo || !issueIndex) {
      return {
        publicationStatus: "drafted",
        reason: uiText("gitea.errors.issueTargetMissing"),
        body,
      };
    }

    await ensurePermission(ctx, "repo.issue.comment", `${owner}/${repo}:${issueIndex}`);
    const config = await resolveGiteaConfig(input, ctx);
    if (!config.token) {
      return {
        publicationStatus: "drafted",
        reason: uiText("gitea.errors.tokenMissing"),
        body,
      };
    }

    const commentId = stringInput(input, "commentId", "comment_id", "noteId", "note_id");
    const payload = await requestJson({
      ...requireGiteaToken(config),
      path: commentId
        ? `/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/comments/${encodeURIComponent(commentId)}`
        : `/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(issueIndex)}/comments`,
      method: commentId ? "PATCH" : "POST",
      body,
    });
    return {
      ...payload,
      publicationStatus: "published",
      externalComment: normalizePublishedCommentRef(payload),
      externalTarget: {
        type: "issue",
        owner,
        repo,
        issueIndex,
      },
    };
  },
};

const pullRequestCommentPublisher: ExecutableOutputPublisher = {
  id: "official.gitea.publisher.pull_request_comment",
  publish(input, ctx) {
    return issueCommentPublisher.publish(
      {
        ...input,
        issueIid:
          input.issueIid ??
          input.issue_iid ??
          input.pullRequestIndex ??
          input.pull_request_index ??
          input.pullRequestIid ??
          input.pr_id ??
          input.mr_id,
      },
      ctx,
    );
  },
};

const toolBundle: ExecutableToolBundle = {
  id: "official.gitea.tool_bundle",
  tools: [
    {
      id: "gitea.repository.get",
      title: uiText("gitea.tools.repositoryGet.title"),
      description: uiText("gitea.tools.repositoryGet.description"),
    },
    {
      id: "gitea.pull_request.files",
      title: uiText("gitea.tools.pullRequestFiles.title"),
      description: uiText("gitea.tools.pullRequestFiles.description"),
    },
    {
      id: "gitea.pull_request.comment.publish",
      title: uiText("gitea.tools.pullRequestComment.title"),
      description: uiText("gitea.tools.pullRequestComment.description"),
    },
    {
      id: "gitea.issue.comment.publish",
      title: uiText("gitea.tools.issueComment.title"),
      description: uiText("gitea.tools.issueComment.description"),
    },
    {
      id: "gitea.pull_request.rule_scan",
      title: uiText("gitea.tools.pullRequestRuleScan.title"),
      description: uiText("gitea.tools.pullRequestRuleScan.description"),
    },
  ],
  async executeTool(toolId, input, ctx) {
    if (toolId === "gitea.repository.get") {
      return repositoryConnector.getProject?.(input, ctx) ?? {};
    }
    if (toolId === "gitea.pull_request.files") {
      return repositoryConnector.getMergeRequestChanges?.(input, ctx) ?? {};
    }
    if (toolId === "gitea.pull_request.comment.publish") {
      return pullRequestCommentPublisher.publish(input, ctx);
    }
    if (toolId === "gitea.issue.comment.publish") {
      return issueCommentPublisher.publish(input, ctx);
    }
    if (toolId === "gitea.pull_request.rule_scan") {
      return scanPullRequestByRules(input, ctx);
    }
    throw new Error(uiText("gitea.errors.unsupportedTool", undefined, { toolId }));
  },
};

export const giteaExecutablePlugin: ExecutablePluginModule = {
  manifest: {
    apiVersion: "agentworld.io/v1",
    kind: "AgentWorldPlugin",
    metadata: {
      id: "official.gitea",
      name: "Gitea Connector",
      version: "1.0.0",
      description: "Repository connector, webhook parser, publisher and tool bundle for the Gitea API.",
    },
    spec: {
      runtime: {
        type: "node",
        entry: "src/server/plugins/official/gitea.ts",
      },
      permissions: {
        requested: ["repo.read", "repo.issue.comment", "webhook.receive", "secret.use", "tool.finding.create"],
      },
      contributions: {
        repositoryConnectors: [{ id: repositoryConnector.id }],
        webhookParsers: [{ id: webhookParser.id }],
        outputPublishers: [{ id: pullRequestCommentPublisher.id }, { id: issueCommentPublisher.id }],
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
  outputPublishers: [pullRequestCommentPublisher, issueCommentPublisher],
  toolBundles: [toolBundle],
};
