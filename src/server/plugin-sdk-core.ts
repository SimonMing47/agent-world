import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PluginManifest } from "@/server/plugin-core";
import { codehubExecutablePlugin } from "@/server/plugins/official/codehub";

export type PluginPermissionRequest = {
  resource: string;
  scope?: string;
};

export type PluginPermissionDecision = {
  effect: "allow" | "ask" | "deny";
  reason?: string;
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

const executablePluginModules: ExecutablePluginModule[] = [codehubExecutablePlugin];

function pluginRoot() {
  return path.join(process.cwd(), "plugins", "official");
}

export function resolveSecretRef(ref: string) {
  if (!ref) return null;
  if (ref.startsWith("env:")) {
    return process.env[ref.slice(4)] ?? null;
  }
  return null;
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
  return executablePluginModules;
}

export function listOfficialPluginManifests() {
  const dir = pluginRoot();
  if (!existsSync(dir)) {
    return executablePluginModules.map(toPluginManifest);
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

  const fallback = executablePluginModules.map(toPluginManifest);
  const seen = new Set(manifests.map((manifest) => manifest.id));
  for (const manifest of fallback) {
    if (!seen.has(manifest.id)) manifests.push(manifest);
  }
  return manifests;
}

export function getExecutablePluginModule(pluginId: string) {
  return executablePluginModules.find((module) => module.manifest.metadata.id === pluginId) ?? null;
}

export function resolveWebhookParser(ref: string | null | undefined) {
  if (!ref) return null;

  for (const pluginModule of executablePluginModules) {
    for (const parser of pluginModule.webhookParsers ?? []) {
      if (parser.id === ref) return parser;
    }
    if (
      pluginModule.manifest.metadata.id === ref &&
      (pluginModule.webhookParsers?.length ?? 0) === 1
    ) {
      return pluginModule.webhookParsers?.[0] ?? null;
    }
  }

  return null;
}

export function resolveOutputPublisher(ref: string | null | undefined) {
  if (!ref) return null;

  for (const pluginModule of executablePluginModules) {
    for (const publisher of pluginModule.outputPublishers ?? []) {
      if (publisher.id === ref) return publisher;
    }
    if (
      pluginModule.manifest.metadata.id === ref &&
      (pluginModule.outputPublishers?.length ?? 0) === 1
    ) {
      return pluginModule.outputPublishers?.[0] ?? null;
    }
  }

  return null;
}

export function resolveToolBundle(ref: string | null | undefined) {
  if (!ref) return null;

  for (const pluginModule of executablePluginModules) {
    for (const bundle of pluginModule.toolBundles ?? []) {
      if (bundle.id === ref) return bundle;
    }
    if (
      pluginModule.manifest.metadata.id === ref &&
      (pluginModule.toolBundles?.length ?? 0) === 1
    ) {
      return pluginModule.toolBundles?.[0] ?? null;
    }
  }

  return null;
}

export function createPluginRuntimeContext(pluginId: string): PluginRuntimeContext {
  return {
    pluginId,
    async readTaskContext() {
      return {};
    },
    async readEnvironment() {
      return {};
    },
    async resolveSecretRef(ref: string) {
      return resolveSecretRef(ref);
    },
    async requestPermission(input: PluginPermissionRequest) {
      return {
        effect: input.resource.startsWith("repo.") ? "allow" : "ask",
      } satisfies PluginPermissionDecision;
    },
    async emitEvent() {
      return;
    },
    async createFinding() {
      return `finding:${pluginId}:${Date.now()}`;
    },
    async createArtifact() {
      return `artifact:${pluginId}:${Date.now()}`;
    },
  };
}
