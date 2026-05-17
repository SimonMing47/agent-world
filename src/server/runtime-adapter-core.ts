import { Agent, type AgentEvent, type AgentMessage } from "@earendil-works/pi-agent-core";
import { completeSimple, type AssistantMessage, type Model } from "@earendil-works/pi-ai";
import { buildAgentHarnessExecutionProfile } from "@/server/agent-harness-core";
import { type ProviderProfile, type ProviderRuntimeBinding } from "@/server/db";
import { buildReadOnlyWorkspaceTools } from "@/server/pi-agent-toolset";
import {
  buildPiModel,
  buildRuntimeDescriptor,
  resolveProviderApiKey,
} from "@/server/runtime-provider-config";

export type DiscoveredRuntime = {
  baseUrl: string;
  status: "healthy" | "degraded" | "offline";
  agents: string[];
  providers: string[];
  latencyMs: number | null;
  note: string;
};

export type RuntimeSessionMode = "single_agent" | "agent_team";

export type RuntimeAgentProfile = {
  id?: string | null;
  name: string;
  role: string;
  personaPrompt: string;
  harnessConfigJson?: string | null;
  permissionPolicyJson?: string | null;
};

export type RuntimeTeamPlan = {
  teamId: string;
  teamName: string;
  leaderAgentId?: string | null;
  actors: RuntimeAgentProfile[];
};

export type RuntimeSessionContext = {
  sessionId: string;
  mode: RuntimeSessionMode;
  title: string;
  systemPrompt: string;
  model: string;
  runtimeBinding: ProviderRuntimeBinding;
  providerProfile: ProviderProfile;
};

export type RuntimeSessionEnvelope =
  | {
      type: "runtime.session.started" | "runtime.session.resumed" | "runtime.session.cancelled";
      sessionId: string;
      occurredAt: string;
      payload: Record<string, unknown>;
    }
  | {
      type: "runtime.agent.event";
      sessionId: string;
      occurredAt: string;
      payload: {
        actorId?: string | null;
        actorName: string;
        turnIndex: number;
        eventType: AgentEvent["type"];
      };
    }
  | {
      type: "runtime.permission.ask";
      sessionId: string;
      occurredAt: string;
      payload: {
        actorId?: string | null;
        actorName: string;
        turnIndex: number;
        toolName: string;
        args: Record<string, unknown>;
        approvalMode: ReturnType<typeof buildAgentHarnessExecutionProfile>["approvalMode"];
      };
    };

export type RuntimeAgentEventCallback = (args: {
  actorId?: string | null;
  actorName: string;
  turnIndex: number;
  event: AgentEvent;
}) => void;

export type RuntimeSystemEventCallback = (event: RuntimeSessionEnvelope) => void;

export type InvokeAgentNodeInput = {
  session: RuntimeSessionContext;
  agent: RuntimeAgentProfile | null;
  latestUserMessage: string;
  turnIndex: number;
  instructions?: string;
  teamContext?: {
    teamName: string;
    leaderName?: string;
  } | null;
  getTranscript: () => AgentMessage[];
  onAgentEvent: RuntimeAgentEventCallback;
  onRuntimeEvent?: RuntimeSystemEventCallback;
};

export type InvokeAgentNodeResult = {
  actorId?: string | null;
  actorName: string;
  assistantText: string;
  thinkingText: string;
  responseModel?: string;
};

export type InvokeTeamPlanInput = {
  session: RuntimeSessionContext;
  teamPlan: RuntimeTeamPlan;
  latestUserMessage: string;
  turnIndex: number;
  getTranscript: () => AgentMessage[];
  onAgentEvent: RuntimeAgentEventCallback;
  onRuntimeEvent?: RuntimeSystemEventCallback;
};

export type InvokeTeamPlanResult = {
  leader: InvokeAgentNodeResult | null;
  workers: InvokeAgentNodeResult[];
  synthesis: InvokeAgentNodeResult | null;
};

export interface AgentRuntimeInterface {
  id: string;
  label: string;
  healthCheck(args: {
    binding: ProviderRuntimeBinding;
    provider: ProviderProfile | null;
    agentCatalog: Array<{ name: string }>;
  }): Promise<DiscoveredRuntime>;
  startSession(session: RuntimeSessionContext): Promise<void>;
  resumeSession(args: {
    sessionId: string;
    actorName: string;
    content: string;
  }): Promise<boolean>;
  streamEvents(sessionId: string): AsyncIterable<RuntimeSessionEnvelope>;
  invokeAgentNode(input: InvokeAgentNodeInput): Promise<InvokeAgentNodeResult>;
  invokeTeamPlan(input: InvokeTeamPlanInput): Promise<InvokeTeamPlanResult>;
  cancel(sessionId: string): Promise<void>;
  collectArtifacts(sessionId: string): Promise<Array<Record<string, unknown>>>;
}

type SessionStreamState = {
  agents: Set<Agent>;
  queue: RuntimeSessionEnvelope[];
  waiters: Array<(result: IteratorResult<RuntimeSessionEnvelope>) => void>;
  closed: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function buildAgentCatalog(
  _binding: ProviderRuntimeBinding,
  agents: Array<{ name: string }>,
) {
  const names = agents.map((agent) => agent.name).filter(Boolean);
  return names.slice(0, Math.max(6, names.length || 0));
}

function buildAgentPrompt(args: {
  session: RuntimeSessionContext;
  teamContext?: {
    teamName: string;
    leaderName?: string;
  } | null;
  agent: RuntimeAgentProfile | null;
  runtimeBinding: ProviderRuntimeBinding;
  providerProfile: ProviderProfile;
  instructions?: string;
}) {
  const header = args.agent
    ? `You are ${args.agent.name}. Role: ${args.agent.role}. Persona: ${args.agent.personaPrompt}`
    : "You are the runtime assistant.";
  const teamContext = args.teamContext
    ? `Team: ${args.teamContext.teamName}.${args.teamContext.leaderName ? ` Leader: ${args.teamContext.leaderName}.` : ""}`
    : "No agent team is attached to this session.";
  const runtimeContext = `Runtime binding: ${args.runtimeBinding.name}. Provider profile: ${args.providerProfile.name}. Actual configured model: ${args.session.model}. When asked about your current provider or model, answer from this runtime metadata instead of prior model lore.`;

  return [header, teamContext, runtimeContext, args.session.systemPrompt, args.instructions ?? ""]
    .filter(Boolean)
    .join("\n\n");
}

function flattenVisibleText(message: AssistantMessage | null) {
  if (!message) return "";
  return message.content
    .map((block) => (block.type === "text" ? block.text ?? "" : ""))
    .filter(Boolean)
    .join("\n");
}

function flattenThinkingText(message: AssistantMessage | null) {
  if (!message) return "";
  return message.content
    .map((block) => (block.type === "thinking" ? block.thinking ?? "" : ""))
    .filter(Boolean)
    .join("\n");
}

class PiRuntimeAdapter implements AgentRuntimeInterface {
  id = "pi-runtime-adapter";
  label = "AgentWorld Runtime Adapter";
  private readonly sessionStreams = new Map<string, SessionStreamState>();

  private getSessionState(sessionId: string) {
    const existing = this.sessionStreams.get(sessionId);
    if (existing) return existing;

    const state: SessionStreamState = {
      agents: new Set<Agent>(),
      queue: [],
      waiters: [],
      closed: false,
    };
    this.sessionStreams.set(sessionId, state);
    return state;
  }

  private emit(sessionId: string, event: RuntimeSessionEnvelope) {
    const state = this.getSessionState(sessionId);
    if (state.waiters.length > 0) {
      const waiter = state.waiters.shift();
      waiter?.({ value: event, done: false });
      return;
    }
    state.queue.push(event);
  }

  private close(sessionId: string) {
    const state = this.getSessionState(sessionId);
    state.closed = true;
    while (state.waiters.length > 0) {
      const waiter = state.waiters.shift();
      waiter?.({ value: undefined, done: true });
    }
  }

  async healthCheck(args: {
    binding: ProviderRuntimeBinding;
    provider: ProviderProfile | null;
    agentCatalog: Array<{ name: string }>;
  }) {
    const start = Date.now();
    const descriptor = buildRuntimeDescriptor(args.binding, args.provider);
    if (!args.provider) {
      return {
        baseUrl: args.binding.baseUrl,
        status: "degraded",
        agents: buildAgentCatalog(args.binding, args.agentCatalog),
        providers: [],
        latencyMs: null,
        note: "未绑定模型接口，无法校验运行时。",
      } satisfies DiscoveredRuntime;
    }

    const apiKey = resolveProviderApiKey(args.provider, args.binding);
    if (!apiKey) {
      return {
        baseUrl: args.binding.baseUrl,
        status: "degraded",
        agents: buildAgentCatalog(args.binding, args.agentCatalog),
        providers: [args.provider.name],
        latencyMs: null,
        note: `缺少 API Key：${descriptor.apiKeyRefMasked || "未配置 secret ref"}`,
      } satisfies DiscoveredRuntime;
    }

    try {
      const model = buildPiModel(args.provider, args.binding);
      const response = await completeSimple(
        model,
        {
          messages: [
            {
              role: "user",
              content: "Reply with OK.",
              timestamp: Date.now(),
            },
          ],
        },
        {
          apiKey,
          maxTokens: 8,
          reasoning: "minimal",
        },
      );

      return {
        baseUrl: args.binding.baseUrl,
        status: response.stopReason === "error" ? "degraded" : "healthy",
        agents: buildAgentCatalog(args.binding, args.agentCatalog),
        providers: [args.provider.name],
        latencyMs: Date.now() - start,
        note:
          response.stopReason === "error"
            ? response.errorMessage ?? "Provider 返回错误。"
            : `系统内置运行接口已通过 ${descriptor.providerLabel} 完成真实对话校验。`,
      } satisfies DiscoveredRuntime;
    } catch (error) {
      return {
        baseUrl: args.binding.baseUrl,
        status: "offline",
        agents: buildAgentCatalog(args.binding, args.agentCatalog),
        providers: [args.provider.name],
        latencyMs: null,
        note: error instanceof Error ? error.message : "运行接口校验失败",
      } satisfies DiscoveredRuntime;
    }
  }

  async startSession(session: RuntimeSessionContext) {
    this.getSessionState(session.sessionId);
    this.emit(session.sessionId, {
      type: "runtime.session.started",
      sessionId: session.sessionId,
      occurredAt: nowIso(),
      payload: {
        mode: session.mode,
        runtimeBindingId: session.runtimeBinding.id,
        providerProfileId: session.providerProfile.id,
      },
    });
  }

  async resumeSession(args: { sessionId: string; actorName: string; content: string }) {
    const state = this.getSessionState(args.sessionId);
    if (state.agents.size === 0) return false;

    for (const agent of state.agents) {
      agent.steer({
        role: "user",
        content: args.content,
        timestamp: Date.now(),
      });
    }

    this.emit(args.sessionId, {
      type: "runtime.session.resumed",
      sessionId: args.sessionId,
      occurredAt: nowIso(),
      payload: {
        actorName: args.actorName,
      },
    });
    return true;
  }

  async *streamEvents(sessionId: string) {
    const state = this.getSessionState(sessionId);
    while (true) {
      if (state.queue.length > 0) {
        const next = state.queue.shift();
        if (next) yield next;
        continue;
      }

      if (state.closed) return;

      const result = await new Promise<IteratorResult<RuntimeSessionEnvelope>>((resolve) => {
        state.waiters.push(resolve);
      });
      if (result.done) return;
      yield result.value;
    }
  }

  async invokeAgentNode(input: InvokeAgentNodeInput) {
    const model = buildPiModel(input.session.providerProfile, input.session.runtimeBinding) as Model<string>;
    const harnessProfile = buildAgentHarnessExecutionProfile(
      input.agent ?? {},
      input.session.runtimeBinding,
    );
    const approvalMode = harnessProfile.approvalMode;
    const toolSet = buildReadOnlyWorkspaceTools(input.session.runtimeBinding.workspaceRoot, {
      approvalMode,
      allowedToolNames: harnessProfile.allowedToolNames,
      deniedToolNames: harnessProfile.deniedToolNames,
    });
    const state = this.getSessionState(input.session.sessionId);
    let finalAssistant: AssistantMessage | null = null;

    const agent = new Agent({
      initialState: {
        systemPrompt: buildAgentPrompt({
          session: input.session,
          teamContext: input.teamContext ?? null,
          agent: input.agent,
          runtimeBinding: input.session.runtimeBinding,
          providerProfile: input.session.providerProfile,
          instructions: input.instructions,
        }),
        model,
        thinkingLevel: harnessProfile.thinkingLevel,
        messages: input.getTranscript().filter(
          (message) => message.role !== "user" || message.content !== input.latestUserMessage,
        ),
        tools: toolSet,
      },
      sessionId: `${input.session.sessionId}:${input.agent?.name ?? "runtime-assistant"}`,
      getApiKey: () =>
        resolveProviderApiKey(input.session.providerProfile, input.session.runtimeBinding) ?? undefined,
      beforeToolCall: async (context) => {
        if (approvalMode === "allow") return undefined;
        const envelope: RuntimeSessionEnvelope = {
          type: "runtime.permission.ask",
          sessionId: input.session.sessionId,
          occurredAt: nowIso(),
          payload: {
            actorId: input.agent?.id ?? null,
            actorName: input.agent?.name ?? "Runtime Assistant",
            turnIndex: input.turnIndex,
            toolName: context.toolCall.name,
            args: context.args as Record<string, unknown>,
            approvalMode,
          },
        };
        this.emit(input.session.sessionId, envelope);
        input.onRuntimeEvent?.(envelope);

        return {
          block: true,
          reason:
            approvalMode === "deny"
              ? `Tool ${context.toolCall.name} is denied by runtime policy.`
              : `Tool ${context.toolCall.name} requires human approval in this runtime.`,
        };
      },
    });

    state.agents.add(agent);
    agent.subscribe((event) => {
      this.emit(input.session.sessionId, {
        type: "runtime.agent.event",
        sessionId: input.session.sessionId,
        occurredAt: nowIso(),
        payload: {
          actorId: input.agent?.id ?? null,
          actorName: input.agent?.name ?? "Runtime Assistant",
          turnIndex: input.turnIndex,
          eventType: event.type,
        },
      });
      input.onAgentEvent({
        actorId: input.agent?.id ?? null,
        actorName: input.agent?.name ?? "Runtime Assistant",
        turnIndex: input.turnIndex,
        event,
      });
      if (event.type === "message_end" && event.message.role === "assistant") {
        finalAssistant = event.message as AssistantMessage;
      }
    });

    try {
      await agent.prompt(input.latestUserMessage);
      return {
        actorId: input.agent?.id ?? null,
        actorName: input.agent?.name ?? "Runtime Assistant",
        assistantText: flattenVisibleText(finalAssistant),
        thinkingText: flattenThinkingText(finalAssistant),
      } satisfies InvokeAgentNodeResult;
    } finally {
      state.agents.delete(agent);
    }
  }

  async invokeTeamPlan(input: InvokeTeamPlanInput) {
    const leader =
      input.teamPlan.leaderAgentId
        ? input.teamPlan.actors.find((agent) => agent.id === input.teamPlan.leaderAgentId) ??
          input.teamPlan.actors[0]
        : input.teamPlan.actors[0];
    const workers = input.teamPlan.actors.filter((agent) => agent.id !== leader?.id);
    const leaderName = leader?.name ?? "Team Leader";

    const leaderResult = leader
      ? await this.invokeAgentNode({
          session: input.session,
          agent: leader,
          latestUserMessage: input.latestUserMessage,
          turnIndex: input.turnIndex,
          instructions:
            "First, produce a short execution plan for the team. Keep it concise and oriented toward collaboration.",
          teamContext: {
            teamName: input.teamPlan.teamName,
            leaderName,
          },
          getTranscript: input.getTranscript,
          onAgentEvent: input.onAgentEvent,
          onRuntimeEvent: input.onRuntimeEvent,
        })
      : null;

    const workerResults = await Promise.all(
      workers.map((worker) =>
        this.invokeAgentNode({
          session: input.session,
          agent: worker,
          latestUserMessage: input.latestUserMessage,
          turnIndex: input.turnIndex,
          instructions: `Leader context:\n${leaderResult?.assistantText || "No leader context yet."}\n\nReturn your contribution to the team, not to the end user.`,
          teamContext: {
            teamName: input.teamPlan.teamName,
            leaderName,
          },
          getTranscript: input.getTranscript,
          onAgentEvent: input.onAgentEvent,
          onRuntimeEvent: input.onRuntimeEvent,
        }),
      ),
    );

    const synthesis = leader
      ? await this.invokeAgentNode({
          session: input.session,
          agent: leader,
          latestUserMessage: input.latestUserMessage,
          turnIndex: input.turnIndex,
          instructions: `Synthesize the team discussion for the human operator.\n\nTeam messages:\n${workerResults
            .map((worker) => `${worker.actorName}: ${worker.assistantText}`)
            .join("\n\n")}`,
          teamContext: {
            teamName: input.teamPlan.teamName,
            leaderName,
          },
          getTranscript: input.getTranscript,
          onAgentEvent: input.onAgentEvent,
          onRuntimeEvent: input.onRuntimeEvent,
        })
      : null;

    return {
      leader: leaderResult,
      workers: workerResults,
      synthesis,
    } satisfies InvokeTeamPlanResult;
  }

  async cancel(sessionId: string) {
    const state = this.getSessionState(sessionId);
    state.agents.clear();
    this.emit(sessionId, {
      type: "runtime.session.cancelled",
      sessionId,
      occurredAt: nowIso(),
      payload: {},
    });
    this.close(sessionId);
  }

  async collectArtifacts(sessionId: string) {
    void sessionId;
    return [];
  }
}

export const piRuntimeAdapter = new PiRuntimeAdapter();

export async function discoverConfiguredRuntimes(args: {
  bindings: ProviderRuntimeBinding[];
  providers: ProviderProfile[];
  agents: Array<{ name: string }>;
}) {
  const candidates = args.bindings.map((binding) => {
    const provider =
      args.providers.find((item) => item.id === binding.defaultProviderProfileId) ?? null;
    return piRuntimeAdapter.healthCheck({
      binding,
      provider,
      agentCatalog: args.agents,
    });
  });

  return Promise.all(candidates);
}
