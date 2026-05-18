import {
  type Agent,
  type BusinessTeam,
  type ProviderAdapterDefinition,
  type ProviderProfile,
  type TenantSpace,
} from "@/server/db";
import { uiText } from "@/lib/language-pack";

export type ProviderCapability =
  | "session.create"
  | "event.stream"
  | "message.send"
  | "session.cancel"
  | "artifact.collect"
  | "runtime.discover";

export type ProviderEventType =
  | "session_started"
  | "agent_message"
  | "tool_call_requested"
  | "tool_call_started"
  | "tool_call_finished"
  | "file_changed"
  | "command_executed"
  | "memory_retrieved"
  | "artifact_generated"
  | "finding_created"
  | "human_approval_required"
  | "session_failed"
  | "session_completed";

export type ProviderEvent = {
  id: string;
  sessionId: string;
  type: ProviderEventType;
  timestamp: string;
  visibility: "public" | "team_only" | "owner_only" | "system_internal" | "secret_masked";
  payload: Record<string, unknown>;
};

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type CreateSessionInput = {
  taskRunId: string;
  workspaceRef: string;
  agentId: string;
  systemPrompt: string;
  input: Record<string, unknown>;
  permissions: Record<string, unknown>;
};

export type ProviderSession = {
  id: string;
  providerAdapterId: string;
  taskRunId: string;
  status: "created" | "running" | "failed" | "completed" | "cancelled";
};

export type AgentMessage = {
  role: "system" | "user" | "agent" | "tool";
  content: string;
  metadata?: Record<string, unknown>;
};

export type Artifact = {
  id: string;
  type: string;
  title: string;
  uri: string;
  metadata?: Record<string, unknown>;
};

export interface ProviderAdapter {
  id: string;
  name: string;
  capabilities(): ProviderCapability[];
  validateConfig(config: Record<string, unknown>): Promise<ValidationResult>;
  createSession(input: CreateSessionInput): Promise<ProviderSession>;
  streamEvents(sessionId: string): AsyncIterable<ProviderEvent>;
  sendMessage(sessionId: string, message: AgentMessage): Promise<void>;
  cancel(sessionId: string): Promise<void>;
  collectArtifacts(sessionId: string): Promise<Artifact[]>;
}

function parseArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

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

export function summarizeProviderAdapter(adapter: ProviderAdapterDefinition) {
  return {
    id: adapter.id,
    name: adapter.name,
    adapterType: adapter.adapterType,
    entryRef: adapter.entryRef,
    version: adapter.version,
    lifecycle: adapter.lifecycle,
    capabilities: parseArray(adapter.capabilitiesJson),
    configSchema: parseRecord(adapter.configSchemaJson),
    secretRefs: parseArray(adapter.secretRefsJson),
    permissionRefs: parseArray(adapter.permissionRefsJson),
    healthStatus: adapter.healthStatus,
  };
}

export function buildProviderSelection(args: {
  tenantSpace: TenantSpace;
  businessTeam: BusinessTeam;
  agent: Agent;
  providers: ProviderProfile[];
}) {
  const whitelist = JSON.parse(args.tenantSpace.modelWhitelistJson) as string[];
  const businessTeamPolicy = JSON.parse(args.businessTeam.policyJson) as {
    preferredProvider?: string;
  };

  const availableProviders = args.providers.filter((provider) => {
    const models = JSON.parse(provider.modelsJson) as string[];
    return provider.isEnabled && models.some((model) => whitelist.includes(model));
  });

  const preferred =
    availableProviders.find((provider) => provider.name === businessTeamPolicy.preferredProvider) ??
    availableProviders.find((provider) =>
      (JSON.parse(provider.modelsJson) as string[]).includes(args.agent.model),
    ) ??
    availableProviders[0] ??
    null;

  return {
    provider: preferred,
    whitelist,
    rationale: preferred
      ? [
          uiText("ui.server.provider.whitelist", undefined, { models: whitelist.join(", ") }),
          uiText("ui.server.provider.preferredProvider", undefined, {
            provider: businessTeamPolicy.preferredProvider ?? uiText("ui.generated.c2ac7331066"),
          }),
          uiText("ui.server.provider.agentModel", undefined, {
            agentName: args.agent.name,
            model: args.agent.model,
          }),
        ]
      : [uiText("ui.generated.c746d02e660")],
  };
}
