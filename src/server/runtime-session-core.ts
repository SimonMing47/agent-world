import { randomUUID } from "node:crypto";
import { type AgentEvent, type AgentMessage } from "@earendil-works/pi-agent-core";
import {
  type AssistantMessage,
  type TextContent,
  type ToolResultMessage,
} from "@earendil-works/pi-ai";
import {
  execute,
  queryAll,
  queryOne,
  type AgentDefinition as AgentCatalogDefinition,
  type AgentTeam,
  type BusinessTeam,
  type ProviderProfile,
  type ProviderRuntimeBinding,
  type RuntimeSession,
  type RuntimeSessionEvent,
  type RuntimeSessionMessage,
  type TenantSpace,
} from "@/server/db";
import {
  buildRuntimeDescriptor,
} from "@/server/runtime-provider-config";
import {
  piRuntimeAdapter,
  type RuntimeAgentProfile,
  type RuntimeSessionEnvelope,
} from "@/server/runtime-adapter-core";

type StreamEnvelope =
  | { type: "session_status"; payload: Record<string, unknown> }
  | { type: "message"; payload: Record<string, unknown> }
  | { type: "event"; payload: Record<string, unknown> };

type SessionWriter = (event: StreamEnvelope) => void;

type ActiveRuntimeHandle = {
  sessionId: string;
  mode: "single_agent" | "agent_team";
  isRunning: boolean;
};

type CreateRuntimeSessionInput = {
  tenantSpaceId: string;
  businessTeamId: string;
  agentTeamId?: string | null;
  agentDefinitionId?: string | null;
  runtimeBindingId: string;
  providerProfileId: string;
  mode: "single_agent" | "agent_team";
  title: string;
  systemPrompt: string;
  model: string;
  createdBy: string;
};

type RuntimeTeamMemberRow = {
  id: string;
  teamId: string;
  agentDefinitionId: string;
  memberRole: string;
  workInstruction: string;
  position: number;
  status: string;
  createdAt: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  model: string;
  toolBindingsJson: string;
  memoryScope: string;
  harnessConfigJson: string;
  permissionPolicyJson: string;
};

const sessionSubscribers = new Map<string, Set<SessionWriter>>();
const activeRuntimeHandles = new Map<string, ActiveRuntimeHandle>();

function nowIso() {
  return new Date().toISOString();
}

function parseContentJson<T>(value: string, fallback: T) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function emitSession(sessionId: string, event: StreamEnvelope) {
  const subscribers = sessionSubscribers.get(sessionId);
  if (!subscribers) return;
  for (const subscriber of subscribers) subscriber(event);
}

function updateRuntimeSessionStatus(sessionId: string, status: string, lastError?: string | null) {
  execute(
    "UPDATE runtime_sessions SET status = ?, last_error = ?, updated_at = ? WHERE id = ?",
    status,
    lastError ?? null,
    nowIso(),
    sessionId,
  );
  emitSession(sessionId, {
    type: "session_status",
    payload: {
      sessionId,
      status,
      lastError: lastError ?? null,
      updatedAt: nowIso(),
    },
  });
}

function getNextTurnIndex(sessionId: string) {
  const row = queryOne<{ maxTurn: number | null }>(
    "SELECT MAX(turn_index) AS max_turn FROM runtime_session_messages WHERE session_id = ?",
    sessionId,
  );
  return Number(row?.maxTurn ?? 0) + 1;
}

function buildTextBlocks(text: string): TextContent[] {
  return [{ type: "text", text }];
}

function flattenTextFromBlocks(blocks: Array<{ type: string; text?: string; thinking?: string }>) {
  return blocks
    .map((block) => {
      if (block.type === "text") return block.text ?? "";
      if (block.type === "thinking") return block.thinking ?? "";
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function flattenVisibleText(blocks: Array<{ type: string; text?: string }>) {
  return blocks
    .map((block) => (block.type === "text" ? block.text ?? "" : ""))
    .filter(Boolean)
    .join("\n");
}

function toRuntimeAgentProfileFromTeamMember(member: RuntimeTeamMemberRow): RuntimeAgentProfile {
  return {
    id: member.id,
    name: member.name,
    role: member.memberRole || member.role,
    personaPrompt: member.workInstruction || member.systemPrompt || member.description,
    harnessConfigJson: member.harnessConfigJson,
    permissionPolicyJson: member.permissionPolicyJson,
  };
}

function listRuntimeTeamMembers(teamId: string) {
  return queryAll<RuntimeTeamMemberRow>(
    `
      SELECT
        agent_team_members.id,
        agent_team_members.team_id,
        agent_team_members.agent_definition_id,
        agent_team_members.member_role,
        agent_team_members.work_instruction,
        agent_team_members.position,
        agent_team_members.status,
        agent_team_members.created_at,
        agent_definitions.name,
        agent_definitions.role,
        agent_definitions.description,
        agent_definitions.system_prompt,
        agent_definitions.model,
        agent_definitions.tool_bindings_json,
        agent_definitions.memory_scope,
        agent_definitions.harness_config_json,
        agent_definitions.permission_policy_json
      FROM agent_team_members
      JOIN agent_definitions ON agent_definitions.id = agent_team_members.agent_definition_id
      WHERE agent_team_members.team_id = ?
      ORDER BY agent_team_members.position ASC, agent_team_members.created_at ASC
    `,
    teamId,
  );
}

function toRuntimeAgentProfileFromDefinition(
  definition: AgentCatalogDefinition,
): RuntimeAgentProfile {
  return {
    id: definition.id,
    name: definition.name,
    role: definition.role,
    personaPrompt: definition.description || "Agent definition",
    harnessConfigJson: definition.harnessConfigJson,
    permissionPolicyJson: definition.permissionPolicyJson,
  };
}

function insertRuntimeSessionMessage(args: {
  sessionId: string;
  actorType: string;
  actorId?: string | null;
  actorName: string;
  role: string;
  content: Record<string, unknown>;
  visibility?: string;
  turnIndex: number;
  createdAt?: string;
}) {
  const id = randomUUID();
  const createdAt = args.createdAt ?? nowIso();
  execute(
    "INSERT INTO runtime_session_messages (id, session_id, actor_type, actor_id, actor_name, role, content_json, visibility, turn_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    args.sessionId,
    args.actorType,
    args.actorId ?? null,
    args.actorName,
    args.role,
    JSON.stringify(args.content),
    args.visibility ?? "public",
    args.turnIndex,
    createdAt,
  );

  const message = queryOne<RuntimeSessionMessage>(
    "SELECT * FROM runtime_session_messages WHERE id = ?",
    id,
  );
  if (message) {
    emitSession(args.sessionId, {
      type: "message",
      payload: {
        ...message,
        content: parseContentJson(message.contentJson, {}),
      },
    });
  }

  return id;
}

function insertRuntimeSessionEvent(args: {
  sessionId: string;
  messageId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  visibility?: string;
  createdAt?: string;
}) {
  const id = randomUUID();
  const createdAt = args.createdAt ?? nowIso();
  execute(
    "INSERT INTO runtime_session_events (id, session_id, message_id, actor_id, actor_name, event_type, payload_json, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    args.sessionId,
    args.messageId ?? null,
    args.actorId ?? null,
    args.actorName ?? null,
    args.eventType,
    JSON.stringify(args.payload),
    args.visibility ?? "public",
    createdAt,
  );
  const event = queryOne<RuntimeSessionEvent>(
    "SELECT * FROM runtime_session_events WHERE id = ?",
    id,
  );
  if (event) {
    emitSession(args.sessionId, {
      type: "event",
      payload: {
        ...event,
        payload: parseContentJson(event.payloadJson, {}),
      },
    });
  }
  return id;
}

function getRuntimeSession(sessionId: string) {
  return queryOne<RuntimeSession>("SELECT * FROM runtime_sessions WHERE id = ?", sessionId);
}

function listRuntimeSessionMessages(sessionId: string) {
  return queryAll<RuntimeSessionMessage>(
    "SELECT * FROM runtime_session_messages WHERE session_id = ? ORDER BY turn_index ASC, created_at ASC",
    sessionId,
  );
}

function listRuntimeSessionEvents(sessionId: string) {
  return queryAll<RuntimeSessionEvent>(
    "SELECT * FROM runtime_session_events WHERE session_id = ? ORDER BY created_at ASC",
    sessionId,
  );
}

function listTranscriptMessages(sessionId: string) {
  return listRuntimeSessionMessages(sessionId)
    .map(toPiMessage)
    .filter((message): message is AgentMessage => message !== null);
}

function persistRuntimeEnvelope(event: RuntimeSessionEnvelope) {
  if (event.type !== "runtime.permission.ask") return;
  insertRuntimeSessionEvent({
    sessionId: event.sessionId,
    actorId:
      typeof event.payload.actorId === "string" ? event.payload.actorId : null,
    actorName: String(event.payload.actorName ?? "Runtime Assistant"),
    eventType: "human_approval_required",
    payload: {
      toolName: event.payload.toolName,
      args: event.payload.args,
      approvalMode: event.payload.approvalMode,
    },
  });
}

function toPiMessage(message: RuntimeSessionMessage): AgentMessage | null {
  const content = parseContentJson<Record<string, unknown>>(message.contentJson, {});
  const timestamp = Date.parse(message.createdAt) || Date.now();

  if (message.role === "user") {
    return {
      role: "user",
      content: String(content.text ?? ""),
      timestamp,
    };
  }

  if (message.role === "assistant") {
    return {
      role: "assistant",
      content: Array.isArray(content.content) ? (content.content as AssistantMessage["content"]) : buildTextBlocks(String(content.text ?? "")),
      api: String(content.api ?? "openai-completions"),
      provider: String(content.provider ?? "openai"),
      model: String(content.model ?? ""),
      responseModel: typeof content.responseModel === "string" ? content.responseModel : undefined,
      usage:
        (content.usage as AssistantMessage["usage"]) ?? {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      stopReason: (content.stopReason as AssistantMessage["stopReason"]) ?? "stop",
      errorMessage: typeof content.errorMessage === "string" ? content.errorMessage : undefined,
      timestamp,
    };
  }

  if (message.role === "toolResult") {
    return {
      role: "toolResult",
      toolCallId: String(content.toolCallId ?? ""),
      toolName: String(content.toolName ?? message.actorName),
      content: Array.isArray(content.content) ? (content.content as ToolResultMessage["content"]) : buildTextBlocks(String(content.text ?? "")),
      details: content.details,
      isError: Boolean(content.isError),
      timestamp,
    };
  }

  return null;
}

async function invokeRuntimeAgentNode(args: {
  session: RuntimeSession;
  runtimeBinding: ProviderRuntimeBinding;
  providerProfile: ProviderProfile;
  agent: RuntimeAgentProfile | null;
  turnIndex: number;
  teamContext?: {
    teamName: string;
    leaderName?: string;
  } | null;
  instructions?: string;
  latestUserMessage: string;
}) {
  return piRuntimeAdapter.invokeAgentNode({
    session: {
      sessionId: args.session.id,
      mode: args.session.mode as "single_agent" | "agent_team",
      title: args.session.title,
      systemPrompt: args.session.systemPrompt,
      model: args.session.model,
      runtimeBinding: args.runtimeBinding,
      providerProfile: args.providerProfile,
    },
    agent: args.agent,
    latestUserMessage: args.latestUserMessage,
    turnIndex: args.turnIndex,
    instructions: args.instructions,
    teamContext: args.teamContext ?? null,
    getTranscript: () => listTranscriptMessages(args.session.id),
    onAgentEvent: (event) => {
      persistAgentEvent({
        sessionId: args.session.id,
        agentId: event.actorId ?? null,
        actorName: event.actorName,
        turnIndex: event.turnIndex,
        event: event.event,
      });
    },
    onRuntimeEvent: (event) => {
      persistRuntimeEnvelope(event);
    },
  });
}

function persistAgentEvent(args: {
  sessionId: string;
  agentId?: string | null;
  actorName: string;
  turnIndex: number;
  event: AgentEvent;
}) {
  const createdAt = nowIso();

  switch (args.event.type) {
    case "agent_start":
      insertRuntimeSessionEvent({
        sessionId: args.sessionId,
        actorId: args.agentId,
        actorName: args.actorName,
        eventType: "session_started",
        payload: { actorName: args.actorName },
        createdAt,
      });
      return;
    case "message_update": {
      const assistantEvent = args.event.assistantMessageEvent;
      if (assistantEvent.type === "thinking_delta" || assistantEvent.type === "thinking_start" || assistantEvent.type === "thinking_end") {
        insertRuntimeSessionEvent({
          sessionId: args.sessionId,
          actorId: args.agentId,
          actorName: args.actorName,
          eventType: assistantEvent.type,
          payload: {
            contentIndex: assistantEvent.contentIndex,
            delta: "delta" in assistantEvent ? assistantEvent.delta : undefined,
            content: "content" in assistantEvent ? assistantEvent.content : undefined,
          },
          createdAt,
        });
        return;
      }
      if (assistantEvent.type === "toolcall_start" || assistantEvent.type === "toolcall_delta" || assistantEvent.type === "toolcall_end") {
        const contentBlock = assistantEvent.partial.content[assistantEvent.contentIndex];
        insertRuntimeSessionEvent({
          sessionId: args.sessionId,
          actorId: args.agentId,
          actorName: args.actorName,
          eventType:
            assistantEvent.type === "toolcall_start"
              ? "tool_call_requested"
              : assistantEvent.type === "toolcall_end"
                ? "tool_call_finished"
                : "tool_call_delta",
          payload: {
            contentIndex: assistantEvent.contentIndex,
            toolName: contentBlock?.type === "toolCall" ? contentBlock.name : undefined,
            delta: "delta" in assistantEvent ? assistantEvent.delta : undefined,
          },
          createdAt,
        });
      }
      if (assistantEvent.type === "text_delta") {
        insertRuntimeSessionEvent({
          sessionId: args.sessionId,
          actorId: args.agentId,
          actorName: args.actorName,
          eventType: "agent_message_delta",
          payload: {
            delta: assistantEvent.delta,
            contentIndex: assistantEvent.contentIndex,
          },
          createdAt,
        });
      }
      return;
    }
    case "message_end": {
      if (args.event.message.role !== "assistant") {
        return;
      }
      const message = args.event.message as AssistantMessage;
      const blocks = Array.isArray(message.content) ? message.content : buildTextBlocks("");
      insertRuntimeSessionMessage({
        sessionId: args.sessionId,
        actorType: "agent",
        actorId: args.agentId,
        actorName: args.actorName,
        role: "assistant",
        content: {
          content: blocks,
          text: flattenVisibleText(blocks),
          thinkingText: flattenTextFromBlocks(
            blocks
              .filter((block) => block.type === "thinking")
              .map((block) => ({
                type: block.type,
                thinking: "thinking" in block ? block.thinking : "",
              })),
          ),
          api: message.api,
          provider: message.provider,
          model: message.model,
          responseModel: message.responseModel,
          usage: message.usage,
          stopReason: message.stopReason,
          errorMessage: message.errorMessage,
        },
        turnIndex: args.turnIndex,
        createdAt,
      });
      return;
    }
    case "tool_execution_start":
      insertRuntimeSessionEvent({
        sessionId: args.sessionId,
        actorId: args.agentId,
        actorName: args.actorName,
        eventType: "tool_call_started",
        payload: {
          toolCallId: args.event.toolCallId,
          toolName: args.event.toolName,
          args: args.event.args,
        },
        createdAt,
      });
      return;
    case "tool_execution_update":
      insertRuntimeSessionEvent({
        sessionId: args.sessionId,
        actorId: args.agentId,
        actorName: args.actorName,
        eventType: "tool_call_update",
        payload: {
          toolCallId: args.event.toolCallId,
          toolName: args.event.toolName,
          partialResult: args.event.partialResult,
        },
        createdAt,
      });
      return;
    case "tool_execution_end":
      insertRuntimeSessionEvent({
        sessionId: args.sessionId,
        actorId: args.agentId,
        actorName: args.actorName,
        eventType: "tool_call_finished",
        payload: {
          toolCallId: args.event.toolCallId,
          toolName: args.event.toolName,
          result: args.event.result,
          isError: args.event.isError,
        },
        createdAt,
      });
      return;
    case "turn_end":
      for (const toolResult of args.event.toolResults) {
        insertRuntimeSessionMessage({
          sessionId: args.sessionId,
          actorType: "tool",
          actorId: args.agentId,
          actorName: toolResult.toolName,
          role: "toolResult",
          content: {
            toolCallId: toolResult.toolCallId,
            toolName: toolResult.toolName,
            content: toolResult.content,
            text: flattenTextFromBlocks(toolResult.content),
            details: toolResult.details,
            isError: toolResult.isError,
          },
          turnIndex: args.turnIndex,
          createdAt,
        });
      }
      return;
    case "agent_end":
      insertRuntimeSessionEvent({
        sessionId: args.sessionId,
        actorId: args.agentId,
        actorName: args.actorName,
        eventType: "session_completed",
        payload: {
          actorName: args.actorName,
          messageCount: args.event.messages.length,
        },
        createdAt,
      });
      return;
    default:
      return;
  }
}

async function runSingleAgentSession(args: {
  session: RuntimeSession;
  runtimeBinding: ProviderRuntimeBinding;
  providerProfile: ProviderProfile;
  agentDefinition: AgentCatalogDefinition | null;
  latestUserMessage: string;
  turnIndex: number;
}) {
  const runtimeAgent = args.agentDefinition
    ? toRuntimeAgentProfileFromDefinition(args.agentDefinition)
    : null;
  await invokeRuntimeAgentNode({
    session: args.session,
    runtimeBinding: args.runtimeBinding,
    providerProfile: args.providerProfile,
    agent: runtimeAgent,
    turnIndex: args.turnIndex,
    latestUserMessage: args.latestUserMessage,
  });
}

async function runTeamSession(args: {
  session: RuntimeSession;
  runtimeBinding: ProviderRuntimeBinding;
  providerProfile: ProviderProfile;
  team: AgentTeam;
  agents: RuntimeTeamMemberRow[];
  latestUserMessage: string;
  turnIndex: number;
}) {
  const runtimeAgents = args.agents.map(toRuntimeAgentProfileFromTeamMember);
  await piRuntimeAdapter.invokeTeamPlan({
    session: {
      sessionId: args.session.id,
      mode: args.session.mode as "single_agent" | "agent_team",
      title: args.session.title,
      systemPrompt: args.session.systemPrompt,
      model: args.session.model,
      runtimeBinding: args.runtimeBinding,
      providerProfile: args.providerProfile,
    },
    teamPlan: {
      teamId: args.team.id,
      teamName: args.team.name,
      leaderAgentId: args.team.leaderAgentId,
      actors: runtimeAgents,
    },
    latestUserMessage: args.latestUserMessage,
    turnIndex: args.turnIndex,
    getTranscript: () => listTranscriptMessages(args.session.id),
    onAgentEvent: (event) => {
      persistAgentEvent({
        sessionId: args.session.id,
        agentId: event.actorId ?? null,
        actorName: event.actorName,
        turnIndex: event.turnIndex,
        event: event.event,
      });
    },
    onRuntimeEvent: (event) => {
      persistRuntimeEnvelope(event);
    },
  });
}

async function runRuntimeSessionPrompt(args: {
  session: RuntimeSession;
  runtimeBinding: ProviderRuntimeBinding;
  providerProfile: ProviderProfile;
  latestUserMessage: string;
  turnIndex: number;
}) {
  const handle = activeRuntimeHandles.get(args.session.id) ?? {
    sessionId: args.session.id,
    mode: args.session.mode as "single_agent" | "agent_team",
    isRunning: true,
  };
  handle.isRunning = true;
  activeRuntimeHandles.set(args.session.id, handle);
  updateRuntimeSessionStatus(args.session.id, "running", null);

  try {
    await piRuntimeAdapter.startSession({
      sessionId: args.session.id,
      mode: args.session.mode as "single_agent" | "agent_team",
      title: args.session.title,
      systemPrompt: args.session.systemPrompt,
      model: args.session.model,
      runtimeBinding: args.runtimeBinding,
      providerProfile: args.providerProfile,
    });
    if (args.session.mode === "agent_team" && args.session.agentTeamId) {
      const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", args.session.agentTeamId);
      const agents = listRuntimeTeamMembers(args.session.agentTeamId);
      if (!team || agents.length === 0) {
        throw new Error("Agent Team 未配置完整，无法运行团队会话。");
      }
      await runTeamSession({
        session: args.session,
        runtimeBinding: args.runtimeBinding,
        providerProfile: args.providerProfile,
        team,
        agents,
        latestUserMessage: args.latestUserMessage,
        turnIndex: args.turnIndex,
      });
    } else {
      const agentDefinition = args.session.agentDefinitionId
        ? queryOne<AgentCatalogDefinition>(
            "SELECT * FROM agent_definitions WHERE id = ?",
            args.session.agentDefinitionId,
          )
        : null;
      await runSingleAgentSession({
        ...args,
        agentDefinition,
      });
    }
    updateRuntimeSessionStatus(args.session.id, "idle", null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Runtime session failed";
    insertRuntimeSessionEvent({
      sessionId: args.session.id,
      eventType: "session_failed",
      payload: { error: message },
    });
    updateRuntimeSessionStatus(args.session.id, "error", message);
  } finally {
    const currentHandle = activeRuntimeHandles.get(args.session.id);
    if (currentHandle) {
      currentHandle.isRunning = false;
    }
  }
}

export function subscribeRuntimeSession(sessionId: string, writer: SessionWriter) {
  const current = sessionSubscribers.get(sessionId) ?? new Set<SessionWriter>();
  current.add(writer);
  sessionSubscribers.set(sessionId, current);
  return () => {
    const next = sessionSubscribers.get(sessionId);
    if (!next) return;
    next.delete(writer);
    if (next.size === 0) sessionSubscribers.delete(sessionId);
  };
}

export function listRuntimeSessions() {
  return queryAll<RuntimeSession>(
    "SELECT * FROM runtime_sessions ORDER BY updated_at DESC, created_at DESC",
  );
}

export function createRuntimeSession(input: CreateRuntimeSessionInput) {
  const tenantSpace = queryOne<TenantSpace>(
    "SELECT * FROM tenant_spaces WHERE id = ?",
    input.tenantSpaceId,
  );
  if (!tenantSpace) {
    throw new Error("租户空间不存在，无法创建运行时会话。");
  }

  const businessTeam = queryOne<BusinessTeam>(
    "SELECT * FROM business_teams WHERE id = ?",
    input.businessTeamId,
  );
  if (!businessTeam) {
    throw new Error("业务团队不存在，无法创建运行时会话。");
  }

  const runtimeBinding = queryOne<ProviderRuntimeBinding>(
    "SELECT * FROM provider_runtime_bindings WHERE id = ?",
    input.runtimeBindingId,
  );
  if (!runtimeBinding || runtimeBinding.isEnabled !== 1) {
    throw new Error("运行时绑定不存在或未启用。");
  }

  const providerProfile = queryOne<ProviderProfile>(
    "SELECT * FROM provider_profiles WHERE id = ?",
    input.providerProfileId,
  );
  if (!providerProfile || providerProfile.isEnabled !== 1) {
    throw new Error("模型接口不存在或未启用。");
  }

  if (input.mode === "agent_team") {
    if (!input.agentTeamId) {
      throw new Error("Team 会话必须选择 Agent Team。");
    }
    const agentTeam = queryOne<AgentTeam>(
      "SELECT * FROM agent_teams WHERE id = ?",
      input.agentTeamId,
    );
    if (!agentTeam) {
      throw new Error("Agent Team 不存在，无法创建团队会话。");
    }
  }

  if (input.mode === "single_agent" && input.agentDefinitionId) {
    const definition = queryOne<AgentCatalogDefinition>(
      "SELECT * FROM agent_definitions WHERE id = ?",
      input.agentDefinitionId,
    );
    if (!definition) {
      throw new Error("Agent 定义不存在，无法创建单 Agent 会话。");
    }
  }

  const id = randomUUID();
  const createdAt = nowIso();
  execute(
    "INSERT INTO runtime_sessions (id, tenant_space_id, business_team_id, agent_team_id, agent_definition_id, runtime_binding_id, provider_profile_id, mode, title, system_prompt, model, status, last_error, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.tenantSpaceId,
    input.businessTeamId,
    input.agentTeamId ?? null,
    input.agentDefinitionId ?? null,
    input.runtimeBindingId,
    input.providerProfileId,
    input.mode,
    input.title,
    input.systemPrompt,
    input.model,
    "idle",
    null,
    input.createdBy,
    createdAt,
    createdAt,
  );
  return getRuntimeSessionDetail(id);
}

export function getRuntimeSessionDetail(sessionId: string) {
  const session = getRuntimeSession(sessionId);
  if (!session) return null;

  const runtimeBinding = queryOne<ProviderRuntimeBinding>(
    "SELECT * FROM provider_runtime_bindings WHERE id = ?",
    session.runtimeBindingId,
  );
  const providerProfile = queryOne<ProviderProfile>(
    "SELECT * FROM provider_profiles WHERE id = ?",
    session.providerProfileId,
  );
  const businessTeam = queryOne<BusinessTeam>(
    "SELECT * FROM business_teams WHERE id = ?",
    session.businessTeamId,
  );
  const tenantSpace = queryOne<TenantSpace>(
    "SELECT * FROM tenant_spaces WHERE id = ?",
    session.tenantSpaceId,
  );
  const agentTeam = session.agentTeamId
    ? queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", session.agentTeamId)
    : null;
  const agentDefinition = session.agentDefinitionId
    ? queryOne<AgentCatalogDefinition>(
        "SELECT * FROM agent_definitions WHERE id = ?",
        session.agentDefinitionId,
      )
    : null;
  const agents = agentTeam
    ? listRuntimeTeamMembers(agentTeam.id).map((member) => ({
        id: member.id,
        name: member.name,
        role: member.memberRole || member.role,
      }))
    : [];
  const messages = listRuntimeSessionMessages(sessionId).map((message) => ({
    ...message,
    content: parseContentJson(message.contentJson, {}),
  }));
  const events = listRuntimeSessionEvents(sessionId).map((event) => ({
    ...event,
    payload: parseContentJson(event.payloadJson, {}),
  }));

  return {
    session,
    runtimeBinding,
    providerProfile,
    businessTeam,
    tenantSpace,
    agentTeam,
    agentDefinition,
    agents,
    messages,
    events,
    runtimeDescriptor:
      runtimeBinding && providerProfile
        ? buildRuntimeDescriptor(runtimeBinding, providerProfile)
        : null,
    isActive: activeRuntimeHandles.get(sessionId)?.isRunning ?? false,
  };
}

export async function submitRuntimeSessionMessage(args: {
  sessionId: string;
  content: string;
  actorName?: string;
}) {
  const session = getRuntimeSession(args.sessionId);
  if (!session) throw new Error("会话不存在。");

  const runtimeBinding = queryOne<ProviderRuntimeBinding>(
    "SELECT * FROM provider_runtime_bindings WHERE id = ?",
    session.runtimeBindingId,
  );
  const providerProfile = queryOne<ProviderProfile>(
    "SELECT * FROM provider_profiles WHERE id = ?",
    session.providerProfileId,
  );

  if (!runtimeBinding || !providerProfile) {
    throw new Error("运行时或模型接口配置不完整。");
  }

  const turnIndex = getNextTurnIndex(session.id);
  insertRuntimeSessionMessage({
    sessionId: session.id,
    actorType: "human",
    actorName: args.actorName ?? "Operator",
    role: "user",
    content: { text: args.content },
    turnIndex,
  });
  insertRuntimeSessionEvent({
    sessionId: session.id,
    actorName: args.actorName ?? "Operator",
    eventType: "human_message",
    payload: {
      text: args.content,
      turnIndex,
    },
  });

  const activeHandle = activeRuntimeHandles.get(session.id);
  if (activeHandle?.isRunning) {
    const accepted = await piRuntimeAdapter.resumeSession({
      sessionId: session.id,
      actorName: args.actorName ?? "Operator",
      content: args.content,
    });
    if (!accepted) {
      void runRuntimeSessionPrompt({
        session,
        runtimeBinding,
        providerProfile,
        latestUserMessage: args.content,
        turnIndex,
      });
      return { accepted: true, queued: false };
    }
    insertRuntimeSessionEvent({
      sessionId: session.id,
      actorName: args.actorName ?? "Operator",
      eventType: "human_steer",
      payload: {
        text: args.content,
        turnIndex,
      },
    });
    return { accepted: true, queued: true };
  }

  void runRuntimeSessionPrompt({
    session,
    runtimeBinding,
    providerProfile,
    latestUserMessage: args.content,
    turnIndex,
  });

  return { accepted: true, queued: false };
}
