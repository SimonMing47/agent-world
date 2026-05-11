import { randomBytes, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  execute,
  queryAll,
  queryOne,
  type CodeReviewSkill,
  type MergeRequestReview,
  type ReviewFinding,
  type WebhookEndpoint,
} from "@/server/db";
import { writeLayeredKnowledge } from "@/server/openviking-core";

const execFileAsync = promisify(execFile);

type JsonRecord = Record<string, unknown>;

type MergeRequestContext = {
  platform: string;
  repositorySlug: string;
  repositoryCloneUrl: string | null;
  mrIid: string;
  mrTitle: string;
  mrUrl: string | null;
  sourceBranch: string | null;
  targetBranch: string | null;
  commitSha: string | null;
  author: string | null;
  diffUrl: string | null;
  commentApiUrl: string | null;
};

type DiffBundle = {
  diff: string;
  status: string;
  error?: string;
};

type DiffStats = {
  changedFiles: string[];
  additions: number;
  deletions: number;
  totalLines: number;
};

type FindingDraft = {
  skillId: string;
  knowledgeLayer: string;
  severity: "info" | "low" | "medium" | "high";
  filePath: string | null;
  lineNumber: number | null;
  title: string;
  body: string;
  suggestion: string | null;
};

type FindingResult = FindingDraft & {
  id: string;
  feedbackToken: string;
  correctUrl: string;
  incorrectUrl: string;
};

type CommentPostResult = {
  status: string;
  url: string | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPath(value: unknown, pathParts: string[]) {
  let current: unknown = value;
  for (const part of pathParts) {
    if (!isRecord(current)) return null;
    current = current[part];
  }

  return current;
}

function firstString(value: unknown, paths: string[][]) {
  for (const pathParts of paths) {
    const candidate = readPath(value, pathParts);
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number") return String(candidate);
  }

  return null;
}

function parseJsonObject<T extends JsonRecord>(json: string, fallback: T): T {
  try {
    const parsed = JSON.parse(json);
    return isRecord(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalizePlatform(payload: unknown) {
  const explicit = firstString(payload, [["platform"], ["object_kind"]]);
  if (explicit?.toLowerCase().includes("merge_request")) return "gitlab";
  if (firstString(payload, [["pull_request", "html_url"]])) return "github";
  if (firstString(payload, [["mergeRequest", "url"], ["merge_request", "url"]])) return "generic";
  return explicit?.toLowerCase() ?? "generic";
}

function parseMergeRequestContext(payload: unknown): MergeRequestContext {
  const platform = normalizePlatform(payload);

  if (platform === "github") {
    const issueUrl = firstString(payload, [["pull_request", "issue_url"]]);
    return {
      platform,
      repositorySlug:
        firstString(payload, [["repository", "full_name"], ["repository", "name"], ["repository"]]) ??
        "unknown-repository",
      repositoryCloneUrl:
        firstString(payload, [["repository", "clone_url"], ["repository", "ssh_url"], ["repositoryCloneUrl"]]) ??
        null,
      mrIid: firstString(payload, [["pull_request", "number"], ["number"]]) ?? "unknown",
      mrTitle: firstString(payload, [["pull_request", "title"], ["title"]]) ?? "Untitled merge request",
      mrUrl: firstString(payload, [["pull_request", "html_url"], ["url"]]),
      sourceBranch: firstString(payload, [["pull_request", "head", "ref"], ["sourceBranch"]]),
      targetBranch: firstString(payload, [["pull_request", "base", "ref"], ["targetBranch"]]),
      commitSha: firstString(payload, [["pull_request", "head", "sha"], ["after"], ["commitSha"]]),
      author: firstString(payload, [["pull_request", "user", "login"], ["sender", "login"], ["author"]]),
      diffUrl: firstString(payload, [["pull_request", "diff_url"], ["diffUrl"]]),
      commentApiUrl:
        firstString(payload, [["agentworld", "commentApiUrl"], ["review", "commentApiUrl"], ["commentApiUrl"]]) ??
        (issueUrl ? `${issueUrl}/comments` : null),
    };
  }

  if (platform === "gitlab") {
    return {
      platform,
      repositorySlug:
        firstString(payload, [
          ["project", "path_with_namespace"],
          ["project", "name"],
          ["repository", "name"],
          ["repository"],
        ]) ?? "unknown-repository",
      repositoryCloneUrl:
        firstString(payload, [
          ["project", "git_http_url"],
          ["project", "http_url"],
          ["repository", "git_http_url"],
          ["repositoryCloneUrl"],
        ]) ?? null,
      mrIid:
        firstString(payload, [["object_attributes", "iid"], ["object_attributes", "id"], ["mergeRequest", "iid"]]) ??
        "unknown",
      mrTitle:
        firstString(payload, [["object_attributes", "title"], ["mergeRequest", "title"], ["title"]]) ??
        "Untitled merge request",
      mrUrl: firstString(payload, [["object_attributes", "url"], ["mergeRequest", "url"], ["url"]]),
      sourceBranch: firstString(payload, [["object_attributes", "source_branch"], ["sourceBranch"]]),
      targetBranch: firstString(payload, [["object_attributes", "target_branch"], ["targetBranch"]]),
      commitSha: firstString(payload, [["object_attributes", "last_commit", "id"], ["commitSha"]]),
      author: firstString(payload, [["user", "username"], ["user", "name"], ["author"]]),
      diffUrl: firstString(payload, [["object_attributes", "diff_url"], ["diffUrl"]]),
      commentApiUrl: firstString(payload, [["agentworld", "commentApiUrl"], ["review", "commentApiUrl"], ["commentApiUrl"]]),
    };
  }

  return {
    platform,
    repositorySlug:
      firstString(payload, [
        ["repository", "full_name"],
        ["repository", "name"],
        ["repository"],
        ["repo"],
      ]) ?? "unknown-repository",
    repositoryCloneUrl:
      firstString(payload, [["repository", "clone_url"], ["repositoryCloneUrl"], ["cloneUrl"], ["repoUrl"]]) ?? null,
    mrIid: firstString(payload, [["mergeRequest", "iid"], ["mergeRequest", "number"], ["mrIid"], ["number"]]) ?? "unknown",
    mrTitle: firstString(payload, [["mergeRequest", "title"], ["title"]]) ?? "Untitled merge request",
    mrUrl: firstString(payload, [["mergeRequest", "url"], ["mrUrl"], ["url"]]),
    sourceBranch: firstString(payload, [["mergeRequest", "sourceBranch"], ["sourceBranch"]]),
    targetBranch: firstString(payload, [["mergeRequest", "targetBranch"], ["targetBranch"]]),
    commitSha: firstString(payload, [["mergeRequest", "commitSha"], ["commitSha"]]),
    author: firstString(payload, [["mergeRequest", "author"], ["author"]]),
    diffUrl: firstString(payload, [["mergeRequest", "diffUrl"], ["diffUrl"]]),
    commentApiUrl: firstString(payload, [["mergeRequest", "commentApiUrl"], ["review", "commentApiUrl"], ["commentApiUrl"]]),
  };
}

function callbackBaseUrl(request: Request) {
  return (process.env.AGENTWORLD_PUBLIC_BASE_URL ?? new URL(request.url).origin).replace(/\/+$/, "");
}

function readInlineDiff(payload: unknown) {
  return firstString(payload, [
    ["diff"],
    ["patch"],
    ["mergeRequest", "diff"],
    ["pull_request", "diff"],
    ["agentworld", "diff"],
  ]);
}

function authTokenForCodePlatform(request: Request, payload: unknown) {
  return (
    process.env.CODE_PLATFORM_TOKEN ??
    firstString(payload, [["agentworld", "token"], ["review", "token"], ["codePlatformToken"]]) ??
    request.headers.get("x-code-platform-token")
  );
}

async function fetchDiffFromUrl(url: string, token: string | null) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3.diff, text/plain",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`diff fetch failed: ${response.status} ${response.statusText}`);

  return response.text();
}

async function fetchDiffFromGit(context: MergeRequestContext, reviewId: string) {
  if (!context.repositoryCloneUrl || !context.sourceBranch || !context.targetBranch) {
    throw new Error("clone url or source/target branch is missing");
  }

  const worktreeDir = path.join(process.cwd(), "data", "worktrees", "reviews", reviewId);
  await fs.mkdir(path.dirname(worktreeDir), { recursive: true });

  const runGit = async (args: string[]) =>
    execFileAsync("git", args, {
      cwd: args[0] === "clone" ? process.cwd() : worktreeDir,
      timeout: 120_000,
      maxBuffer: 20 * 1024 * 1024,
    });

  await runGit(["clone", "--no-checkout", "--filter=blob:none", context.repositoryCloneUrl, worktreeDir]);
  await runGit([
    "fetch",
    "origin",
    `refs/heads/${context.targetBranch}:refs/remotes/origin/${context.targetBranch}`,
    `refs/heads/${context.sourceBranch}:refs/remotes/origin/${context.sourceBranch}`,
    "--depth=50",
  ]);
  const { stdout } = await runGit(["diff", `origin/${context.targetBranch}...origin/${context.sourceBranch}`]);
  return stdout;
}

async function acquireDiff(context: MergeRequestContext, payload: unknown, request: Request, reviewId: string): Promise<DiffBundle> {
  const inlineDiff = readInlineDiff(payload);
  if (inlineDiff) return { diff: inlineDiff, status: "inline_payload" };

  const token = authTokenForCodePlatform(request, payload);
  if (context.diffUrl) {
    try {
      return { diff: await fetchDiffFromUrl(context.diffUrl, token), status: "remote_diff_url" };
    } catch (error) {
      return {
        diff: "",
        status: "diff_fetch_failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  try {
    return { diff: await fetchDiffFromGit(context, reviewId), status: "git_fetch" };
  } catch (error) {
    return {
      diff: "",
      status: "missing",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function summarizeDiff(diff: string): DiffStats {
  const files = new Set<string>();
  let additions = 0;
  let deletions = 0;

  for (const line of diff.split("\n")) {
    const gitFile = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (gitFile?.[2]) files.add(gitFile[2]);

    const plusFile = /^\+\+\+ b\/(.+)$/.exec(line);
    if (plusFile?.[1]) files.add(plusFile[1]);

    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }

  return {
    changedFiles: Array.from(files),
    additions,
    deletions,
    totalLines: additions + deletions,
  };
}

function locatePattern(diff: string, patterns: string[]) {
  let currentFile: string | null = null;
  let newLine: number | null = null;

  for (const line of diff.split("\n")) {
    const gitFile = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (gitFile?.[2]) {
      currentFile = gitFile[2];
      newLine = null;
      continue;
    }

    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk?.[1]) {
      newLine = Number(hunk[1]);
      continue;
    }

    const isAdded = line.startsWith("+") && !line.startsWith("+++");
    const searchableLine = isAdded ? line.slice(1) : line;
    const lower = searchableLine.toLowerCase();
    const matchedPattern = patterns.find((pattern) => lower.includes(pattern.toLowerCase()));

    if (isAdded && matchedPattern) {
      return {
        filePath: currentFile,
        lineNumber: newLine,
        pattern: matchedPattern,
      };
    }

    if ((line.startsWith("+") || line.startsWith(" ")) && newLine !== null && !line.startsWith("+++")) {
      newLine += 1;
    }
  }

  return null;
}

function isTestFile(filePath: string) {
  return [".test.", ".spec.", "__tests__", "/tests/", "/test/"].some((pattern) => filePath.includes(pattern));
}

function isSourceFile(filePath: string) {
  return (
    !isTestFile(filePath) &&
    (filePath.includes("/src/") ||
      filePath.startsWith("src/") ||
      filePath.endsWith(".ts") ||
      filePath.endsWith(".tsx") ||
      filePath.endsWith(".js") ||
      filePath.endsWith(".jsx"))
  );
}

function reviewWithSkill(skill: CodeReviewSkill, diff: string, stats: DiffStats, diffBundle: DiffBundle): FindingDraft[] {
  const findings: FindingDraft[] = [];
  const heuristics = parseJsonObject<JsonRecord>(skill.heuristicsJson, {});

  if (skill.id === "mr-structure") {
    const maxChangedFiles = typeof heuristics.maxChangedFiles === "number" ? heuristics.maxChangedFiles : 20;
    const largeDiffLineThreshold =
      typeof heuristics.largeDiffLineThreshold === "number" ? heuristics.largeDiffLineThreshold : 800;
    const watchFiles = Array.isArray(heuristics.watchFiles) ? heuristics.watchFiles.filter((item) => typeof item === "string") : [];

    if (!diff.trim()) {
      findings.push({
        skillId: skill.id,
        knowledgeLayer: skill.layer,
        severity: "medium",
        filePath: null,
        lineNumber: null,
        title: "没有拿到可检视的 diff",
        body: `AgentWorld 已收到 MR，但当前没有获取到代码差异。原因：${diffBundle.error ?? "payload 未提供 diff，且远端 diff/拉取代码不可用"}。`,
        suggestion: "请在 webhook payload 中传入 diff，或配置可访问的 diffUrl / repositoryCloneUrl / sourceBranch / targetBranch。",
      });
    }

    if (stats.changedFiles.length > maxChangedFiles) {
      findings.push({
        skillId: skill.id,
        knowledgeLayer: skill.layer,
        severity: "medium",
        filePath: null,
        lineNumber: null,
        title: "MR 变更文件较多，建议拆分或补充风险说明",
        body: `本次变更涉及 ${stats.changedFiles.length} 个文件，已经超过当前结构检视阈值 ${maxChangedFiles}。这会增加遗漏接口兼容性、回滚路径和测试范围的概率。`,
        suggestion: "如果不能拆分，请在 MR 描述里补充变更范围、回滚方式和重点验证路径。",
      });
    }

    if (stats.totalLines > largeDiffLineThreshold) {
      findings.push({
        skillId: skill.id,
        knowledgeLayer: skill.layer,
        severity: "medium",
        filePath: null,
        lineNumber: null,
        title: "MR diff 较大，检视风险升高",
        body: `本次新增和删除合计 ${stats.totalLines} 行，超过 ${largeDiffLineThreshold} 行阈值。大 diff 更适合分层检视或先给出设计说明。`,
        suggestion: "建议拆成接口、实现、测试三个 MR，或者附上清晰的检视顺序。",
      });
    }

    const watchedFile = stats.changedFiles.find((file) => watchFiles.includes(file));
    if (watchedFile) {
      findings.push({
        skillId: skill.id,
        knowledgeLayer: skill.layer,
        severity: "low",
        filePath: watchedFile,
        lineNumber: null,
        title: "依赖或锁文件发生变化",
        body: `${watchedFile} 在本次 MR 中发生变化。依赖变化通常会影响安装、构建或运行时行为，需要明确验证结果。`,
        suggestion: "请确认本地安装、构建和关键启动命令已经跑过，并在 MR 描述中说明。",
      });
    }
  }

  if (skill.id === "security-sensitive") {
    const riskyPatterns = Array.isArray(heuristics.riskyPatterns)
      ? heuristics.riskyPatterns.filter((item) => typeof item === "string" && item !== ".env")
      : [];
    const foundPatterns = new Set<string>();
    const envFile = stats.changedFiles.find((file) => file.includes(".env"));

    if (envFile) {
      findings.push({
        skillId: skill.id,
        knowledgeLayer: skill.layer,
        severity: "high",
        filePath: envFile,
        lineNumber: null,
        title: "环境配置文件发生变化",
        body: `${envFile} 在本次 MR 中发生变化。环境配置文件可能包含密钥、token 或部署行为变化，需要确认不会泄露敏感信息。`,
        suggestion: "请确认没有提交真实密钥，并说明配置变更的部署影响和回滚方式。",
      });
    }

    for (const pattern of riskyPatterns) {
      if (foundPatterns.size >= 4) break;
      const located = locatePattern(diff, [pattern]);
      if (!located || foundPatterns.has(pattern)) continue;

      foundPatterns.add(pattern);
      findings.push({
        skillId: skill.id,
        knowledgeLayer: skill.layer,
        severity: ["eval(", "new Function(", "child_process", "exec(", "spawn(", "private_key"].includes(pattern)
          ? "high"
          : "medium",
        filePath: located.filePath,
        lineNumber: located.lineNumber,
        title: `新增代码包含安全敏感信号：${pattern}`,
        body: `检视技能在新增代码中发现 ${pattern}。这不一定就是漏洞，但需要确认是否有输入约束、权限边界和密钥保护。`,
        suggestion: "请补充为什么这里安全，或改为更受控的工具调用、配置引用或权限校验。",
      });
    }
  }

  if (skill.id === "test-impact") {
    const sourceFiles = stats.changedFiles.filter(isSourceFile);
    const testFiles = stats.changedFiles.filter(isTestFile);
    if (sourceFiles.length > 0 && testFiles.length === 0) {
      findings.push({
        skillId: skill.id,
        knowledgeLayer: skill.layer,
        severity: "medium",
        filePath: sourceFiles[0] ?? null,
        lineNumber: null,
        title: "业务代码变化没有看到对应测试变化",
        body: `本次修改了 ${sourceFiles.length} 个源码文件，但 diff 中没有发现 test/spec/tests 相关文件。对于 MR 自动检视、Webhook 或知识库写入这类流程，缺测试会让回归风险变高。`,
        suggestion: "建议补一个覆盖主要路径的单元测试或集成测试；如果确实不需要测试，请在 MR 描述里说明验证方式。",
      });
    }
  }

  if (skill.id === "data-contract") {
    const contractPatterns = Array.isArray(heuristics.contractPatterns)
      ? heuristics.contractPatterns.filter((item) => typeof item === "string")
      : [];
    const located = locatePattern(diff, contractPatterns);
    const hasCompatibilityNote = /backward|compatible|migration|schema version|兼容|迁移|回滚/i.test(diff);

    if (located && !hasCompatibilityNote) {
      findings.push({
        skillId: skill.id,
        knowledgeLayer: skill.layer,
        severity: "low",
        filePath: located.filePath,
        lineNumber: located.lineNumber,
        title: "接口或数据契约变化需要兼容性说明",
        body: `diff 中出现 ${located.pattern}，说明可能涉及 API、Webhook、数据库或序列化契约变化，但没有看到明确的兼容、迁移或回滚说明。`,
        suggestion: "请补充调用方影响、默认值、迁移方式或回滚方式，避免上线后消费者无法适配。",
      });
    }
  }

  return findings;
}

function loadReviewSkills() {
  return queryAll<CodeReviewSkill>(
    "SELECT * FROM code_review_skills WHERE is_enabled = 1 ORDER BY layer ASC, name ASC",
  );
}

function createFeedbackToken() {
  return randomBytes(18).toString("base64url");
}

function createFeedbackUrls(baseUrl: string, token: string) {
  return {
    correctUrl: `${baseUrl}/api/review-feedback/${token}?verdict=correct`,
    incorrectUrl: `${baseUrl}/api/review-feedback/${token}?verdict=incorrect`,
  };
}

function buildReviewComment(context: MergeRequestContext, findings: FindingResult[], baseUrl: string, knowledgeUri: string) {
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2, info: 3 };
  const sorted = [...findings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  const lines = [
    "## AgentWorld 自动检视",
    "",
    `仓库：${context.repositorySlug}`,
    `MR：${context.mrTitle} (#${context.mrIid})`,
    `知识上下文：${knowledgeUri}`,
    "",
    "本次检视按 MR 结构、安全敏感、测试影响、数据与接口契约四层技能执行。每条意见都带有反馈链接，反馈会写回 AgentWorld 的 OpenViking 分层知识库。",
    "",
    "### 检视意见",
    "",
  ];

  if (sorted.length === 0) {
    lines.push("没有发现需要评论的风险。");
  } else {
    sorted.forEach((finding, index) => {
      lines.push(
        `${index + 1}. [${finding.severity}] ${finding.title}`,
        "",
        `   文件：${finding.filePath ?? "整体 MR"}${finding.lineNumber ? `:${finding.lineNumber}` : ""}`,
        `   技能：${finding.skillId}`,
        `   说明：${finding.body}`,
        finding.suggestion ? `   建议：${finding.suggestion}` : "",
        `   反馈： [这条正确](${finding.correctUrl}) | [这条不正确](${finding.incorrectUrl})`,
        "",
      );
    });
  }

  lines.push(`反馈入口基地址：${baseUrl}`);

  return lines.filter((line) => line !== "").join("\n");
}

async function postReviewComment(
  context: MergeRequestContext,
  payload: unknown,
  request: Request,
  markdown: string,
): Promise<CommentPostResult> {
  if (!context.commentApiUrl) {
    return { status: "dry_run_no_comment_api", url: null };
  }

  const token = authTokenForCodePlatform(request, payload);
  if (!token) {
    return { status: "dry_run_missing_token", url: context.commentApiUrl };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (context.platform === "gitlab") headers["PRIVATE-TOKEN"] = token;

  const response = await fetch(context.commentApiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ body: markdown }),
  });

  if (!response.ok) {
    return { status: `post_failed_${response.status}`, url: context.commentApiUrl };
  }

  try {
    const responseBody = (await response.json()) as JsonRecord;
    const postedUrl =
      firstString(responseBody, [["html_url"], ["web_url"], ["url"]]) ??
      firstString(responseBody, [["links", "html", "href"]]) ??
      context.commentApiUrl;
    return { status: "posted", url: postedUrl };
  } catch {
    return { status: "posted", url: context.commentApiUrl };
  }
}

export async function runMergeRequestReview(pathKey: string, request: Request, payload: unknown) {
  const webhook = queryOne<WebhookEndpoint>(
    "SELECT * FROM webhook_endpoints WHERE path_key = ? AND is_enabled = 1",
    pathKey,
  );

  if (!webhook) {
    return {
      ok: false,
      status: 404,
      error: `Webhook endpoint is not enabled: ${pathKey}`,
    };
  }

  const configuredSecret = process.env.CODE_PLATFORM_WEBHOOK_SECRET;
  if (configuredSecret && request.headers.get("x-agentworld-webhook-secret") !== configuredSecret) {
    return {
      ok: false,
      status: 401,
      error: "Webhook secret mismatch",
    };
  }

  const context = parseMergeRequestContext(payload);
  const now = new Date().toISOString();
  const reviewId = randomUUID();
  const baseUrl = callbackBaseUrl(request);

  execute(
    "INSERT INTO merge_request_reviews (id, webhook_id, platform, repository_slug, repository_clone_url, mr_iid, mr_title, mr_url, source_branch, target_branch, commit_sha, author, status, diff_status, comment_status, comment_url, comment_markdown, callback_base_url, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    reviewId,
    webhook.id,
    context.platform,
    context.repositorySlug,
    context.repositoryCloneUrl,
    context.mrIid,
    context.mrTitle,
    context.mrUrl,
    context.sourceBranch,
    context.targetBranch,
    context.commitSha,
    context.author,
    "running",
    "pending",
    "pending",
    null,
    null,
    baseUrl,
    now,
    null,
  );

  const diffBundle = await acquireDiff(context, payload, request, reviewId);
  const stats = summarizeDiff(diffBundle.diff);
  const skills = loadReviewSkills();
  const knowledge = await writeLayeredKnowledge({
    layer: "repository/code-review",
    scopeKey: `${context.repositorySlug}/mr-${context.mrIid}`,
    title: `MR Review Context: ${context.repositorySlug}#${context.mrIid}`,
    sourceType: "review_context",
    metadata: {
      reviewId,
      platform: context.platform,
      diffStatus: diffBundle.status,
      changedFiles: stats.changedFiles,
      additions: stats.additions,
      deletions: stats.deletions,
    },
    contentMd: [
      `MR: ${context.mrTitle}`,
      `Repository: ${context.repositorySlug}`,
      `Author: ${context.author ?? "unknown"}`,
      `Source: ${context.sourceBranch ?? "unknown"}`,
      `Target: ${context.targetBranch ?? "unknown"}`,
      `Diff status: ${diffBundle.status}`,
      "",
      "Changed files:",
      ...stats.changedFiles.map((file) => `- ${file}`),
    ].join("\n"),
  });

  const drafts = skills.flatMap((skill) => reviewWithSkill(skill, diffBundle.diff, stats, diffBundle));
  const normalizedDrafts =
    drafts.length > 0
      ? drafts
      : [
          {
            skillId: "mr-structure",
            knowledgeLayer: "global/code-review",
            severity: "info" as const,
            filePath: null,
            lineNumber: null,
            title: "本次 MR 未发现阻塞性风险",
            body: "AgentWorld 已完成当前四层检视，没有发现需要阻塞合并的问题。仍建议结合 CI 和人工上下文判断。",
            suggestion: "如果业务风险较高，可以继续要求人工 reviewer 补充一次确认。",
          },
        ];

  const findings: FindingResult[] = [];
  for (const draft of normalizedDrafts.slice(0, 8)) {
    const findingId = randomUUID();
    const feedbackToken = createFeedbackToken();
    const urls = createFeedbackUrls(baseUrl, feedbackToken);
    const createdAt = new Date().toISOString();

    execute(
      "INSERT INTO review_findings (id, review_id, skill_id, knowledge_layer, severity, file_path, line_number, title, body, suggestion, feedback_token, feedback_state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      findingId,
      reviewId,
      draft.skillId,
      draft.knowledgeLayer,
      draft.severity,
      draft.filePath,
      draft.lineNumber,
      draft.title,
      draft.body,
      draft.suggestion,
      feedbackToken,
      "pending",
      createdAt,
    );

    await writeLayeredKnowledge({
      layer: draft.knowledgeLayer,
      scopeKey: `${context.repositorySlug}/mr-${context.mrIid}`,
      skillId: draft.skillId,
      title: `Review Finding: ${draft.title}`,
      sourceType: "review_finding",
      metadata: {
        reviewId,
        findingId,
        severity: draft.severity,
        filePath: draft.filePath,
        lineNumber: draft.lineNumber,
      },
      contentMd: [draft.body, "", draft.suggestion ? `Suggestion: ${draft.suggestion}` : ""].filter(Boolean).join("\n"),
    });

    findings.push({
      ...draft,
      id: findingId,
      feedbackToken,
      ...urls,
    });
  }

  const commentMarkdown = buildReviewComment(context, findings, baseUrl, knowledge.vikingUri);
  const postResult = await postReviewComment(context, payload, request, commentMarkdown);
  const completedAt = new Date().toISOString();

  execute(
    "UPDATE merge_request_reviews SET status = ?, diff_status = ?, comment_status = ?, comment_url = ?, comment_markdown = ?, completed_at = ? WHERE id = ?",
    "completed",
    diffBundle.status,
    postResult.status,
    postResult.url,
    commentMarkdown,
    completedAt,
    reviewId,
  );

  return {
    ok: true,
    status: 200,
    reviewId,
    diffStatus: diffBundle.status,
    commentStatus: postResult.status,
    commentUrl: postResult.url,
    knowledgeUri: knowledge.vikingUri,
    findings,
    commentMarkdown,
  };
}

export async function recordReviewFeedback(token: string, verdict: string, note: string | null, sourceIp: string | null) {
  const normalizedVerdict = verdict === "incorrect" || verdict === "correct" || verdict === "unclear" ? verdict : null;
  if (!normalizedVerdict) {
    return {
      ok: false,
      status: 400,
      error: "verdict must be correct, incorrect, or unclear",
    };
  }

  const finding = queryOne<ReviewFinding>("SELECT * FROM review_findings WHERE feedback_token = ?", token);
  if (!finding) {
    return {
      ok: false,
      status: 404,
      error: "feedback token not found",
    };
  }

  const review = queryOne<MergeRequestReview>("SELECT * FROM merge_request_reviews WHERE id = ?", finding.reviewId);
  if (!review) {
    return {
      ok: false,
      status: 404,
      error: "review not found",
    };
  }

  const feedbackId = randomUUID();
  const createdAt = new Date().toISOString();
  const knowledge = await writeLayeredKnowledge({
    layer: `feedback/${normalizedVerdict}`,
    scopeKey: `${review.repositorySlug}/mr-${review.mrIid}`,
    skillId: finding.skillId,
    title: `Feedback: ${finding.title}`,
    sourceType: "review_feedback",
    metadata: {
      reviewId: review.id,
      findingId: finding.id,
      verdict: normalizedVerdict,
      sourceIp,
    },
    contentMd: [
      `Verdict: ${normalizedVerdict}`,
      `Finding: ${finding.title}`,
      `Skill: ${finding.skillId}`,
      `Severity: ${finding.severity}`,
      note ? `Note: ${note}` : "Note: none",
      "",
      "Original finding:",
      finding.body,
    ].join("\n"),
  });

  execute(
    "INSERT INTO review_feedback (id, finding_id, review_id, token, verdict, note, source_ip, knowledge_uri, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    feedbackId,
    finding.id,
    review.id,
    token,
    normalizedVerdict,
    note,
    sourceIp,
    knowledge.vikingUri,
    createdAt,
  );
  execute("UPDATE review_findings SET feedback_state = ? WHERE id = ?", normalizedVerdict, finding.id);

  return {
    ok: true,
    status: 200,
    feedbackId,
    verdict: normalizedVerdict,
    knowledgeUri: knowledge.vikingUri,
    findingTitle: finding.title,
  };
}

export function listMergeRequestReviews(limit = 20) {
  return queryAll<MergeRequestReview>(
    "SELECT * FROM merge_request_reviews ORDER BY created_at DESC LIMIT ?",
    limit,
  );
}
