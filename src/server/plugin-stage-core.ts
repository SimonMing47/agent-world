import {
  type EnvironmentSnapshot,
  type Finding,
  type TaskBlueprint,
  type TaskRun,
  queryAll,
} from "@/server/db";
import { uiText } from "@/lib/language-pack";
import {
  buildFindingFeedbackPath,
  buildFindingFeedbackToken,
  buildFindingFeedbackUrl,
} from "@/server/finding-feedback-token";
import {
  createPluginRuntimeContext,
  resolveOutputPublisher,
  resolveToolBundle,
} from "@/server/plugin-sdk-core";

type JsonRecord = Record<string, unknown>;

export type PluginStageExecutionInput = {
  blockType: string;
  pluginRef?: string;
  toolRef?: string;
  publisherRef?: string;
  payloadTemplate?: string;
  taskRun: TaskRun;
  blueprint: TaskBlueprint | null;
  environmentSnapshot: EnvironmentSnapshot | null;
  nodeInput: JsonRecord;
};

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

function parseJsonValue(value: string | null | undefined) {
  try {
    return JSON.parse(value ?? "null") as unknown;
  } catch {
    return null;
  }
}

function readPath(source: JsonRecord, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) return undefined;
    return current[segment];
  }, source);
}

function renderTemplate(template: string, context: JsonRecord) {
  return template.replace(/\$\{([^}]+)\}/g, (match, rawKey: string) => {
    const value = readPath(context, rawKey.trim());
    if (value === undefined || value === null) return match;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return JSON.stringify(value);
  });
}

function renderTemplateValue(value: unknown, context: JsonRecord): unknown {
  if (typeof value === "string") {
    const exactMatch = value.match(/^\$\{([^}]+)}$/);
    if (exactMatch) {
      const resolved = readPath(context, exactMatch[1]?.trim() ?? "");
      if (resolved !== undefined) return resolved;
    }
    return renderTemplate(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((item) => renderTemplateValue(item, context));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, renderTemplateValue(item, context)]),
    );
  }
  return value;
}

export function renderPayloadTemplate(template: string | undefined, context: JsonRecord) {
  if (!template?.trim()) return {};
  try {
    const parsedTemplate = JSON.parse(template) as unknown;
    const rendered = renderTemplateValue(parsedTemplate, context);
    return isRecord(rendered) ? rendered : { value: rendered };
  } catch {
    // Fall back to string rendering for legacy non-JSON templates below.
  }
  const rendered = renderTemplate(template, context);
  try {
    const parsed = JSON.parse(rendered) as unknown;
    return isRecord(parsed) ? parsed : { value: parsed };
  } catch {
    return { body: rendered };
  }
}

function mergeLoadedSkillRules(payload: JsonRecord, nodeInput: JsonRecord) {
  if (Array.isArray(payload.rules)) return payload;
  const skillRules = Array.isArray(nodeInput.skillRules)
    ? nodeInput.skillRules.filter(isRecord)
    : [];
  if (skillRules.length === 0) return payload;
  return {
    ...payload,
    rules: skillRules,
  };
}

function buildStageContext(args: PluginStageExecutionInput) {
  const input = parseRecord(args.taskRun.inputPayloadJson);
  return {
    taskRun: {
      id: args.taskRun.id,
      sourceType: args.taskRun.sourceType,
      sourceRef: args.taskRun.sourceRef,
      input,
      output: parseRecord(args.taskRun.outputPayloadJson),
    },
    blueprint: args.blueprint
      ? {
          id: args.blueprint.id,
          name: args.blueprint.name,
          category: args.blueprint.category,
          trigger: parseRecord(args.blueprint.triggerJson),
          outputPolicy: parseRecord(args.blueprint.outputPolicyJson),
        }
      : null,
    environment: parseRecord(args.environmentSnapshot?.snapshotJson),
    node: args.nodeInput,
  };
}

function readString(source: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function resolveFeedbackBaseUrl(args: PluginStageExecutionInput, context: JsonRecord) {
  const taskRun = isRecord(context.taskRun) ? context.taskRun : {};
  const input = isRecord(taskRun.input) ? taskRun.input : {};
  return (
    readString(args.nodeInput, "feedbackBaseUrl", "publicBaseUrl") ||
    readString(input, "feedback_base_url", "public_base_url", "feedbackBaseUrl", "publicBaseUrl") ||
    process.env.AGENTWORLD_PUBLIC_BASE_URL ||
    ""
  );
}

function serializeFinding(finding: Finding, baseUrl: string) {
  return {
    id: finding.id,
    taskRunId: finding.taskRunId,
    sourceAgent: finding.sourceAgent,
    category: finding.category,
    severity: finding.severity,
    confidence: finding.confidence,
    title: finding.title,
    description: finding.description,
    recommendation: finding.recommendation,
    evidence: parseRecord(finding.evidenceJson),
    knowledgeRefs: parseJsonValue(finding.skillRefsJson) ?? [],
    skillRefs: parseJsonValue(finding.skillRefsJson) ?? [],
    fingerprint: finding.fingerprint,
    status: finding.status,
    feedbackToken: buildFindingFeedbackToken(finding),
    feedbackPath: buildFindingFeedbackPath(finding),
    feedbackUrl: buildFindingFeedbackUrl(finding, baseUrl),
  };
}

function shouldIterateFindings(value: unknown) {
  if (typeof value !== "string") return false;
  return ["finding", "findings", "taskrun.findings", "task_run.findings"].includes(value.trim().toLowerCase());
}

function buildPluginConfiguration(args: PluginStageExecutionInput) {
  const pluginConfig = isRecord(args.nodeInput.pluginConfig) ? args.nodeInput.pluginConfig : {};
  const baseUrl = readString(args.nodeInput, "pluginBaseUrl", "baseUrl", "base_url") ||
    readString(pluginConfig, "baseUrl", "base_url", "url");
  const tokenRef = readString(args.nodeInput, "pluginTokenRef", "tokenRef", "token_ref") ||
    readString(pluginConfig, "tokenRef", "token_ref", "token");
  const webhookSecretRef = readString(args.nodeInput, "pluginWebhookSecretRef", "webhookSecretRef", "webhook_secret_ref") ||
    readString(pluginConfig, "webhookSecretRef", "webhook_secret_ref");
  return {
    ...pluginConfig,
    baseUrl: baseUrl || undefined,
    tokenRef: tokenRef || undefined,
    webhookSecretRef: webhookSecretRef || undefined,
    nodeInput: args.nodeInput,
    loadedSkills: args.nodeInput.loadedSkills,
    skillRules: args.nodeInput.skillRules,
  };
}

async function executePluginPayload(args: PluginStageExecutionInput, payload: JsonRecord) {
  if (args.blockType === "publisher") {
    const publisherRef = args.publisherRef || args.pluginRef || "";
    const publisher = resolveOutputPublisher(publisherRef);
    if (!publisher) {
      return {
        status: "drafted",
        reason: publisherRef
          ? uiText("pluginStage.errors.publisherMissing", undefined, { publisherRef })
          : uiText("pluginStage.errors.publisherRefMissing"),
        payload,
      };
    }
    const result = await publisher.publish(
      payload,
      createPluginRuntimeContext(publisherRef, {
        taskRun: args.taskRun,
        blueprint: args.blueprint,
        environmentSnapshot: args.environmentSnapshot,
        configuration: buildPluginConfiguration(args),
      }),
    );
    return {
      status: result.publicationStatus === "drafted" ? "drafted" : "completed",
      payload: result,
    };
  }

  if (args.blockType === "plugin_tool") {
    const pluginRef = args.pluginRef || "";
    const toolRef = args.toolRef || "";
    const bundle = resolveToolBundle(pluginRef);
    if (!bundle || !toolRef) {
      return {
        status: "drafted",
        reason: !pluginRef
          ? uiText("pluginStage.errors.pluginRefMissing")
          : !toolRef
            ? uiText("pluginStage.errors.toolRefMissing")
            : uiText("pluginStage.errors.toolBundleMissing", undefined, { pluginRef }),
        payload,
      };
    }
    const result = await bundle.executeTool(
      toolRef,
      payload,
      createPluginRuntimeContext(pluginRef, {
        taskRun: args.taskRun,
        blueprint: args.blueprint,
        environmentSnapshot: args.environmentSnapshot,
        configuration: buildPluginConfiguration(args),
      }),
    );
    return {
      status: "completed",
      payload: result,
    };
  }

  return {
    status: "skipped",
    reason: uiText("pluginStage.errors.unsupportedType", undefined, { blockType: args.blockType }),
    payload,
  };
}

export async function executePluginStage(args: PluginStageExecutionInput) {
  const baseContext = buildStageContext(args);
  if (shouldIterateFindings(args.nodeInput.forEach)) {
    const findings = queryAll<Finding>(
      "SELECT * FROM findings WHERE task_run_id = ? AND status <> 'deleted' ORDER BY created_at ASC",
      args.taskRun.id,
    );
    if (findings.length === 0) {
      return {
        status: "skipped",
        reason: uiText("pluginStage.errors.findingsMissing"),
        forEach: "finding",
        items: [],
      };
    }

    const feedbackBaseUrl = resolveFeedbackBaseUrl(args, baseContext);
    const items = [];
    for (const [index, finding] of findings.entries()) {
      const context = {
        ...baseContext,
        loop: { index, number: index + 1, count: findings.length },
        finding: serializeFinding(finding, feedbackBaseUrl),
      };
      const payload = mergeLoadedSkillRules(renderPayloadTemplate(args.payloadTemplate, context), args.nodeInput);
      try {
        const result = await executePluginPayload(args, payload);
        items.push({
          findingId: finding.id,
          status: result.status,
          payload: result.payload,
          reason: "reason" in result ? result.reason : undefined,
        });
      } catch (error) {
        items.push({
          findingId: finding.id,
          status: "failed",
          reason: error instanceof Error ? error.message : uiText("pluginStage.errors.executionFailed"),
          payload,
        });
      }
    }

    const failed = items.some((item) => item.status === "failed");
    const drafted = items.some((item) => item.status === "drafted");
    return {
      status: failed ? "failed" : drafted ? "drafted" : "completed",
      forEach: "finding",
      count: findings.length,
      items,
    };
  }

  const payload = mergeLoadedSkillRules(renderPayloadTemplate(args.payloadTemplate, baseContext), args.nodeInput);
  return executePluginPayload(args, payload);
}
