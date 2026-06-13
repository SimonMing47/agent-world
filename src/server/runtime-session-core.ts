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
  type RuntimeSubConversationContext,
} from "@/server/runtime-adapter-core";
import { uiText } from "@/lib/language-pack";

type StreamEnvelope =
  | { type: "session_status"; payload: Record<string, unknown> }
  | { type: "message"; payload: Record<string, unknown> }
  | { type: "event"; payload: Record<string, unknown> };

type SessionWriter = (event: StreamEnvelope) => void;

export type RuntimeMessageDeliveryMode = "queue" | "append" | "interject" | "interrupt";

type PendingRuntimeMessage = {
  id: string;
  content: string;
  displayContent?: string;
  actorId?: string | null;
  actorName: string;
  deliveryMode: RuntimeMessageDeliveryMode;
  queuedAt: string;
  appendedQueueIds?: string[];
};

type ActiveRuntimeHandle = {
  sessionId: string;
  mode: "single_agent" | "agent_team";
  isRunning: boolean;
  currentRunId?: string;
  pendingMessages: PendingRuntimeMessage[];
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
  avatarConfigJson: string;
  capabilityProfileJson: string;
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

function normalizeDeliveryMode(value: unknown): RuntimeMessageDeliveryMode {
  if (value === "append" || value === "interject" || value === "interrupt") {
    return value;
  }
  return "queue";
}

function formatTeamInstruction(
  deliveryMode: RuntimeMessageDeliveryMode,
  content: string,
) {
  if (deliveryMode === "append") return `${uiText("ui.runtimeConsole.queue.appendMarker")}\n${content}`;
  if (deliveryMode === "interject") return `${uiText("ui.runtimeConsole.queue.interjectMarker")}\n${content}`;
  return content;
}

function formatRuntimeHumanMessage(actorName: string, content: string) {
  return [`Question from @${actorName}:`, content].join("\n");
}

function mergeAppendedInstruction(existing: string, addition: string) {
  return `${existing.trim()}\n\n${uiText("ui.runtimeConsole.queue.appendMarker")}\n${addition.trim()}`.trim();
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

function queueRuntimeMessage(args: {
  handle: ActiveRuntimeHandle;
  content: string;
  displayContent?: string;
  actorId?: string | null;
  actorName: string;
  deliveryMode: RuntimeMessageDeliveryMode;
  position?: "front" | "back";
}) {
  const pendingMessage: PendingRuntimeMessage = {
    id: randomUUID(),
    content: args.content,
    displayContent: args.displayContent,
    actorId: args.actorId ?? null,
    actorName: args.actorName,
    deliveryMode: args.deliveryMode,
    queuedAt: nowIso(),
  };

  if (args.position === "front") {
    args.handle.pendingMessages.unshift(pendingMessage);
  } else {
    args.handle.pendingMessages.push(pendingMessage);
  }

  return pendingMessage;
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

function mentionHandleFrom(value: string, fallback: string) {
  const slug =
    value
      .toLowerCase()
      .replace(/[/|]+/g, " ")
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || fallback;
  return `@${slug}`;
}

function toRuntimeAgentProfileFromTeamMember(member: RuntimeTeamMemberRow): RuntimeAgentProfile {
  const memberRole = member.memberRole || member.role;
  return {
    id: member.id,
    name: memberRole || member.name,
    role: memberRole,
    personaPrompt: member.workInstruction || member.systemPrompt || member.description,
    mentionHandle: mentionHandleFrom(memberRole || member.name, member.id.slice(0, 8)),
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
        agent_definitions.avatar_config_json,
        agent_definitions.capability_profile_json,
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

function resolveRuntimeTeamLeader(session: RuntimeSession) {
  if (!session.agentTeamId) return null;
  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", session.agentTeamId);
  const agents = listRuntimeTeamMembers(session.agentTeamId);
  if (agents.length === 0) return null;

  const leader = team?.leaderAgentId
    ? agents.find(
        (agent) =>
          agent.id === team.leaderAgentId ||
          agent.agentDefinitionId === team.leaderAgentId,
      ) ?? agents[0]
    : agents[0];

  return {
    actorId: leader.id,
    actorName: leader.memberRole || leader.name,
  };
}

async function steerActiveTeamLeader(args: {
  session: RuntimeSession;
  actorName: string;
  content: string;
}) {
  const leader = resolveRuntimeTeamLeader(args.session);
  if (!leader) return false;
  return piRuntimeAdapter.resumeSession({
    sessionId: args.session.id,
    actorName: args.actorName,
    content: args.content,
    targetActorId: leader.actorId,
    targetActorName: leader.actorName,
  });
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
  if (event.type === "runtime.permission.ask") {
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
    return;
  }

  if (event.type === "runtime.context.compacted") {
    insertRuntimeSessionEvent({
      sessionId: event.sessionId,
      actorId:
        typeof event.payload.actorId === "string" ? event.payload.actorId : null,
      actorName: String(event.payload.actorName ?? "Runtime Assistant"),
      eventType: "context_compacted",
      payload: {
        reason: event.payload.reason,
        source: event.payload.source,
        contextWindow: event.payload.contextWindow,
        maxTokens: event.payload.maxTokens,
        triggerTokens: event.payload.triggerTokens,
        targetTokens: event.payload.targetTokens,
        originalTokenEstimate: event.payload.originalTokenEstimate,
        compactedTokenEstimate: event.payload.compactedTokenEstimate,
        summarizedMessages: event.payload.summarizedMessages,
        retainedMessages: event.payload.retainedMessages,
        summaryPreview: event.payload.summaryPreview,
      },
    });
  }
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
        subConversation: event.subConversation ?? null,
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
  subConversation?: RuntimeSubConversationContext | null;
  event: AgentEvent;
}) {
  const createdAt = nowIso();
  const subConversationPayload = args.subConversation
    ? {
        subConversation: args.subConversation,
        subConversationId: args.subConversation.id,
        subConversationParentId: args.subConversation.parentId,
        subConversationKind: args.subConversation.kind,
        subConversationTitle: args.subConversation.title,
        subConversationSourceActorName: args.subConversation.sourceActorName,
        subConversationTargetActorName: args.subConversation.targetActorName,
        subConversationContext: args.subConversation.contextText,
      }
    : {};

  switch (args.event.type) {
    case "agent_start":
      insertRuntimeSessionEvent({
        sessionId: args.sessionId,
        actorId: args.agentId,
        actorName: args.actorName,
        eventType: "agent_started",
        payload: { actorName: args.actorName, ...subConversationPayload },
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
            ...subConversationPayload,
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
            ...subConversationPayload,
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
            ...subConversationPayload,
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
          ...subConversationPayload,
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
          ...subConversationPayload,
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
          ...subConversationPayload,
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
          ...subConversationPayload,
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
            ...subConversationPayload,
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
        eventType: "agent_completed",
        payload: {
          actorName: args.actorName,
          messageCount: args.event.messages.length,
          ...subConversationPayload,
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
        subConversation: event.subConversation ?? null,
        event: event.event,
      });
    },
    onRuntimeEvent: (event) => {
      persistRuntimeEnvelope(event);
    },
  });
}

type RunRuntimeSessionPromptArgs = {
  session: RuntimeSession;
  runtimeBinding: ProviderRuntimeBinding;
  providerProfile: ProviderProfile;
  latestUserMessage: string;
  turnIndex: number;
};

function handleRuntimePromptFailure(args: RunRuntimeSessionPromptArgs, error: unknown) {
  const message = error instanceof Error ? error.message : "Runtime session failed";
  insertRuntimeSessionEvent({
    sessionId: args.session.id,
    eventType: "session_failed",
    payload: { error: message },
  });
  updateRuntimeSessionStatus(args.session.id, "error", message);
  activeRuntimeHandles.delete(args.session.id);
}

function scheduleRuntimeSessionPrompt(args: RunRuntimeSessionPromptArgs) {
  void runRuntimeSessionPrompt(args).catch((error) => {
    handleRuntimePromptFailure(args, error);
  });
}

async function runRuntimeSessionPrompt(args: RunRuntimeSessionPromptArgs) {
  const runId = randomUUID();
  const handle = activeRuntimeHandles.get(args.session.id) ?? {
    sessionId: args.session.id,
    mode: args.session.mode as "single_agent" | "agent_team",
    isRunning: true,
    pendingMessages: [],
  };
  handle.pendingMessages ??= [];
  handle.isRunning = true;
  handle.currentRunId = runId;
  activeRuntimeHandles.set(args.session.id, handle);
  updateRuntimeSessionStatus(args.session.id, "running", null);
  let completedSuccessfully = false;

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
        throw new Error(uiText("ui.generated.cb8aa0e03c2"));
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
    completedSuccessfully = true;
  } catch (error) {
    const currentHandle = activeRuntimeHandles.get(args.session.id);
    if (!currentHandle || currentHandle.currentRunId !== runId) {
      return;
    }
    const message = error instanceof Error ? error.message : "Runtime session failed";
    insertRuntimeSessionEvent({
      sessionId: args.session.id,
      eventType: "session_failed",
      payload: { error: message },
    });
    updateRuntimeSessionStatus(args.session.id, "error", message);
  } finally {
    const currentHandle = activeRuntimeHandles.get(args.session.id);
    if (!currentHandle || currentHandle.currentRunId !== runId) {
      return;
    }
    const nextMessage = completedSuccessfully ? currentHandle?.pendingMessages.shift() : undefined;
    if (nextMessage) {
      const turnIndex = getNextTurnIndex(args.session.id);
      insertRuntimeSessionMessage({
        sessionId: args.session.id,
        actorType: "human",
        actorId: nextMessage.actorId ?? null,
        actorName: nextMessage.actorName,
        role: "user",
        content: {
          text: nextMessage.displayContent ?? nextMessage.content,
          deliveryMode: nextMessage.deliveryMode,
          queueId: nextMessage.id,
          queuedAt: nextMessage.queuedAt,
        },
        turnIndex,
      });
      insertRuntimeSessionEvent({
        sessionId: args.session.id,
        actorId: nextMessage.actorId ?? null,
        actorName: nextMessage.actorName,
        eventType: "human_message",
        payload: {
          text: nextMessage.displayContent ?? nextMessage.content,
          turnIndex,
          deliveryMode: nextMessage.deliveryMode,
          queued: true,
          queueId: nextMessage.id,
          queuedAt: nextMessage.queuedAt,
        },
      });
      insertRuntimeSessionEvent({
        sessionId: args.session.id,
        actorId: nextMessage.actorId ?? null,
        actorName: nextMessage.actorName,
        eventType: "leader_instruction_dequeued",
        payload: {
          text: nextMessage.displayContent ?? nextMessage.content,
          turnIndex,
          deliveryMode: nextMessage.deliveryMode,
          queueId: nextMessage.id,
          appendedQueueIds: nextMessage.appendedQueueIds ?? [],
        },
      });
      scheduleRuntimeSessionPrompt({
        session: args.session,
        runtimeBinding: args.runtimeBinding,
        providerProfile: args.providerProfile,
        latestUserMessage: nextMessage.content,
        turnIndex,
      });
      return;
    }

    activeRuntimeHandles.delete(args.session.id);
    if (completedSuccessfully) updateRuntimeSessionStatus(args.session.id, "idle", null);
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

type RuntimeSessionWorkItemRow = RuntimeSession & {
  runtimeBindingName: string | null;
  providerProfileName: string | null;
  agentTeamName: string | null;
  agentDefinitionName: string | null;
  latestEventType: string | null;
  latestEventActorName: string | null;
  latestEventAt: string | null;
  latestEventPayloadJson: string | null;
  latestMessageActorName: string | null;
  latestMessageRole: string | null;
  latestMessageAt: string | null;
  latestMessageContentJson: string | null;
};

function summarizeRuntimeContent(value: string | null | undefined) {
  if (!value) return "";
  const content = parseContentJson<Record<string, unknown>>(value, {});
  if (typeof content.text === "string" && content.text.trim()) return content.text.trim();
  if (typeof content.delta === "string" && content.delta.trim()) return content.delta.trim();
  if (typeof content.toolName === "string" && content.toolName.trim()) return content.toolName.trim();
  if (typeof content.error === "string" && content.error.trim()) return content.error.trim();
  if (typeof content.content === "string" && content.content.trim()) return content.content.trim();
  return "";
}

export function listRuntimeSessionWorkItems() {
  const rows = queryAll<RuntimeSessionWorkItemRow>(
    `SELECT
      s.*,
      rb.name AS runtime_binding_name,
      pp.name AS provider_profile_name,
      at.name AS agent_team_name,
      ad.name AS agent_definition_name,
      e.event_type AS latest_event_type,
      e.actor_name AS latest_event_actor_name,
      e.created_at AS latest_event_at,
      e.payload_json AS latest_event_payload_json,
      m.actor_name AS latest_message_actor_name,
      m.role AS latest_message_role,
      m.created_at AS latest_message_at,
      m.content_json AS latest_message_content_json
    FROM runtime_sessions s
    LEFT JOIN provider_runtime_bindings rb ON rb.id = s.runtime_binding_id
    LEFT JOIN provider_profiles pp ON pp.id = s.provider_profile_id
    LEFT JOIN agent_teams at ON at.id = s.agent_team_id
    LEFT JOIN agent_definitions ad ON ad.id = s.agent_definition_id
    LEFT JOIN runtime_session_events e ON e.id = (
      SELECT id FROM runtime_session_events
      WHERE session_id = s.id
      ORDER BY created_at DESC
      LIMIT 1
    )
    LEFT JOIN runtime_session_messages m ON m.id = (
      SELECT id FROM runtime_session_messages
      WHERE session_id = s.id
      ORDER BY created_at DESC
      LIMIT 1
    )
    ORDER BY s.updated_at DESC, s.created_at DESC`,
  );

  return rows.map((row) => {
    const latestEventAt = row.latestEventAt ?? "";
    const latestMessageAt = row.latestMessageAt ?? "";
    const preferEvent = latestEventAt >= latestMessageAt;
    const assigneeName =
      row.mode === "agent_team"
        ? row.agentTeamName ?? row.agentTeamId ?? uiText("ui.common.unbound")
        : row.agentDefinitionName ?? row.agentDefinitionId ?? uiText("ui.common.unbound");
    const latestActivityType = preferEvent
      ? row.latestEventType ?? "session"
      : row.latestMessageRole ?? "message";
    const latestActivityActor = preferEvent
      ? row.latestEventActorName ?? "System"
      : row.latestMessageActorName ?? "System";
    const latestActivityAt = (preferEvent ? row.latestEventAt : row.latestMessageAt) ?? row.updatedAt;
    const latestActivitySummary = summarizeRuntimeContent(
      preferEvent ? row.latestEventPayloadJson : row.latestMessageContentJson,
    );

    return {
      session: row,
      assigneeName,
      assigneeKind: row.mode === "agent_team" ? "agent_team" : "agent",
      runtimeName: row.runtimeBindingName ?? uiText("console.interactions.defaultRuntimeBinding"),
      providerName: row.providerProfileName ?? uiText("ui.common.unbound"),
      latestActivityType,
      latestActivityActor,
      latestActivityAt,
      latestActivitySummary,
    };
  });
}

export function createRuntimeSession(input: CreateRuntimeSessionInput) {
  const tenantSpace = queryOne<TenantSpace>(
    "SELECT * FROM tenant_spaces WHERE id = ?",
    input.tenantSpaceId,
  );
  if (!tenantSpace) {
    throw new Error(uiText("ui.generated.cd7998553e4"));
  }

  const businessTeam = queryOne<BusinessTeam>(
    "SELECT * FROM business_teams WHERE id = ?",
    input.businessTeamId,
  );
  if (!businessTeam) {
    throw new Error(uiText("ui.generated.cca0af9a93a"));
  }

  const runtimeBinding = queryOne<ProviderRuntimeBinding>(
    "SELECT * FROM provider_runtime_bindings WHERE id = ?",
    input.runtimeBindingId,
  );
  if (!runtimeBinding || runtimeBinding.isEnabled !== 1) {
    throw new Error(uiText("ui.generated.cd275384619"));
  }

  const providerProfile = queryOne<ProviderProfile>(
    "SELECT * FROM provider_profiles WHERE id = ?",
    input.providerProfileId,
  );
  if (!providerProfile || providerProfile.isEnabled !== 1) {
    throw new Error(uiText("ui.generated.c435e544d80"));
  }

  if (input.mode === "agent_team") {
    if (!input.agentTeamId) {
      throw new Error(uiText("ui.generated.c810abb8156"));
    }
    const agentTeam = queryOne<AgentTeam>(
      "SELECT * FROM agent_teams WHERE id = ?",
      input.agentTeamId,
    );
    if (!agentTeam) {
      throw new Error(uiText("ui.generated.c9863df0ccb"));
    }
  }

  if (input.mode === "single_agent" && input.agentDefinitionId) {
    const definition = queryOne<AgentCatalogDefinition>(
      "SELECT * FROM agent_definitions WHERE id = ?",
      input.agentDefinitionId,
    );
    if (!definition) {
      throw new Error(uiText("ui.generated.c9bbc51d0b1"));
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
        name: member.memberRole || member.name,
        displayName: member.name,
        role: member.memberRole || member.role,
        mentionHandle: mentionHandleFrom(member.memberRole || member.name, member.id.slice(0, 8)),
        avatarConfigJson: member.avatarConfigJson,
        capabilityProfileJson: member.capabilityProfileJson,
      }))
    : agentDefinition
      ? [
          {
            id: agentDefinition.id,
            name: agentDefinition.name,
            displayName: agentDefinition.name,
            role: agentDefinition.role,
            mentionHandle: mentionHandleFrom(agentDefinition.name, agentDefinition.id.slice(0, 8)),
            avatarConfigJson: agentDefinition.avatarConfigJson,
            capabilityProfileJson: agentDefinition.capabilityProfileJson,
          },
        ]
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

export function deleteRuntimeSession(sessionId: string) {
  const session = getRuntimeSession(sessionId);
  if (!session) {
    throw new Error(uiText("ui.generated.c1211c69ea1"));
  }
  const activeHandle = activeRuntimeHandles.get(sessionId);
  if (activeHandle?.isRunning || session.status === "running") {
    throw new Error(uiText("ui.generated.c959ab2c9b0"));
  }

  sessionSubscribers.delete(sessionId);
  activeRuntimeHandles.delete(sessionId);
  execute("DELETE FROM runtime_session_events WHERE session_id = ?", sessionId);
  execute("DELETE FROM runtime_session_messages WHERE session_id = ?", sessionId);
  execute("DELETE FROM runtime_sessions WHERE id = ?", sessionId);
  return { ok: true };
}

export async function submitRuntimeSessionMessage(args: {
  sessionId: string;
  content: string;
  actorId?: string | null;
  actorName?: string;
  deliveryMode?: RuntimeMessageDeliveryMode;
}) {
  const session = getRuntimeSession(args.sessionId);
  if (!session) throw new Error(uiText("ui.generated.c1211c69ea1"));

  const runtimeBinding = queryOne<ProviderRuntimeBinding>(
    "SELECT * FROM provider_runtime_bindings WHERE id = ?",
    session.runtimeBindingId,
  );
  const providerProfile = queryOne<ProviderProfile>(
    "SELECT * FROM provider_profiles WHERE id = ?",
    session.providerProfileId,
  );

  if (!runtimeBinding || !providerProfile) {
    throw new Error(uiText("ui.generated.c32a50af4a6"));
  }

  const actorName = args.actorName ?? "User";
  const deliveryMode = normalizeDeliveryMode(args.deliveryMode);
  const runtimeContent =
    session.mode === "agent_team" ? formatRuntimeHumanMessage(actorName, args.content) : args.content;
  const activeHandle = activeRuntimeHandles.get(session.id);
  const recordHumanMessage = (input?: {
    text?: string;
    turnIndex?: number;
    queued?: boolean;
    queueId?: string;
    queuedAt?: string;
  }) => {
    const turnIndex = input?.turnIndex ?? getNextTurnIndex(session.id);
    const text = input?.text ?? args.content;
    insertRuntimeSessionMessage({
      sessionId: session.id,
      actorType: "human",
      actorId: args.actorId ?? null,
      actorName,
      role: "user",
      content: {
        text,
        deliveryMode,
        ...(input?.queueId ? { queueId: input.queueId } : {}),
        ...(input?.queuedAt ? { queuedAt: input.queuedAt } : {}),
      },
      turnIndex,
    });
    insertRuntimeSessionEvent({
      sessionId: session.id,
      actorId: args.actorId ?? null,
      actorName,
      eventType: "human_message",
      payload: {
        text,
        turnIndex,
        deliveryMode,
        ...(input?.queued ? { queued: true } : {}),
        ...(input?.queueId ? { queueId: input.queueId } : {}),
        ...(input?.queuedAt ? { queuedAt: input.queuedAt } : {}),
      },
    });
    return turnIndex;
  };

  if (session.mode === "agent_team" && activeHandle?.isRunning) {
    activeHandle.pendingMessages ??= [];
    if (deliveryMode === "interrupt") {
      const droppedQueueDepth = activeHandle.pendingMessages.length;
      const previousRunId = activeHandle.currentRunId ?? null;
      const turnIndex = recordHumanMessage();
      activeHandle.pendingMessages = [];
      activeHandle.isRunning = false;
      activeHandle.currentRunId = randomUUID();
      await piRuntimeAdapter.cancel(session.id);
      insertRuntimeSessionEvent({
        sessionId: session.id,
        actorId: args.actorId ?? null,
        actorName,
        eventType: "leader_instruction_interrupted",
        payload: {
          text: args.content,
          turnIndex,
          deliveryMode,
          routedTo: "leader",
          previousRunId,
          droppedQueueDepth,
        },
      });
      scheduleRuntimeSessionPrompt({
        session,
        runtimeBinding,
        providerProfile,
        latestUserMessage: runtimeContent,
        turnIndex,
      });
      return {
        accepted: true,
        queued: false,
        routedTo: "leader",
        deliveryMode,
        interrupted: true,
        droppedQueueDepth,
      };
    }

    if (deliveryMode === "interject") {
      const instruction = formatTeamInstruction(deliveryMode, runtimeContent);
      const steered = await steerActiveTeamLeader({
        session,
        actorName,
        content: instruction,
      });
      if (steered) {
        const turnIndex = recordHumanMessage();
        insertRuntimeSessionEvent({
          sessionId: session.id,
          actorId: args.actorId ?? null,
          actorName,
          eventType: "leader_instruction_interjected",
          payload: {
            text: args.content,
            turnIndex,
            deliveryMode,
            routedTo: "leader",
            queued: false,
          },
        });
        return {
          accepted: true,
          queued: false,
          routedTo: "leader",
          deliveryMode,
          steered: true,
        };
      }

      const pending = queueRuntimeMessage({
        handle: activeHandle,
        content: instruction,
        displayContent: args.content,
        actorId: args.actorId ?? null,
        actorName,
        deliveryMode,
        position: "front",
      });
      insertRuntimeSessionEvent({
        sessionId: session.id,
        actorId: args.actorId ?? null,
        actorName,
        eventType: "leader_instruction_interjected",
        payload: {
          text: args.content,
          deliveryMode,
          routedTo: "leader",
          queued: true,
          queueId: pending.id,
          queuedAt: pending.queuedAt,
          position: "front",
          queueDepth: activeHandle.pendingMessages.length,
        },
      });
      return {
        accepted: true,
        queued: true,
        routedTo: "leader",
        deliveryMode,
        queueDepth: activeHandle.pendingMessages.length,
      };
    }

    if (deliveryMode === "append") {
      const instruction = formatTeamInstruction(deliveryMode, runtimeContent);
      const steered = await steerActiveTeamLeader({
        session,
        actorName,
        content: instruction,
      });
      if (steered) {
        const turnIndex = recordHumanMessage();
        insertRuntimeSessionEvent({
          sessionId: session.id,
          actorId: args.actorId ?? null,
          actorName,
          eventType: "leader_instruction_appended",
          payload: {
            text: args.content,
            turnIndex,
            deliveryMode,
            routedTo: "leader",
            queued: false,
          },
        });
        return {
          accepted: true,
          queued: false,
          routedTo: "leader",
          deliveryMode,
          steered: true,
        };
      }

      const lastPending =
        activeHandle.pendingMessages[activeHandle.pendingMessages.length - 1];
      const queueId = randomUUID();
      const queuedAt = nowIso();
      if (lastPending) {
        const previousDisplayContent = lastPending.displayContent ?? lastPending.content;
        lastPending.content = mergeAppendedInstruction(lastPending.content, args.content);
        lastPending.displayContent = mergeAppendedInstruction(
          previousDisplayContent,
          args.content,
        );
        lastPending.deliveryMode = "append";
        lastPending.appendedQueueIds = [
          ...(lastPending.appendedQueueIds ?? []),
          queueId,
        ];
      } else {
        activeHandle.pendingMessages.push({
          id: queueId,
          content: instruction,
          displayContent: args.content,
          actorId: args.actorId ?? null,
          actorName,
          deliveryMode,
          queuedAt,
        });
      }
      insertRuntimeSessionEvent({
        sessionId: session.id,
        actorId: args.actorId ?? null,
        actorName,
        eventType: "leader_instruction_appended",
        payload: {
          text: args.content,
          deliveryMode,
          routedTo: "leader",
          queued: true,
          queueId,
          queuedAt,
          appendedToQueueId: lastPending?.id,
          appendedToPending: Boolean(lastPending),
          queueDepth: activeHandle.pendingMessages.length,
        },
      });
      return {
        accepted: true,
        queued: true,
        routedTo: "leader",
        deliveryMode,
        appended: true,
        queueDepth: activeHandle.pendingMessages.length,
      };
    }

    const pending = queueRuntimeMessage({
      handle: activeHandle,
      content: runtimeContent,
      displayContent: args.content,
      actorId: args.actorId ?? null,
      actorName,
      deliveryMode,
    });
    insertRuntimeSessionEvent({
      sessionId: session.id,
      actorId: args.actorId ?? null,
      actorName,
      eventType: "leader_instruction_queued",
      payload: {
        text: args.content,
        deliveryMode,
        routedTo: "leader",
        queueId: pending.id,
        queuedAt: pending.queuedAt,
        queueDepth: activeHandle.pendingMessages.length,
      },
    });
    return {
      accepted: true,
      queued: true,
      routedTo: "leader",
      deliveryMode,
      queueDepth: activeHandle.pendingMessages.length,
    };
  }

  if (session.mode === "agent_team" && session.status === "running" && !activeHandle?.isRunning) {
    insertRuntimeSessionEvent({
      sessionId: session.id,
      actorName: "System",
      eventType: "session_recovered_from_stale_running",
      payload: {
        reason: "database_status_running_without_active_runtime_handle",
        nextTurnIndex: getNextTurnIndex(session.id),
      },
    });
    updateRuntimeSessionStatus(session.id, "idle", null);
  }

  if (activeHandle?.isRunning) {
    const turnIndex = recordHumanMessage();
    const accepted = await piRuntimeAdapter.resumeSession({
      sessionId: session.id,
      actorName,
      content: args.content,
    });
    if (!accepted) {
      scheduleRuntimeSessionPrompt({
        session,
        runtimeBinding,
        providerProfile,
        latestUserMessage: runtimeContent,
        turnIndex,
      });
      return { accepted: true, queued: false };
    }
    insertRuntimeSessionEvent({
      sessionId: session.id,
      actorId: args.actorId ?? null,
      actorName,
      eventType: "human_steer",
      payload: {
        text: args.content,
        turnIndex,
        deliveryMode,
      },
    });
    return { accepted: true, queued: true, deliveryMode };
  }

  const turnIndex = recordHumanMessage();
  scheduleRuntimeSessionPrompt({
    session,
    runtimeBinding,
    providerProfile,
    latestUserMessage: runtimeContent,
    turnIndex,
  });

  return { accepted: true, queued: false, deliveryMode };
}
