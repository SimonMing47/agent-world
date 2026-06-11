import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  execute,
  queryOne,
  type EnvironmentSnapshot,
  type TaskBlueprint,
  type TaskRun,
} from "@/server/db";
import { upsertFinding } from "@/server/finding-core";
import type { PluginManifest } from "@/server/plugin-core";
import { codehubExecutablePlugin } from "@/server/plugins/official/codehub";
import { giteaExecutablePlugin } from "@/server/plugins/official/gitea";
import { uiText } from "@/lib/language-pack";

export type PluginPermissionRequest = {
  resource: string;
  scope?: string;
};

export type PluginPermissionDecision = {
  effect: "allow" | "ask" | "deny";
  reason?: string;
};

export type PluginPermissionRule = {
  effect?: "allow" | "ask" | "deny" | string;
  resource?: string;
  scope?: string;
  reason?: string;
};

export type PluginRuntimeContextInput = {
  configuration?: Record<string, unknown>;
  taskRun?: TaskRun | null;
  blueprint?: TaskBlueprint | null;
  environmentSnapshot?: EnvironmentSnapshot | null;
  permissionRules?: PluginPermissionRule[];
  traceId?: string | null;
};

export type PluginRuntimeContext = {
  pluginId: string;
  configuration?: Record<string, unknown>;
  readTaskContext(): Promise<Record<string, unknown>>;
  readEnvironment(): Promise<Record<string, unknown>>;
  resolveSecretRef(ref: string): Promise<string | null>;
  requestPermission(input: PluginPermissionRequest): Promise<PluginPermissionDecision>;
  emitEvent(event: {
    type: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
  createFinding(input: Record<string, unknown>): Promise<string>;
  createArtifact(input: Record<string, unknown>): Promise<string>;
};

export type NormalizedTriggerInput = Record<string, unknown> & {
  raw_payload: unknown;
};

export type ExecutableWebhookParser = {
  id: string;
  verify?(args: {
    request: Request;
    payload: unknown;
    configuration?: Record<string, unknown>;
    resolveSecretRef(ref: string): Promise<string | null>;
  }): Promise<void>;
  parse(args: {
    pathKey: string;
    request: Request;
    payload: unknown;
    configuration?: Record<string, unknown>;
  }): Promise<NormalizedTriggerInput>;
  buildIdempotencyKey?(input: NormalizedTriggerInput): string;
};

export type ExecutableRepositoryConnector = {
  id: string;
  getProject?(input: Record<string, unknown>, ctx: PluginRuntimeContext): Promise<Record<string, unknown>>;
  compare?(input: Record<string, unknown>, ctx: PluginRuntimeContext): Promise<Record<string, unknown>>;
  getMergeRequestChanges?(input: Record<string, unknown>, ctx: PluginRuntimeContext): Promise<Record<string, unknown>>;
  getRepoFile?(input: Record<string, unknown>, ctx: PluginRuntimeContext): Promise<Record<string, unknown>>;
  merge?(input: Record<string, unknown>, ctx: PluginRuntimeContext): Promise<Record<string, unknown>>;
};

export type ExecutableOutputPublisher = {
  id: string;
  publish(input: Record<string, unknown>, ctx: PluginRuntimeContext): Promise<Record<string, unknown>>;
};

export type ExecutableToolDefinition = {
  id: string;
  title: string;
  description: string;
};

export type ExecutableToolBundle = {
  id: string;
  tools: ExecutableToolDefinition[];
  executeTool(
    toolId: string,
    input: Record<string, unknown>,
    ctx: PluginRuntimeContext,
  ): Promise<Record<string, unknown>>;
};

export type ExecutablePluginManifest = {
  apiVersion: string;
  kind: string;
  metadata: {
    id: string;
    name: string;
    version: string;
    description?: string;
  };
  spec: {
    runtime: {
      type: string;
      entry: string;
    };
    permissions: {
      requested: string[];
    };
    contributions: {
      repositoryConnectors?: Array<{ id: string }>;
      webhookParsers?: Array<{ id: string }>;
      outputPublishers?: Array<{ id: string }>;
      toolBundles?: Array<{ id: string }>;
      providerAdapters?: Array<{ id: string }>;
      authAdapters?: Array<{ id: string }>;
      knowledgeSources?: Array<{ id: string }>;
      knowledgeAssets?: Array<{ id: string }>;
      skills?: Array<{ id: string }>;
      taskBlueprints?: Array<{ id: string }>;
      environmentTemplates?: Array<{ id: string }>;
      navigationItems?: Array<{ id: string; slot?: string }>;
      settingsPanels?: Array<{ id: string; slot?: string }>;
      dashboardWidgets?: Array<{ id: string; slot?: string }>;
      taskRunPanels?: Array<{ id: string; slot?: string }>;
      agentDetailTabs?: Array<{ id: string; slot?: string }>;
      codebaseEngines?: Array<{ id: string }>;
      notificationChannels?: Array<{ id: string }>;
      secretProviders?: Array<{ id: string }>;
      workflowBlocks?: Array<{ id: string }>;
    };
    configSchema?: Record<string, unknown>;
  };
};

export type ExecutablePluginModule = {
  manifest: ExecutablePluginManifest;
  repositoryConnectors?: ExecutableRepositoryConnector[];
  webhookParsers?: ExecutableWebhookParser[];
  outputPublishers?: ExecutableOutputPublisher[];
  toolBundles?: ExecutableToolBundle[];
};

export type PluginContributionKind =
  | "repositoryConnector"
  | "webhookParser"
  | "outputPublisher"
  | "toolBundle"
  | "providerAdapter"
  | "authAdapter"
  | "knowledgeSource"
  | "knowledgeAsset"
  | "skill"
  | "taskBlueprint"
  | "environmentTemplate"
  | "navigationItem"
  | "settingsPanel"
  | "dashboardWidget"
  | "taskRunPanel"
  | "agentDetailTab"
  | "codebaseEngine"
  | "notificationChannel"
  | "secretProvider"
  | "workflowBlock";

export type ExecutableContributionKind =
  | "repositoryConnector"
  | "webhookParser"
  | "outputPublisher"
  | "toolBundle";

export type ExecutableContributionMap = {
  repositoryConnector: ExecutableRepositoryConnector;
  webhookParser: ExecutableWebhookParser;
  outputPublisher: ExecutableOutputPublisher;
  toolBundle: ExecutableToolBundle;
};

export type ExecutablePluginContribution<
  Kind extends ExecutableContributionKind = ExecutableContributionKind,
> = {
  id: string;
  kind: Kind;
  pluginId: string;
  pluginName: string;
  manifest: ExecutablePluginManifest;
  contribution: ExecutableContributionMap[Kind];
};

export type ExecutablePluginRegistry = {
  modules: ExecutablePluginModule[];
  contributions: ExecutablePluginContribution[];
  diagnostics: string[];
};

function loadBundledExecutablePluginModules(): ExecutablePluginModule[] {
  return [
    codehubExecutablePlugin,
    giteaExecutablePlugin,
  ];
}

const executableContributionAccessors = {
  repositoryConnector: (module: ExecutablePluginModule) => module.repositoryConnectors ?? [],
  webhookParser: (module: ExecutablePluginModule) => module.webhookParsers ?? [],
  outputPublisher: (module: ExecutablePluginModule) => module.outputPublishers ?? [],
  toolBundle: (module: ExecutablePluginModule) => module.toolBundles ?? [],
} satisfies {
  [Kind in ExecutableContributionKind]: (
    module: ExecutablePluginModule,
  ) => ExecutableContributionMap[Kind][];
};

const executableContributionManifestKeys = {
  repositoryConnector: "repositoryConnectors",
  webhookParser: "webhookParsers",
  outputPublisher: "outputPublishers",
  toolBundle: "toolBundles",
} satisfies Record<ExecutableContributionKind, keyof ExecutablePluginManifest["spec"]["contributions"]>;

function createExecutableContribution<Kind extends ExecutableContributionKind>(args: {
  kind: Kind;
  pluginModule: ExecutablePluginModule;
  contribution: ExecutableContributionMap[Kind];
}): ExecutablePluginContribution<Kind> {
  return {
    id: args.contribution.id,
    kind: args.kind,
    pluginId: args.pluginModule.manifest.metadata.id,
    pluginName: args.pluginModule.manifest.metadata.name,
    manifest: args.pluginModule.manifest,
    contribution: args.contribution,
  };
}

export function buildExecutablePluginRegistry(
  modules: ExecutablePluginModule[],
): ExecutablePluginRegistry {
  const contributions: ExecutablePluginContribution[] = [];
  const diagnostics: string[] = [];
  const seen = new Map<string, ExecutablePluginContribution>();

  for (const pluginModule of modules) {
    const pluginId = pluginModule.manifest.metadata.id;
    for (const kind of Object.keys(executableContributionAccessors) as ExecutableContributionKind[]) {
      const manifestKey = executableContributionManifestKeys[kind];
      const declaredIds = new Set(
        ((pluginModule.manifest.spec.contributions[manifestKey] ?? []) as Array<{ id: string }>)
          .map((item) => item.id)
          .filter(Boolean),
      );
      for (const contribution of executableContributionAccessors[kind](pluginModule)) {
        if (declaredIds.size > 0 && !declaredIds.has(contribution.id)) {
          diagnostics.push(
            `${pluginId}:${contribution.id} implements ${kind} but does not declare it in manifest.`,
          );
        }
        const record = createExecutableContribution({ kind, pluginModule, contribution });
        const duplicateKey = `${kind}:${record.id}`;
        if (seen.has(duplicateKey)) {
          diagnostics.push(
            `Duplicate ${kind} contribution id ${record.id} from ${pluginId}; first provider is ${seen.get(duplicateKey)?.pluginId}.`,
          );
          continue;
        }
        seen.set(duplicateKey, record);
        contributions.push(record);
      }
    }
  }

  return { modules, contributions, diagnostics };
}

const executablePluginRegistry = buildExecutablePluginRegistry(loadBundledExecutablePluginModules());

function pluginRoot() {
  return path.join("plugins", "official");
}

export function resolveSecretRef(ref: string) {
  const value = ref.trim();
  if (!value) return null;
  if (value.toLowerCase().startsWith("env:")) {
    throw new Error(uiText("pluginSdk.errors.envSecretRefUnsupported"));
  }
  return value;
}

export function toPluginManifest(module: ExecutablePluginModule): PluginManifest {
  return {
    id: module.manifest.metadata.id,
    name: module.manifest.metadata.name,
    version: module.manifest.metadata.version,
    capability: "code_repo",
    lifecycle: "declared",
    mountPoint: "execution-environment",
    configSchema: JSON.stringify(module.manifest.spec.configSchema ?? {}),
    requiredSecretRefs: [],
    permissions: module.manifest.spec.permissions.requested,
    healthCheck: `${module.manifest.spec.runtime.type}:${module.manifest.spec.runtime.entry}`,
    extensionOnly: true,
  };
}

export function listExecutablePluginModules() {
  return executablePluginRegistry.modules;
}

export function getExecutablePluginRegistrySnapshot() {
  return {
    modules: executablePluginRegistry.modules.map((module) => module.manifest),
    contributions: executablePluginRegistry.contributions.map((record) => ({
      id: record.id,
      kind: record.kind,
      pluginId: record.pluginId,
      pluginName: record.pluginName,
    })),
    diagnostics: executablePluginRegistry.diagnostics,
  };
}

export function listExecutablePluginContributions<Kind extends ExecutableContributionKind>(
  kind?: Kind,
) {
  const contributions = kind
    ? executablePluginRegistry.contributions.filter(
        (record): record is ExecutablePluginContribution<Kind> => record.kind === kind,
      )
    : executablePluginRegistry.contributions;
  return contributions;
}

export function listOfficialPluginManifests() {
  const dir = pluginRoot();
  if (!existsSync(dir)) {
    return executablePluginRegistry.modules.map(toPluginManifest);
  }

  const manifests: PluginManifest[] = [];
  for (const entry of readdirSync(dir)) {
    const filePath = path.join(dir, entry, "plugin.json");
    if (!existsSync(filePath)) continue;
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as ExecutablePluginManifest;
      manifests.push({
        id: parsed.metadata.id,
        name: parsed.metadata.name,
        version: parsed.metadata.version,
        capability: "code_repo",
        lifecycle: "declared",
        mountPoint: "execution-environment",
        configSchema: JSON.stringify(parsed.spec.configSchema ?? {}),
        requiredSecretRefs: [],
        permissions: parsed.spec.permissions.requested,
        healthCheck: `${parsed.spec.runtime.type}:${parsed.spec.runtime.entry}`,
        extensionOnly: true,
      });
    } catch {
      continue;
    }
  }

  const fallback = executablePluginRegistry.modules.map(toPluginManifest);
  const seen = new Set(manifests.map((manifest) => manifest.id));
  for (const manifest of fallback) {
    if (!seen.has(manifest.id)) manifests.push(manifest);
  }
  return manifests;
}

export function getExecutablePluginModule(pluginId: string) {
  return executablePluginRegistry.modules.find((module) => module.manifest.metadata.id === pluginId) ?? null;
}

function normalizeContributionRef(ref: string | null | undefined) {
  if (!ref) return null;
  const trimmed = ref.trim();
  return trimmed || null;
}

function resolveExecutableContribution<Kind extends ExecutableContributionKind>(
  kind: Kind,
  ref: string | null | undefined,
) {
  const normalizedRef = normalizeContributionRef(ref);
  if (!normalizedRef) return null;
  const contributions = listExecutablePluginContributions(kind);
  const [pluginIdFromQualifiedRef, contributionIdFromQualifiedRef] =
    normalizedRef.includes(":") ? normalizedRef.split(":", 2) : [null, null];

  const exact = contributions.find((record) => record.id === normalizedRef);
  if (exact) return exact.contribution;

  if (pluginIdFromQualifiedRef && contributionIdFromQualifiedRef) {
    const qualified = contributions.find(
      (record) =>
        record.pluginId === pluginIdFromQualifiedRef &&
        record.id === contributionIdFromQualifiedRef,
    );
    if (qualified) return qualified.contribution;
  }

  const pluginMatches = contributions.filter((record) => record.pluginId === normalizedRef);
  if (pluginMatches.length === 1) return pluginMatches[0]?.contribution ?? null;

  return null;
}

export function resolveRepositoryConnector(
  ref: string | null | undefined,
): ExecutableRepositoryConnector | null {
  return resolveExecutableContribution("repositoryConnector", ref) as ExecutableRepositoryConnector | null;
}

export function resolveWebhookParser(ref: string | null | undefined): ExecutableWebhookParser | null {
  return resolveExecutableContribution("webhookParser", ref) as ExecutableWebhookParser | null;
}

export function resolveOutputPublisher(
  ref: string | null | undefined,
): ExecutableOutputPublisher | null {
  return resolveExecutableContribution("outputPublisher", ref) as ExecutableOutputPublisher | null;
}

export function resolveToolBundle(ref: string | null | undefined): ExecutableToolBundle | null {
  return resolveExecutableContribution("toolBundle", ref) as ExecutableToolBundle | null;
}

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecord(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeJson(value: unknown, fallback: unknown = {}) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, rawValue]) => {
      const lower = key.toLowerCase();
      const isSecretRef = lower.endsWith("ref") && typeof rawValue === "string";
      const isSensitive =
        /(secret|token|password|privatekey|private_key|credential|apikey|api_key)/i.test(key);
      if (isSensitive && !isSecretRef) return [key, "[masked]"];
      return [key, redactSensitive(rawValue)];
    }),
  );
}

function getNextEventSeq(taskRunId: string) {
  const row = queryOne<{ maxSeq: number | null }>(
    "SELECT MAX(seq) as maxSeq FROM event_logs WHERE task_run_id = ?",
    taskRunId,
  );
  return (row?.maxSeq ?? 0) + 1;
}

function stringifyEventContent(event: { type: string; payload: Record<string, unknown> }) {
  const payload = event.payload;
  const content = payload.content ?? payload.message ?? payload.summary ?? payload.title;
  return typeof content === "string" && content.trim()
    ? content
    : `Plugin emitted ${event.type}.`;
}

function normalizeVisibility(value: unknown) {
  return ["public", "team_only", "owner_only", "system_internal", "secret_masked"].includes(
    String(value),
  )
    ? String(value)
    : "team_only";
}

function normalizeEffect(value: unknown): PluginPermissionDecision["effect"] | null {
  if (value === "deny" || value === "ask" || value === "allow") return value;
  return null;
}

function resourceMatches(ruleResource: string | undefined, requestedResource: string) {
  if (!ruleResource || ruleResource === "*") return true;
  if (ruleResource === requestedResource) return true;
  if (ruleResource.endsWith(".*")) {
    return requestedResource.startsWith(ruleResource.slice(0, -1));
  }
  if (ruleResource.endsWith("*")) {
    return requestedResource.startsWith(ruleResource.slice(0, -1));
  }
  return false;
}

function scopeMatches(ruleScope: string | undefined, requestedScope: string | undefined) {
  if (!ruleScope || ruleScope === "*") return true;
  if (!requestedScope) return true;
  if (ruleScope === requestedScope) return true;
  if (ruleScope.endsWith("*")) return requestedScope.startsWith(ruleScope.slice(0, -1));
  return false;
}

function permissionResourceAliases(resource: string) {
  const aliases: Record<string, string[]> = {
    "repo.read": ["tool.repo.context.read", "tool.git.diff.read", "tool.repo.clone.read"],
    "repo.mr.comment": ["tool.mr.comment.write"],
    "repo.issue.comment": ["tool.issue.comment.write", "tool.mr.comment.write"],
    "repo.mr.merge": ["tool.repo.write"],
    "secret.use": ["tool.secret.use"],
  };
  return [resource, ...(aliases[resource] ?? [])];
}

function collectPermissionRules(input: PluginRuntimeContextInput) {
  const snapshot = parseRecord(input.taskRun?.permissionSnapshotJson);
  const snapshotRules = Array.isArray(snapshot.rules)
    ? snapshot.rules.filter(isRecord).map((rule) => rule as PluginPermissionRule)
    : [];
  return [...(input.permissionRules ?? []), ...snapshotRules];
}

function decidePermission(
  request: PluginPermissionRequest,
  rules: PluginPermissionRule[],
): PluginPermissionDecision | null {
  const resourceCandidates = permissionResourceAliases(request.resource);
  const matched = rules.filter(
    (rule) =>
      resourceCandidates.some((resource) => resourceMatches(rule.resource, resource)) &&
      scopeMatches(rule.scope, request.scope),
  );
  for (const effect of ["deny", "ask", "allow"] as const) {
    const rule = matched.find((candidate) => normalizeEffect(candidate.effect) === effect);
    if (rule) return { effect, reason: rule.reason };
  }
  return null;
}

function buildTaskContext(input: PluginRuntimeContextInput) {
  const taskRun = input.taskRun;
  const blueprint = input.blueprint;
  return {
    taskRun: taskRun
      ? {
          id: taskRun.id,
          tenantSpaceId: taskRun.tenantSpaceId,
          businessTeamId: taskRun.businessTeamId,
          agentTeamId: taskRun.teamId,
          blueprintId: taskRun.blueprintId,
          sourceType: taskRun.sourceType,
          sourceRef: taskRun.sourceRef,
          status: taskRun.status,
          runState: taskRun.runState,
          traceId: taskRun.traceId,
          inputPayload: parseRecord(taskRun.inputPayloadJson),
          outputPayload: parseRecord(taskRun.outputPayloadJson),
          permissionSnapshot: parseRecord(taskRun.permissionSnapshotJson),
        }
      : null,
    blueprint: blueprint
      ? {
          id: blueprint.id,
          name: blueprint.name,
          category: blueprint.category,
          visibility: blueprint.visibility,
          ownerBusinessTeamId: blueprint.ownerBusinessTeamId,
          agentTeamId: blueprint.teamId,
          trigger: parseRecord(blueprint.triggerJson),
          memoryPolicy: parseRecord(blueprint.memoryPolicyJson),
          providerPolicy: parseRecord(blueprint.providerPolicyJson),
          permissionPolicy: parseRecord(blueprint.permissionPolicyJson),
          outputPolicy: parseRecord(blueprint.outputPolicyJson),
          executionPolicy: parseRecord(blueprint.executionPolicyJson),
        }
      : null,
  };
}

function buildEnvironmentContext(input: PluginRuntimeContextInput) {
  const snapshot = input.environmentSnapshot;
  return snapshot
    ? {
        id: snapshot.id,
        taskRunId: snapshot.taskRunId,
        templateId: snapshot.templateId,
        environmentId: snapshot.environmentId,
        snapshot: redactSensitive(parseRecord(snapshot.snapshotJson)),
        createdAt: snapshot.createdAt,
      }
    : {};
}

export function createPluginRuntimeContext(
  pluginId: string,
  input: PluginRuntimeContextInput = {},
): PluginRuntimeContext {
  async function requestPluginPermission(
    request: PluginPermissionRequest,
  ): Promise<PluginPermissionDecision> {
    const decision = decidePermission(request, collectPermissionRules(input));
    if (decision) return decision;

    if (
      request.resource === "repo.read" ||
      request.resource === "repo.mr.comment" ||
      request.resource === "repo.issue.comment" ||
      request.resource === "secret.use" ||
      request.resource.startsWith("webhook.")
    ) {
      return { effect: "allow" };
    }

    return {
      effect: "ask",
    };
  }

  async function emitPluginEvent(event: {
    type: string;
    payload: Record<string, unknown>;
  }) {
    if (!input.taskRun) return;

    const eventId = randomUUID();
    const createdAt = nowIso();
    const payload = redactSensitive({
      ...event.payload,
      pluginId,
    }) as Record<string, unknown>;
    const phase = event.type || "plugin_event";
    const title =
      typeof payload.title === "string" && payload.title.trim()
        ? payload.title
        : `Plugin event: ${phase}`;

    execute(
      "INSERT INTO event_logs (id, trace_id, task_run_id, node_id, seq, phase, fold_group, title, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      eventId,
      input.traceId ?? input.taskRun.traceId,
      input.taskRun.id,
      null,
      getNextEventSeq(input.taskRun.id),
      phase,
      "Plugin",
      title,
      stringifyEventContent({ type: phase, payload }),
      safeJson(payload),
      createdAt,
    );
    execute(
      "INSERT INTO task_events (id, task_run_id, agent_run_id, event_type, event_time, visibility, payload_json, raw_payload_ref, parent_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      eventId,
      input.taskRun.id,
      null,
      phase,
      createdAt,
      normalizeVisibility(payload.visibility),
      safeJson(payload),
      typeof payload.rawPayloadRef === "string" ? payload.rawPayloadRef : null,
      typeof payload.parentEventId === "string" ? payload.parentEventId : null,
    );
  }

  return {
    pluginId,
    configuration: input.configuration,
    async readTaskContext() {
      return buildTaskContext(input);
    },
    async readEnvironment() {
      return buildEnvironmentContext(input);
    },
    async resolveSecretRef(ref: string) {
      const decision = await requestPluginPermission({ resource: "secret.use", scope: ref });
      if (decision.effect === "deny") {
        throw new Error(decision.reason ?? `Permission denied: secret.use ${ref}`);
      }
      return resolveSecretRef(ref);
    },
    async requestPermission(request: PluginPermissionRequest) {
      return requestPluginPermission(request);
    },
    async emitEvent(event) {
      await emitPluginEvent(event);
    },
    async createFinding(findingInput) {
      if (!input.taskRun) return `finding:${pluginId}:${Date.now()}`;
      const decision = await requestPluginPermission({
        resource: "tool.finding.create",
        scope: "task_run",
      });
      if (decision.effect === "deny") {
        throw new Error(decision.reason ?? "Permission denied: tool.finding.create");
      }

      const finding = upsertFinding({
        taskRunId: input.taskRun.id,
        sourceAgent:
          typeof findingInput.sourceAgent === "string" ? findingInput.sourceAgent : pluginId,
        category: typeof findingInput.category === "string" ? findingInput.category : "plugin",
        severity: typeof findingInput.severity === "string" ? findingInput.severity : "info",
        confidence:
          typeof findingInput.confidence === "number" || typeof findingInput.confidence === "string"
            ? findingInput.confidence
            : 1,
        title:
          typeof findingInput.title === "string" && findingInput.title.trim()
            ? findingInput.title
            : `Plugin finding from ${pluginId}`,
        description:
          typeof findingInput.description === "string" ? findingInput.description : "",
        evidenceJson: isRecord(findingInput.evidence)
          ? findingInput.evidence
          : isRecord(findingInput.evidenceJson)
            ? findingInput.evidenceJson
            : {},
        recommendation:
          typeof findingInput.recommendation === "string"
            ? findingInput.recommendation
            : "",
        skillRefsJson: Array.isArray(findingInput.knowledgeRefs)
          ? findingInput.knowledgeRefs.map(String)
          : Array.isArray(findingInput.skillRefs)
            ? findingInput.skillRefs.map(String)
            : Array.isArray(findingInput.skillRefsJson)
              ? findingInput.skillRefsJson.map(String)
              : [],
        fingerprint: typeof findingInput.fingerprint === "string" ? findingInput.fingerprint : undefined,
        status: typeof findingInput.status === "string" ? findingInput.status : "open",
        publicationJson: isRecord(findingInput.publication)
          ? findingInput.publication
          : isRecord(findingInput.publicationJson)
            ? findingInput.publicationJson
            : { channels: [] },
      });

      await emitPluginEvent({
        type: "finding_created",
        payload: {
          title: finding?.title ?? findingInput.title,
          findingId: finding?.id,
          severity: finding?.severity,
        },
      });
      return finding?.id ?? `finding:${pluginId}:${Date.now()}`;
    },
    async createArtifact(artifactInput) {
      const decision = await requestPluginPermission({
        resource: "tool.artifact.write",
        scope: "task_archive",
      });
      if (decision.effect === "deny") {
        throw new Error(decision.reason ?? "Permission denied: tool.artifact.write");
      }
      const artifactId = `artifact:${input.taskRun?.id ?? pluginId}:${randomUUID()}`;
      await emitPluginEvent({
        type: "artifact_generated",
        payload: {
          artifactId,
          ...artifactInput,
        },
      });
      return artifactId;
    },
  };
}
