import { type EnvironmentSnapshot, type Finding, type TaskBlueprint, type TaskRun } from "@/server/db";
import {
  createPluginRuntimeContext,
  resolveOutputPublisher,
} from "@/server/plugin-sdk-core";
import { uiText } from "@/lib/language-pack";
import {
  buildFindingFeedbackPath,
  buildFindingFeedbackToken,
  buildFindingFeedbackUrl,
} from "@/server/finding-feedback-core";

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
      results.push({
        publisherType,
        pluginId: publisher.pluginId ?? null,
        status: "drafted",
        message: "Artifact archive record prepared from task output.",
        payload: { taskRunId: args.taskRun.id, findingCount: args.findings.length },
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
