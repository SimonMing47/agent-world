import {
  type Agent,
  type BusinessTeam,
  type ProviderAdapterDefinition,
  type ProviderProfile,
  type TenantSpace,
} from "@/server/db";

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

export type ProviderExecutionMode = {
  id: string;
  name: string;
  command: string;
  secretRefs: string[];
  status: "default" | "plugin";
  note: string;
};

export function listProviderExecutionModes(): ProviderExecutionMode[] {
  return [
    {
      id: "pi-runtime-adapter",
      name: "Pi Runtime Adapter",
      command: "@earendil-works/pi-agent-core",
      secretRefs: ["env:AGENTWORLD_GLM_API_KEY", "env:OPENAI_API_KEY"],
      status: "default",
      note: "默认执行层，主干通过 Pi Agent Core 和 Pi AI 嵌入式发起真实会话。",
    },
    {
      id: "hermes-runtime-adapter",
      name: "Hermes Runtime Adapter",
      command: "plugin://runtime-adapter/hermes",
      secretRefs: [],
      status: "plugin",
      note: "通过运行时插件扩展，不修改主干执行流程。",
    },
    {
      id: "langgraph-runtime-adapter",
      name: "LangGraph Runtime Adapter",
      command: "plugin://runtime-adapter/langgraph",
      secretRefs: [],
      status: "plugin",
      note: "通过运行时插件扩展，作为编排引擎候选。",
    },
  ];
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
          `租户空间模型白名单允许使用 ${whitelist.join(", ")}。`,
          `业务团队的偏好 Provider 为 ${businessTeamPolicy.preferredProvider ?? "未显式指定"}。`,
          `Agent ${args.agent.name} 当前偏好模型是 ${args.agent.model}。`,
        ]
      : ["当前没有启用中的 Provider 同时满足模型白名单约束。"],
  };
}
