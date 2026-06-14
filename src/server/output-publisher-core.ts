import { type EnvironmentSnapshot, type Finding, type TaskBlueprint, type TaskRun } from "@/server/db";
import {
  createPluginRuntimeContext,
  resolveOutputPublisher,
} from "@/server/plugin-sdk-core";
import { uiText } from "@/lib/language-pack";
import { normalizeKnowledgeUri } from "@/lib/knowledge-uri";
import { buildRepositoryNameAliases } from "@/lib/repository-identity";
import {
  buildFindingFeedbackPath,
  buildFindingFeedbackToken,
  buildFindingFeedbackUrl,
} from "@/server/finding-feedback-token";
import { createKnowledgeSpace, listKnowledgeSpaces } from "@/server/knowledge-core";

type PublisherSpec = {
  type?: string;
  pluginId?: string;
  publisherRef?: string;
  config?: Record<string, unknown>;
};

type FindingFeedbackPolicy = {
  enabled: boolean;
  baseUrl: string;
};

export type OutputPublicationResult = {
  publisherType: string;
  pluginId: string | null;
  status: "published" | "drafted" | "skipped" | "failed";
  message: string;
  payload: Record<string, unknown>;
};

function parseRecord(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseRecordValue(value: unknown) {
  return isRecord(value) ? value : {};
}

function parseArrayRecords(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "task";
}

function truncateForArchive(value: unknown, maxLength = 4000) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n...`;
}

function parsePublishers(blueprint: TaskBlueprint) {
  const outputPolicy = parseRecord(blueprint.outputPolicyJson);
  return Array.isArray(outputPolicy.publishers)
    ? (outputPolicy.publishers.filter(
        (publisher): publisher is PublisherSpec =>
          publisher !== null && typeof publisher === "object" && !Array.isArray(publisher),
      ))
    : [];
}

function parseFindingFeedbackPolicy(blueprint: TaskBlueprint, taskRunInput: Record<string, unknown>): FindingFeedbackPolicy {
  const outputPolicy = parseRecord(blueprint.outputPolicyJson);
  const rawPolicy = parseRecord(
    typeof outputPolicy.findingFeedback === "string"
      ? outputPolicy.findingFeedback
      : JSON.stringify(outputPolicy.findingFeedback ?? {}),
  );
  const enabled = rawPolicy.enabled === true;
  const configuredBaseUrl =
    typeof rawPolicy.baseUrl === "string" && rawPolicy.baseUrl.trim()
      ? rawPolicy.baseUrl.trim()
      : "";
  const inputBaseUrl =
    typeof taskRunInput.public_base_url === "string" && taskRunInput.public_base_url.trim()
      ? taskRunInput.public_base_url.trim()
      : typeof taskRunInput.publicBaseUrl === "string" && taskRunInput.publicBaseUrl.trim()
        ? taskRunInput.publicBaseUrl.trim()
        : "";
  return {
    enabled,
    baseUrl: configuredBaseUrl || inputBaseUrl || process.env.AGENTWORLD_PUBLIC_BASE_URL || "",
  };
}

function buildFindingMarkdown(findings: Finding[], feedbackPolicy?: FindingFeedbackPolicy) {
  if (findings.length === 0) {
    return uiText("ui.generated.c9d4101ab82");
  }

  return findings
    .map((finding, index) => {
      const evidence = parseRecord(finding.evidenceJson);
      const location = [
        typeof evidence.repo_id === "string" ? evidence.repo_id : null,
        typeof evidence.file_path === "string" ? evidence.file_path : null,
        typeof evidence.line_start === "number" ? `L${evidence.line_start}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      return [
        `${index + 1}. [${finding.severity}] ${finding.title}`,
        location ? uiText("ui.server.outputPublisher.location", undefined, { location }) : null,
        finding.description,
        finding.recommendation
          ? uiText("ui.server.outputPublisher.recommendation", undefined, { recommendation: finding.recommendation })
          : null,
        feedbackPolicy?.enabled
          ? uiText("ui.server.outputPublisher.feedback", undefined, {
              feedbackUrl: buildFindingFeedbackUrl(finding, feedbackPolicy.baseUrl),
            })
          : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function buildPublicationInput(args: {
  taskRun: TaskRun;
  blueprint: TaskBlueprint;
  findings: Finding[];
  environmentSnapshot: EnvironmentSnapshot | null;
  publisher: PublisherSpec;
}) {
  const inputPayload = parseRecord(args.taskRun.inputPayloadJson);
  const environmentPayload = parseRecord(args.environmentSnapshot?.snapshotJson);
  const feedbackPolicy = parseFindingFeedbackPolicy(args.blueprint, inputPayload);
  const commentBody = [
    `## ${args.blueprint.name}`,
    "",
    uiText("ui.server.outputPublisher.taskRun", undefined, { taskRunId: args.taskRun.id }),
    uiText("ui.server.outputPublisher.sourceType", undefined, { sourceType: args.taskRun.sourceType }),
    "",
    buildFindingMarkdown(args.findings, feedbackPolicy),
  ].join("\n");

  return {
    ...args.publisher.config,
    ...inputPayload,
    taskRunId: args.taskRun.id,
    blueprintId: args.blueprint.id,
    projectId: inputPayload.project_id ?? inputPayload.projectId ?? inputPayload.repo_id,
    mergeRequestIid: inputPayload.mr_id ?? inputPayload.mergeRequestIid,
    findings: args.findings.map((finding) => ({
      id: finding.id,
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
      description: finding.description,
      recommendation: finding.recommendation,
      evidence: parseRecord(finding.evidenceJson),
      feedbackToken: feedbackPolicy.enabled ? buildFindingFeedbackToken(finding) : null,
      feedbackPath: feedbackPolicy.enabled ? buildFindingFeedbackPath(finding) : null,
      feedbackUrl: feedbackPolicy.enabled ? buildFindingFeedbackUrl(finding, feedbackPolicy.baseUrl) : null,
    })),
    findingFeedback: feedbackPolicy,
    environment: environmentPayload,
    comment: commentBody,
    body: {
      body: commentBody,
    },
  } satisfies Record<string, unknown>;
}

function repositoryNameFromTask(taskRun: TaskRun, inputPayload: Record<string, unknown>) {
  return firstString(
    inputPayload.codebase_name,
    inputPayload.codebaseName,
    inputPayload.repo_id,
    inputPayload.repository,
    inputPayload.repositoryName,
    inputPayload.repository_name,
    taskRun.sourceRef,
  );
}

function buildArchiveEntryTitle(args: { taskRun: TaskRun; blueprint: TaskBlueprint; inputPayload: Record<string, unknown> }) {
  const repositoryName = repositoryNameFromTask(args.taskRun, args.inputPayload);
  return uiText("ui.server.outputPublisher.archiveTitle", undefined, {
    name: args.blueprint.name,
    source: repositoryName || args.taskRun.sourceRef || args.taskRun.id,
    date: args.taskRun.createdAt.slice(0, 10),
  });
}

export function buildTaskRunArtifactArchiveContent(args: {
  taskRun: TaskRun;
  blueprint: TaskBlueprint;
  findings: Finding[];
  environmentSnapshot: EnvironmentSnapshot | null;
}) {
  const inputPayload = parseRecord(args.taskRun.inputPayloadJson);
  const environmentPayload = parseRecord(args.environmentSnapshot?.snapshotJson);
  const feedbackPolicy = parseFindingFeedbackPolicy(args.blueprint, inputPayload);
  const outputPayload = parseRecord(args.taskRun.outputPayloadJson);
  const title = buildArchiveEntryTitle({ taskRun: args.taskRun, blueprint: args.blueprint, inputPayload });

  return [
    `# ${title}`,
    "",
    "## " + uiText("ui.server.outputPublisher.archive.sections.summary"),
    "",
    `- ${uiText("ui.server.outputPublisher.taskRun", undefined, { taskRunId: args.taskRun.id })}`,
    `- ${uiText("ui.server.outputPublisher.sourceType", undefined, { sourceType: args.taskRun.sourceType })}`,
    `- ${uiText("ui.server.outputPublisher.archive.status", undefined, { status: args.taskRun.status })}`,
    `- ${uiText("ui.server.outputPublisher.archive.requestedBy", undefined, { requestedBy: args.taskRun.requestedBy })}`,
    "",
    "## " + uiText("ui.server.outputPublisher.archive.sections.findings"),
    "",
    buildFindingMarkdown(args.findings, feedbackPolicy),
    "",
    "## " + uiText("ui.server.outputPublisher.archive.sections.input"),
    "",
    "```json",
    truncateForArchive(inputPayload),
    "```",
    "",
    "## " + uiText("ui.server.outputPublisher.archive.sections.environment"),
    "",
    "```json",
    truncateForArchive(environmentPayload),
    "```",
    Object.keys(outputPayload).length
      ? [
          "",
          "## " + uiText("ui.server.outputPublisher.archive.sections.output"),
          "",
          "```json",
          truncateForArchive(outputPayload),
          "```",
        ].join("\n")
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function findArchiveKnowledgeSpace(environmentSnapshot: EnvironmentSnapshot | null) {
  const environmentPayload = parseRecord(environmentSnapshot?.snapshotJson);
  const knowledgeContext = parseRecordValue(environmentPayload.knowledgeContext);
  const archiveRefs = parseArrayRecords(knowledgeContext.archiveRefs);
  if (archiveRefs.length === 0) return null;

  const spaces = listKnowledgeSpaces();
  for (const ref of archiveRefs) {
    const id = firstString(ref.id, ref.knowledgeSpaceId);
    const uri = firstString(ref.vikingUri, ref.uri);
    const byId = id ? spaces.find((space) => space.id === id) : null;
    if (byId) return byId;
    const normalizedUri = uri ? normalizeKnowledgeUri(uri) : "";
    const byUri = normalizedUri ? spaces.find((space) => normalizeKnowledgeUri(space.vikingUri) === normalizedUri) : null;
    if (byUri) return byUri;
  }
  return null;
}

function resolveRepositoryAliases(inputPayload: Record<string, unknown>) {
  return buildRepositoryNameAliases(
    firstString(inputPayload.codebase_id, inputPayload.codebaseId),
    firstString(inputPayload.codebase_name, inputPayload.codebaseName),
    firstString(inputPayload.repo_id, inputPayload.repository, inputPayload.repositoryName, inputPayload.repository_name),
    firstString(inputPayload.repo_url, inputPayload.repositoryUrl, inputPayload.repository_url),
  );
}

function resolveArchiveKnowledgeSpace(args: {
  taskRun: TaskRun;
  blueprint: TaskBlueprint;
  environmentSnapshot: EnvironmentSnapshot | null;
}) {
  const configured = findArchiveKnowledgeSpace(args.environmentSnapshot);
  if (configured) return configured;

  const inputPayload = parseRecord(args.taskRun.inputPayloadJson);
  const repositoryName = repositoryNameFromTask(args.taskRun, inputPayload);
  const repositoryAliases = resolveRepositoryAliases(inputPayload);
  const existing = repositoryAliases.length
    ? listKnowledgeSpaces().find((space) => {
        const aliases = buildRepositoryNameAliases(space.repositoryName, space.projectKey, space.slug, space.vikingUri);
        return aliases.some((alias) => repositoryAliases.includes(alias));
      })
    : null;
  if (existing) return existing;

  return createKnowledgeSpace({
    tenantSpaceId: args.taskRun.tenantSpaceId,
    businessTeamId: args.taskRun.businessTeamId,
    agentTeamId: args.taskRun.teamId,
    name: uiText("ui.server.outputPublisher.archive.spaceName", undefined, {
      source: repositoryName || args.blueprint.name,
    }),
    slug: `task-archive-${slugify(repositoryName || args.blueprint.name || args.taskRun.id)}`,
    spaceType: repositoryName ? "project" : "team",
    projectKey: repositoryName ? slugify(repositoryName) : undefined,
    knowledgeCategory: repositoryName ? "codebase" : "domain",
    repositoryName: repositoryName || undefined,
    description: uiText("ui.server.outputPublisher.archive.spaceDescription"),
    visibility: "team",
  });
}

async function publishArtifactArchive(args: {
  taskRun: TaskRun;
  blueprint: TaskBlueprint;
  findings: Finding[];
  environmentSnapshot: EnvironmentSnapshot | null;
}) {
  const archiveSpace = resolveArchiveKnowledgeSpace(args);
  if (!archiveSpace) {
    return {
      status: "skipped" as const,
      message: uiText("ui.server.outputPublisher.archive.skipped"),
      payload: { taskRunId: args.taskRun.id, findingCount: args.findings.length },
    };
  }

  const inputPayload = parseRecord(args.taskRun.inputPayloadJson);
  const { upsertKnowledgeEntry } = await import("@/server/knowledge-engine");
  const entry = await upsertKnowledgeEntry({
    id: `task-archive-${args.taskRun.id}`,
    knowledgeSpaceId: archiveSpace.id,
    layer: "task-archive",
    scopeKey: `${args.blueprint.category}/${slugify(repositoryNameFromTask(args.taskRun, inputPayload) || args.taskRun.sourceRef || args.taskRun.id)}`,
    title: buildArchiveEntryTitle({ taskRun: args.taskRun, blueprint: args.blueprint, inputPayload }),
    contentMd: buildTaskRunArtifactArchiveContent(args),
    metadataJson: JSON.stringify({
      taskRunId: args.taskRun.id,
      blueprintId: args.blueprint.id,
      sourceType: args.taskRun.sourceType,
      sourceRef: args.taskRun.sourceRef,
      findingCount: args.findings.length,
      archivedAt: new Date().toISOString(),
    }),
    sourceType: "inspection_context",
    updatedBy: "output-publisher",
    saveReason: "task_run_artifact_archive",
  });

  return {
    status: "published" as const,
    message: uiText("ui.server.outputPublisher.archive.published", undefined, {
      space: archiveSpace.name,
    }),
    payload: {
      taskRunId: args.taskRun.id,
      findingCount: args.findings.length,
      knowledgeSpaceId: archiveSpace.id,
      knowledgeSpaceName: archiveSpace.name,
      knowledgeEntryId: entry?.id ?? null,
      knowledgeUri: entry?.vikingUri ?? null,
      syncStatus: entry?.syncStatus ?? null,
    },
  };
}

export async function publishTaskRunOutputs(args: {
  taskRun: TaskRun;
  blueprint: TaskBlueprint | null;
  findings: Finding[];
  environmentSnapshot: EnvironmentSnapshot | null;
}) {
  if (!args.blueprint) {
    return [] satisfies OutputPublicationResult[];
  }

  const publishers = parsePublishers(args.blueprint);
  const results: OutputPublicationResult[] = [];

  for (const publisher of publishers) {
    const publisherType = publisher.type ?? "unknown";
    if (publisherType === "dashboard") {
      results.push({
        publisherType,
        pluginId: publisher.pluginId ?? null,
        status: "published",
        message: "Dashboard publisher consumed standard TaskRun and Finding state.",
        payload: { taskRunId: args.taskRun.id, findingCount: args.findings.length },
      });
      continue;
    }

    if (publisherType === "artifact_archive") {
      const archiveResult = await publishArtifactArchive({
        taskRun: args.taskRun,
        blueprint: args.blueprint,
        findings: args.findings,
        environmentSnapshot: args.environmentSnapshot,
      });
      results.push({
        publisherType,
        pluginId: publisher.pluginId ?? null,
        ...archiveResult,
      });
      continue;
    }

    if (publisherType === "email_report") {
      results.push({
        publisherType,
        pluginId: publisher.pluginId ?? null,
        status: "drafted",
        message: "Email report draft prepared; connector credentials are required for external send.",
        payload: {
          subject: `${args.blueprint.name} - ${args.taskRun.createdAt.slice(0, 10)}`,
          findingCount: args.findings.length,
        },
      });
      continue;
    }

    const publisherRef = publisher.publisherRef ?? publisher.pluginId ?? null;
    const executablePublisher = resolveOutputPublisher(publisherRef);
    if (!executablePublisher) {
      results.push({
        publisherType,
        pluginId: publisher.pluginId ?? null,
        status: "skipped",
        message: `No executable publisher registered for ${publisherRef ?? publisherType}.`,
        payload: {},
      });
      continue;
    }

    try {
      const payload = await executablePublisher.publish(
        buildPublicationInput({
          taskRun: args.taskRun,
          blueprint: args.blueprint,
          findings: args.findings,
          environmentSnapshot: args.environmentSnapshot,
          publisher,
        }),
        createPluginRuntimeContext(publisher.pluginId ?? executablePublisher.id, {
          taskRun: args.taskRun,
          blueprint: args.blueprint,
          environmentSnapshot: args.environmentSnapshot,
          configuration: publisher.config,
        }),
      );
      const publicationStatus =
        payload.publicationStatus === "drafted" ? "drafted" : "published";
      results.push({
        publisherType,
        pluginId: publisher.pluginId ?? null,
        status: publicationStatus,
        message:
          publicationStatus === "drafted"
            ? "Executable plugin prepared a publication draft."
            : "Published by executable plugin publisher.",
        payload,
      });
    } catch (error) {
      results.push({
        publisherType,
        pluginId: publisher.pluginId ?? null,
        status: "failed",
        message: error instanceof Error ? error.message : "Publisher failed.",
        payload: {},
      });
    }
  }

  return results;
}
