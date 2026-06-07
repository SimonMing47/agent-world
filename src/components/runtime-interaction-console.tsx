"use client";

import {
  ArrowDown,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Activity,
  CircleStop,
  ListPlus,
  MessageSquareMore,
  MessageSquarePlus,
  MessagesSquare,
  SendHorizontal,
  UserRound,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type TouchEvent,
  type WheelEvent,
} from "react";
import { localizeNode, useLanguageText } from "@/components/language-pack-provider";
import { PixelAgentAvatar } from "@/components/pixel-agent-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { parseAgentCapabilityProfile } from "@/lib/agent-capability-profile";
import { parsePixelAgentAvatarConfig } from "@/lib/pixel-agent-avatar";
import { uiText } from "@/lib/language-pack";
import { cn, formatDateTime } from "@/lib/utils";

type RuntimeInteractionConsoleProps = {
  sessionId: string;
  sessionMode: "single_agent" | "agent_team";
  initialStatus: string;
  initialMessages: Array<{
    id: string;
    actorType: string;
    actorId?: string | null;
    actorName: string;
    role: string;
    content: Record<string, unknown>;
    turnIndex: number;
    createdAt: string;
  }>;
  initialEvents: Array<{
    id: string;
    actorName: string | null;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
  participants: Array<{
    id: string;
    name: string;
    displayName?: string;
    role: string;
    kind: "agent" | "human";
    isLeader?: boolean;
    mentionHandle?: string;
    avatarConfigJson?: string;
    capabilityProfileJson?: string;
  }>;
  compactFacts: Array<{
    label: string;
    value: string;
    detail?: ReactNode;
  }>;
  teamContext?: {
    id?: string | null;
    name: string;
    description?: string;
    workflowType?: string;
    leaderAgentId?: string | null;
  } | null;
};

type ParticipantCard = {
  id: string;
  name: string;
  displayName?: string;
  role: string;
  kind: "agent" | "human" | "tool";
  isLeader?: boolean;
  mentionHandle?: string;
  avatarConfigJson?: string;
  capabilityProfileJson?: string;
};

type ActorPhase = "idle" | "thinking" | "replying" | "tool" | "waiting" | "error";

type ActorActivity = {
  name: string;
  kind: "agent" | "human" | "tool";
  phase: ActorPhase;
  active: boolean;
  summary: string;
  updatedAt: string;
};

type Tone = {
  shell: string;
  avatar: string;
  avatarText: string;
  ring: string;
};

type MentionLookupState = {
  start: number;
  end: number;
  query: string;
  activeIndex: number;
};

type SelectedContext =
  | { kind: "team"; id: string }
  | { kind: "agent"; id: string };

type ConversationArea =
  | { kind: "main" }
  | { kind: "derived"; id: string };

type TeamDeliveryMode = "queue" | "append" | "interject" | "interrupt";

type TeamDeliveryModeOption = {
  key: TeamDeliveryMode;
  labelKey: string;
  descriptionKey: string;
  Icon: LucideIcon;
};

type ActivityMessageTarget = {
  messageId: string;
  createdAt: string;
  actorName: string;
  role: string;
};

type QueuedInstruction = {
  id: string;
  text: string;
  actorName: string;
  deliveryMode: TeamDeliveryMode;
  createdAt: string;
};

type RuntimeMessage = RuntimeInteractionConsoleProps["initialMessages"][number];

type SubareaSummary = {
  id: string;
  title: string;
  kind: string;
  sourceActorName: string;
  targetActorName: string;
  participant: ParticipantCard | null;
  active: boolean;
  messageCount: number;
  toolCount: number;
  latestAt: string;
  preview: string;
  contextText: string;
  messages: RuntimeMessage[];
};

const participantTones: Tone[] = [
  {
    shell: "border-[#c8d5e4] bg-white",
    avatar: "bg-[#e8eef8]",
    avatarText: "text-[#1d4ed8]",
    ring: "ring-2 ring-[#dbeafe]",
  },
  {
    shell: "border-[#d5dfcb] bg-white",
    avatar: "bg-[#edf6e8]",
    avatarText: "text-[#166534]",
    ring: "ring-2 ring-[#dcfce7]",
  },
  {
    shell: "border-[#e1d5c7] bg-white",
    avatar: "bg-[#fbefe4]",
    avatarText: "text-[#b45309]",
    ring: "ring-2 ring-[#fef3c7]",
  },
  {
    shell: "border-[#d8d2ea] bg-white",
    avatar: "bg-[#efe8fb]",
    avatarText: "text-[#7c3aed]",
    ring: "ring-2 ring-[#ede9fe]",
  },
];

const AUTO_FOLLOW_THRESHOLD = 120;
const AUTO_SCROLL_SETTLE_MS = 1200;

const teamDeliveryModes: TeamDeliveryModeOption[] = [
  {
    key: "queue",
    labelKey: "ui.runtimeConsole.delivery.queue.label",
    descriptionKey: "ui.runtimeConsole.delivery.queue.description",
    Icon: ListPlus,
  },
  {
    key: "append",
    labelKey: "ui.runtimeConsole.delivery.append.label",
    descriptionKey: "ui.runtimeConsole.delivery.append.description",
    Icon: MessageSquarePlus,
  },
  {
    key: "interject",
    labelKey: "ui.runtimeConsole.delivery.interject.label",
    descriptionKey: "ui.runtimeConsole.delivery.interject.description",
    Icon: MessagesSquare,
  },
  {
    key: "interrupt",
    labelKey: "ui.runtimeConsole.delivery.interrupt.label",
    descriptionKey: "ui.runtimeConsole.delivery.interrupt.description",
    Icon: CircleStop,
  },
];

type LanguageText = (keyOrPhrase: string, fallback?: string, params?: Record<string, string | number>) => string;

function maskToken(value: string) {
  if (value.length <= 8) return "[REDACTED]";
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

function redactSecrets(value: string) {
  return value
    .replace(
      /((?:API|ACCESS|AUTH|TOKEN|SECRET|PASSWORD|PRIVATE|KEY)[A-Z0-9_ -]*\s*[:=]\s*)([^\s"']+)/gim,
      (_match, prefix: string, secret: string) => `${prefix}${maskToken(secret)}`,
    )
    .replace(
      /-----BEGIN [^-]+-----[\s\S]+?-----END [^-]+-----/g,
      "[REDACTED KEY MATERIAL]",
    )
    .replace(/\b[a-z0-9]{24,}\.[A-Za-z0-9._-]{12,}\b/g, (match) => maskToken(match))
    .replace(/\bsk-[A-Za-z0-9]{16,}\b/g, (match) => maskToken(match));
}

function messageText(content: Record<string, unknown>) {
  if (typeof content.text === "string" && content.text.trim()) return content.text;
  if (Array.isArray(content.content)) {
    return content.content
      .map((block) => {
        if (!block || typeof block !== "object") return "";
        const typedBlock = block as Record<string, unknown>;
        if (typedBlock.type === "text") return String(typedBlock.text ?? "");
        if (typedBlock.type === "thinking") return String(typedBlock.thinking ?? "");
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function thinkingText(content: Record<string, unknown>) {
  return typeof content.thinkingText === "string" ? content.thinkingText : "";
}

function renderUsage(content: Record<string, unknown>) {
  const usage = content.usage;
  if (!usage || typeof usage !== "object") return null;
  const typedUsage = usage as Record<string, unknown>;
  const totalTokens = typedUsage.totalTokens;
  return typeof totalTokens === "number" ? `${totalTokens} tokens` : null;
}

function renderAssistantFinish(content: Record<string, unknown>) {
  const stopReason = typeof content.stopReason === "string" ? content.stopReason : "";
  if (!stopReason || stopReason === "stop") return null;
  if (stopReason === "toolUse") return uiText("ui.runtimeConsole.finish.toolUse");
  if (stopReason === "error") {
    const errorMessage = typeof content.errorMessage === "string" ? content.errorMessage : "";
    return errorMessage
      ? uiText("ui.runtimeConsole.finish.errorWithMessage", undefined, { message: errorMessage })
      : uiText("ui.runtimeConsole.finish.error");
  }
  if (stopReason === "length" || stopReason === "maxTokens") return uiText("ui.runtimeConsole.finish.maxTokens");
  if (stopReason === "cancelled") return uiText("ui.runtimeConsole.finish.cancelled");
  return uiText("ui.runtimeConsole.finish.status", undefined, { status: stopReason });
}

function renderEventSummary(payload: Record<string, unknown>) {
  if (
    typeof payload.originalTokenEstimate === "number" &&
    typeof payload.compactedTokenEstimate === "number"
  ) {
    const source = typeof payload.source === "string" ? payload.source : "summary";
    const preview = typeof payload.summaryPreview === "string" ? payload.summaryPreview : "";
    return redactSecrets(
      uiText("ui.runtimeConsole.event.contextCompacted", undefined, {
        original: payload.originalTokenEstimate,
        compacted: payload.compactedTokenEstimate,
        source,
        preview,
      }),
    );
  }
  if (typeof payload.delta === "string" && payload.delta.trim()) return redactSecrets(payload.delta);
  if (typeof payload.text === "string" && payload.text.trim()) return redactSecrets(payload.text);
  if (typeof payload.toolName === "string") return redactSecrets(payload.toolName);
  if (typeof payload.error === "string") return redactSecrets(payload.error);
  if (typeof payload.content === "string" && payload.content.trim()) return redactSecrets(payload.content);
  return redactSecrets(JSON.stringify(payload));
}

function labelForPhase(phase: ActorPhase) {
  if (phase === "thinking") return "ui.runtimeConsole.phase.thinking";
  if (phase === "replying") return "ui.runtimeConsole.phase.replying";
  if (phase === "tool") return "ui.runtimeConsole.phase.tool";
  if (phase === "waiting") return "ui.runtimeConsole.phase.waiting";
  if (phase === "error") return "ui.runtimeConsole.phase.error";
  return "ui.runtimeConsole.phase.idle";
}

function labelForMessageRole(role: string) {
  if (role === "assistant") return "Agent";
  if (role === "user") return "ui.runtimeConsole.role.user";
  if (role === "toolResult") return "ui.runtimeConsole.role.toolResult";
  return role;
}

function badgeVariantForPhase(phase: ActorPhase): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (phase === "error") return "danger";
  if (phase === "waiting") return "warning";
  if (phase === "idle") return "neutral";
  return "accent";
}

function toneForName(name: string) {
  const seed = Array.from(name).reduce((total, char) => total + char.charCodeAt(0), 0);
  return participantTones[seed % participantTones.length];
}

function participantDisplayName(participant: ParticipantCard) {
  return participant.displayName?.trim() || participant.name;
}

function participantRoleLabel(participant: ParticipantCard) {
  const role = participant.role?.trim();
  if (!role || role === participantDisplayName(participant)) return "";
  return role;
}

function subareaTitle(summary: SubareaSummary) {
  if (!summary.participant) return summary.title;
  const role = participantRoleLabel(summary.participant);
  return role ? `${participantDisplayName(summary.participant)} · ${role}` : summary.title;
}

function participantSeed(participant: ParticipantCard) {
  return `${participantDisplayName(participant)}-${participant.role || participant.name}`;
}

function mentionHandleForParticipant(participant: ParticipantCard) {
  if (participant.mentionHandle?.trim()) return participant.mentionHandle.trim();
  const source = participant.name || participantDisplayName(participant) || participant.id;
  const slug =
    source
      .toLowerCase()
      .replace(/[/|]+/g, " ")
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || participant.id.slice(0, 8);
  return `@${slug}`;
}

function findMentionLookup(value: string, cursor: number): MentionLookupState | null {
  const beforeCursor = value.slice(0, cursor);
  const atIndex = beforeCursor.lastIndexOf("@");
  if (atIndex < 0) return null;

  const fragment = beforeCursor.slice(atIndex);
  if (/\s/.test(fragment.slice(1))) return null;

  const previous = beforeCursor.at(atIndex - 1);
  if (previous && /[A-Za-z0-9_.-]/.test(previous)) return null;

  return {
    start: atIndex,
    end: cursor,
    query: fragment.slice(1).toLowerCase(),
    activeIndex: 0,
  };
}

function actorKindFromMessage(message: RuntimeInteractionConsoleProps["initialMessages"][number]) {
  if (message.actorType === "human") return "human";
  if (message.role === "toolResult" || message.actorType === "tool") return "tool";
  return "agent";
}

function buildParticipants(
  participants: RuntimeInteractionConsoleProps["participants"],
  messages: RuntimeInteractionConsoleProps["initialMessages"],
) {
  const registry = new Map<string, ParticipantCard>();

  for (const participant of participants) {
    const card = {
      id: participant.id,
      name: participant.name,
      displayName: participant.displayName,
      role: participant.role,
      kind: participant.kind,
      isLeader: participant.isLeader,
      mentionHandle: participant.mentionHandle,
      avatarConfigJson: participant.avatarConfigJson,
      capabilityProfileJson: participant.capabilityProfileJson,
    } satisfies ParticipantCard;
    registry.set(participant.name, card);
    if (participant.displayName?.trim()) registry.set(participant.displayName, card);
  }

  for (const message of messages) {
    if (message.role === "toolResult") continue;
    if (registry.has(message.actorName)) continue;
    registry.set(message.actorName, {
      id: message.id,
      name: message.actorName,
      role:
        message.actorType === "human"
          ? "ui.common.humanCollaboration"
          : message.role === "toolResult"
            ? "ui.runtimeConsole.role.toolResult"
            : "ui.runtimeConsole.role.collaborator",
      kind: actorKindFromMessage(message),
    });
  }

  return [...new Map([...registry.values()].map((participant) => [participant.id, participant])).values()];
}

function isAssistantToolHandshake(message: RuntimeInteractionConsoleProps["initialMessages"][number]) {
  return (
    message.role === "assistant" &&
    !messageText(message.content).trim() &&
    !thinkingText(message.content).trim() &&
    message.content.stopReason === "toolUse"
  );
}

function participantOwnsMessage(
  participant: ParticipantCard,
  message: RuntimeInteractionConsoleProps["initialMessages"][number],
) {
  return (
    message.actorId === participant.id ||
    message.actorName === participant.name ||
    Boolean(participant.displayName && message.actorName === participant.displayName)
  );
}

function participantOwnsEvent(
  participant: ParticipantCard,
  event: RuntimeInteractionConsoleProps["initialEvents"][number],
) {
  return (
    event.actorName === participant.name ||
    Boolean(participant.displayName && event.actorName === participant.displayName)
  );
}

function getSubConversationRecord(content: Record<string, unknown>) {
  const embedded = content.subConversation;
  return embedded && typeof embedded === "object" && !Array.isArray(embedded)
    ? (embedded as Record<string, unknown>)
    : {};
}

function getSubConversationIdFromContent(content: Record<string, unknown>) {
  const direct = typeof content.subConversationId === "string" ? content.subConversationId : "";
  if (direct.trim()) return direct.trim();
  const embedded = getSubConversationRecord(content);
  return typeof embedded.id === "string" && embedded.id.trim() ? embedded.id.trim() : "";
}

function getSubConversationIdFromEvent(event: RuntimeInteractionConsoleProps["initialEvents"][number]) {
  const direct = typeof event.payload.subConversationId === "string" ? event.payload.subConversationId : "";
  if (direct.trim()) return direct.trim();
  const embedded = event.payload.subConversation;
  if (!embedded || typeof embedded !== "object" || Array.isArray(embedded)) return "";
  const id = (embedded as Record<string, unknown>).id;
  return typeof id === "string" && id.trim() ? id.trim() : "";
}

function subConversationMetaFromRecord(content: Record<string, unknown>) {
  const embedded = getSubConversationRecord(content);
  return {
    parentId:
      typeof content.subConversationParentId === "string"
        ? content.subConversationParentId
        : typeof embedded.parentId === "string"
          ? embedded.parentId
          : "",
    kind:
      typeof content.subConversationKind === "string"
        ? content.subConversationKind
        : typeof embedded.kind === "string"
          ? embedded.kind
          : "derived",
    title:
      typeof content.subConversationTitle === "string"
        ? content.subConversationTitle
        : typeof embedded.title === "string"
          ? embedded.title
          : "",
    sourceActorName:
      typeof content.subConversationSourceActorName === "string"
        ? content.subConversationSourceActorName
        : typeof embedded.sourceActorName === "string"
          ? embedded.sourceActorName
          : "",
    targetActorName:
      typeof content.subConversationTargetActorName === "string"
        ? content.subConversationTargetActorName
        : typeof embedded.targetActorName === "string"
          ? embedded.targetActorName
          : "",
    contextText:
      typeof content.subConversationContext === "string"
        ? content.subConversationContext
        : typeof embedded.contextText === "string"
          ? embedded.contextText
          : "",
  };
}

function toolResultBucketKey(message: RuntimeMessage) {
  return [
    message.turnIndex,
    message.actorId ?? message.actorName,
    getSubConversationIdFromContent(message.content) || "main",
  ].join(":");
}

function messageDomId(messageId: string) {
  return `runtime-message-${messageId}`;
}

function buildActorActivities(
  orderedEvents: RuntimeInteractionConsoleProps["initialEvents"],
  knownParticipants: ParticipantCard[],
  orderedMessages: RuntimeInteractionConsoleProps["initialMessages"],
  sessionStatus: string,
) {
  const registry = new Map<string, ActorActivity>();

  const ensureActor = (name: string, kind: ActorActivity["kind"] = "agent") => {
    const existing = registry.get(name);
    if (existing) return existing;
    const next: ActorActivity = {
      name,
      kind,
      phase: "idle",
      active: false,
      summary: "ui.runtimeConsole.state.waitingInput",
      updatedAt: "",
    };
    registry.set(name, next);
    return next;
  };

  for (const participant of knownParticipants) {
    ensureActor(participant.name, participant.kind);
  }

  for (const event of orderedEvents) {
    const actorName = event.actorName ?? "System";
    const knownHuman = knownParticipants.some(
      (participant) => participant.kind === "human" && participant.name === actorName,
    );
    const current = ensureActor(
      actorName,
      knownHuman ? "human" : "agent",
    );
    const toolName =
      typeof event.payload.toolName === "string" ? event.payload.toolName : undefined;
    const eventSummary = renderEventSummary(event.payload);

    if (
      event.eventType === "thinking_start" ||
      event.eventType === "thinking_delta" ||
      event.eventType === "session_started" ||
      event.eventType === "agent_started"
    ) {
      current.phase = "thinking";
      current.active = true;
      current.summary = eventSummary || "ui.runtimeConsole.activity.organizingThoughts";
    } else if (event.eventType === "thinking_end") {
      current.phase = "replying";
      current.active = true;
      current.summary = "ui.runtimeConsole.activity.preparingReply";
    } else if (event.eventType === "agent_message_delta") {
      current.phase = "replying";
      current.active = true;
      current.summary = eventSummary || "ui.runtimeConsole.activity.generatingReply";
    } else if (
      event.eventType === "tool_call_requested" ||
      event.eventType === "tool_call_started" ||
      event.eventType === "tool_call_update"
    ) {
      current.phase = "tool";
      current.active = true;
      current.summary = toolName ? `ui.common.processingPrefix ${toolName}` : "ui.runtimeConsole.activity.processingToolCall";
    } else if (event.eventType === "tool_call_finished") {
      current.phase = "thinking";
      current.active = true;
      current.summary = toolName ? `${toolName} ui.common.completed` : "ui.runtimeConsole.activity.toolCallCompleted";
    } else if (event.eventType === "human_approval_required") {
      current.phase = "waiting";
      current.active = true;
      current.summary = toolName ? `ui.common.approvalPrefix ${toolName}` : "ui.runtimeConsole.activity.waitingApproval";
    } else if (event.eventType === "context_compacted") {
      current.phase = "thinking";
      current.active = true;
      current.summary = eventSummary || "ui.runtimeConsole.event.contextCompactedShort";
    } else if (event.eventType === "session_completed" || event.eventType === "agent_completed") {
      current.phase = "idle";
      current.active = false;
      current.summary = "ui.runtimeConsole.activity.turnCompleted";
    } else if (event.eventType === "session_failed") {
      current.phase = "error";
      current.active = false;
      current.summary = eventSummary || "ui.runtimeConsole.activity.executionFailed";
    } else if (event.eventType === "human_message" || event.eventType === "human_steer") {
      current.phase = "idle";
      current.active = false;
      current.summary = "ui.runtimeConsole.activity.humanMessageSent";
      current.kind = "human";
    } else if (event.eventType === "leader_instruction_queued") {
      current.phase = "waiting";
      current.active = false;
      current.summary = "ui.runtimeConsole.queue.queuedForLeader";
      current.kind = "human";
    }

    current.updatedAt = event.createdAt;
  }

  for (const message of orderedMessages) {
    if (message.role === "toolResult") {
      const owner = message.actorId
        ? knownParticipants.find((participant) => participant.id === message.actorId)
        : null;
      if (!owner) continue;
      const current = ensureActor(owner.name, owner.kind);
      if (current.active) continue;
      current.summary = `ui.common.returnOutputPrefix ${message.actorName} ui.common.outputSuffix`;
      current.updatedAt = message.createdAt;
      continue;
    }

    const current = ensureActor(message.actorName, actorKindFromMessage(message));
    if (current.active) continue;
    if (message.role === "assistant") {
      current.summary = redactSecrets(messageText(message.content)).slice(0, 72) || "ui.runtimeConsole.activity.replyOutput";
      current.updatedAt = message.createdAt;
    } else if (message.role === "user") {
      current.summary = "ui.runtimeConsole.activity.messageSent";
      current.updatedAt = message.createdAt;
    }
  }

  if (sessionStatus === "running") {
    const hasActiveActor = [...registry.values()].some((activity) => activity.active);
    if (!hasActiveActor) {
      const fallback = knownParticipants.find((participant) => participant.kind === "agent");
      if (fallback) {
        const current = ensureActor(fallback.name, fallback.kind);
        current.phase = "replying";
        current.active = true;
        current.summary = "ui.runtimeConsole.activity.continuing";
      }
    }
  }

  return [...registry.values()].sort((left, right) => {
    if (left.active !== right.active) return left.active ? -1 : 1;
    const leftTime = Date.parse(left.updatedAt || "");
    const rightTime = Date.parse(right.updatedAt || "");
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return rightTime - leftTime;
    }
    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function buildQueuedInstructions(
  orderedEvents: RuntimeInteractionConsoleProps["initialEvents"],
) {
  const queue = new Map<string, QueuedInstruction>();
  const order: string[] = [];

  const upsert = (
    event: RuntimeInteractionConsoleProps["initialEvents"][number],
    mode: TeamDeliveryMode,
  ) => {
    const textValue = typeof event.payload.text === "string" ? event.payload.text.trim() : "";
    if (!textValue) return;
    const queueId = typeof event.payload.queueId === "string" ? event.payload.queueId : event.id;
    const existing = queue.get(queueId);
    if (!existing) order.push(queueId);
    queue.set(queueId, {
      id: queueId,
      text: textValue,
      actorName: event.actorName ?? "User",
      deliveryMode: mode,
      createdAt: typeof event.payload.queuedAt === "string" ? event.payload.queuedAt : event.createdAt,
    });
  };

  for (const event of orderedEvents) {
    if (event.eventType === "leader_instruction_interrupted") {
      queue.clear();
      order.length = 0;
      continue;
    }
    if (event.eventType === "leader_instruction_dequeued") {
      const queueId = typeof event.payload.queueId === "string" ? event.payload.queueId : order[0];
      if (queueId) queue.delete(queueId);
      const index = order.indexOf(queueId);
      if (index >= 0) order.splice(index, 1);
      continue;
    }
    if (event.eventType === "leader_instruction_queued") {
      upsert(event, "queue");
      continue;
    }
    if (event.eventType === "leader_instruction_interjected" && event.payload.queued === true) {
      upsert(event, "interject");
      continue;
    }
    if (event.eventType === "leader_instruction_appended" && event.payload.queued === true) {
      const targetQueueId = typeof event.payload.appendedToQueueId === "string" ? event.payload.appendedToQueueId : "";
      if (targetQueueId && queue.has(targetQueueId)) {
        const existing = queue.get(targetQueueId);
        const addition = typeof event.payload.text === "string" ? event.payload.text.trim() : "";
        if (existing && addition) {
          queue.set(targetQueueId, {
            ...existing,
            text: `${existing.text}\n\n${uiText("ui.runtimeConsole.queue.appendMarker")}\n${addition}`,
            deliveryMode: "append",
          });
        }
      } else {
        upsert(event, "append");
      }
    }
  }

  return order.map((id) => queue.get(id)).filter((item): item is QueuedInstruction => Boolean(item));
}

function formatActivitySummary(label: string, text: LanguageText) {
  if (label.startsWith("ui.common.processingPrefix ")) {
    return `${text("ui.common.processingPrefix")} ${label.slice("ui.common.processingPrefix ".length)}`;
  }
  if (label.startsWith("ui.common.approvalPrefix ")) {
    return `${text("ui.common.approvalPrefix")} ${label.slice("ui.common.approvalPrefix ".length)}`;
  }
  if (label.endsWith(" ui.common.completed")) {
    return `${label.slice(0, -" ui.common.completed".length)} ${text("ui.common.completed")}`;
  }
  if (label.startsWith("ui.common.returnOutputPrefix ") && label.endsWith(" ui.common.outputSuffix")) {
    return `${text("ui.common.returnOutputPrefix")} ${label
      .slice("ui.common.returnOutputPrefix ".length, -" ui.common.outputSuffix".length)} ${text("ui.common.outputSuffix")}`;
  }
  return text(label);
}

function TypingIndicator({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const text = useLanguageText();
  const displayLabel = formatActivitySummary(label, text);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="agent-typing-indicator" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="text-xs font-medium text-[var(--ink-muted)]">{displayLabel}</div>
    </div>
  );
}

function ParticipantAvatar({
  participant,
  active,
  size = "sm",
}: {
  participant: ParticipantCard;
  active: boolean;
  size?: "sm" | "md";
}) {
  const tone = toneForName(participant.name);
  const frameClass = size === "md" ? "h-14 w-12" : "h-11 w-11";
  const iconClass = size === "md" ? "h-5 w-5" : "h-4 w-4";

  if (participant.kind === "agent") {
    const seed = participantSeed(participant);
    const avatarConfig = parsePixelAgentAvatarConfig(participant.avatarConfigJson, seed);
    const capabilityProfile = parseAgentCapabilityProfile(participant.capabilityProfileJson, seed);

    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg",
          frameClass,
          active && tone.ring,
        )}
        title={participantDisplayName(participant)}
      >
        <PixelAgentAvatar
          config={avatarConfig}
          capabilityProfile={capabilityProfile}
          seed={seed}
          roleHint={participant.role}
          size="sm"
          className={cn(
            "shadow-none",
            size === "md" ? "!h-14 !w-11" : "!h-11 !w-9",
          )}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border border-white/60",
        frameClass,
        tone.avatar,
        tone.avatarText,
        active && tone.ring,
      )}
    >
      {participant.kind === "human" ? (
        <UserRound className={iconClass} />
      ) : (
        <Wrench className={iconClass} />
      )}
    </div>
  );
}

function BubbleMeta({
  message,
  participant,
  inverted = false,
}: {
  message: RuntimeInteractionConsoleProps["initialMessages"][number];
  participant: ParticipantCard;
  inverted?: boolean;
}) {
  const text = useLanguageText();
  const displayName = participantDisplayName(participant);
  const roleLabel = participant.kind === "agent" ? participantRoleLabel(participant) : "";
  const actorLabel =
    participant.kind === "agent" &&
    displayName !== message.actorName &&
    message.actorName !== roleLabel
      ? message.actorName
      : null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-xs",
        inverted ? "text-white/72" : "text-[var(--ink-muted)]",
      )}
    >
      <span className={cn("font-medium", inverted ? "text-white" : "text-[var(--ink)]")}>
        {displayName}
      </span>
      {actorLabel ? <Badge variant="neutral">{actorLabel}</Badge> : null}
      {roleLabel ? <Badge variant={participant.isLeader ? "accent" : "neutral"}>{text(roleLabel)}</Badge> : null}
      {participant.isLeader ? <Badge variant="accent">{text("ui.runtimeConsole.role.leader")}</Badge> : null}
      {message.role === "toolResult" ? <Badge variant="warning">{text("ui.runtimeConsole.role.tool")}</Badge> : null}
      {message.role === "assistant" ? <Badge variant="neutral">Agent</Badge> : null}
      {message.role === "user" ? <Badge variant="neutral">{text("ui.runtimeConsole.role.user")}</Badge> : null}
      <span>{formatDateTime(message.createdAt)}</span>
    </div>
  );
}

function ThoughtDisclosure({ content }: { content: string }) {
  const text = useLanguageText();
  if (!content.trim()) return null;

  return (
    <details className="group mt-3 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/75">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-[var(--ink-muted)] outline-none transition hover:bg-white/50 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <BrainCircuit className="h-3.5 w-3.5 shrink-0" />
          <span>{text("ui.runtimeConsole.thought.title")}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-[var(--line)] px-3 py-3">
        <div className="whitespace-pre-wrap text-xs leading-5 text-[var(--ink-muted)]">
          {redactSecrets(content)}
        </div>
      </div>
    </details>
  );
}

function ToolCallsDisclosure({
  messages,
}: {
  messages: RuntimeMessage[];
}) {
  const text = useLanguageText();
  const [isOpen, setIsOpen] = useState(false);
  const [openToolIds, setOpenToolIds] = useState<Set<string>>(() => new Set());

  if (messages.length === 0) return null;

  const failedCount = messages.filter((message) => Boolean(message.content.isError)).length;
  const latestTool = messages[messages.length - 1];
  const latestToolName =
    typeof latestTool?.content.toolName === "string" && latestTool.content.toolName.trim()
      ? latestTool.content.toolName
      : latestTool?.actorName;

  const toggleTool = (messageId: string) => {
    setOpenToolIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/75">
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium text-[var(--ink-muted)] outline-none transition hover:bg-white/50 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Wrench className="h-3.5 w-3.5 shrink-0" />
          <span>{text("ui.runtimeConsole.tools.title")}</span>
          <Badge variant={failedCount > 0 ? "danger" : "neutral"}>
            {text("ui.runtimeConsole.tools.count", undefined, { count: messages.length })}
          </Badge>
          {latestToolName ? (
            <span className="hidden truncate text-[11px] font-normal text-[var(--ink-muted)] sm:inline">
              {text("ui.runtimeConsole.tools.current", undefined, { tool: latestToolName })}
            </span>
          ) : null}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen ? (
      <div className="space-y-2 border-t border-[var(--line)] px-3 py-3">
        {messages.map((message) => {
          const toolName =
            typeof message.content.toolName === "string" && message.content.toolName.trim()
              ? message.content.toolName
              : message.actorName;
          const isError = Boolean(message.content.isError);
          const details = message.content.details;
          const toolIsOpen = openToolIds.has(message.id);
          return (
            <div key={message.id} className="rounded-md border border-[var(--line)] bg-white">
              <button
                type="button"
                aria-expanded={toolIsOpen}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35"
                onClick={() => toggleTool(message.id)}
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-[var(--ink)]">{toolName}</div>
                  <div className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">
                    {formatDateTime(message.createdAt)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={isError ? "danger" : "success"}>
                    {isError ? text("ui.runtimeConsole.status.failed") : text("ui.runtimeConsole.status.completed")}
                  </Badge>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-[var(--ink-muted)] transition-transform", toolIsOpen && "rotate-180")} />
                </div>
              </button>
              {toolIsOpen ? (
              <div className="space-y-2 border-t border-[var(--line)] bg-[var(--surface-muted)]/45 px-3 py-2">
                <div className="max-h-36 overflow-auto whitespace-pre-wrap text-xs leading-5 text-[var(--ink-muted)]">
                  {redactSecrets(messageText(message.content)) || text("ui.runtimeConsole.tools.emptyOutput")}
                </div>
                {details ? (
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--line)] bg-white px-2 py-2 text-[11px] leading-5 text-[var(--ink-muted)]">
                    {redactSecrets(JSON.stringify(details, null, 2))}
                  </pre>
                ) : null}
              </div>
              ) : null}
            </div>
          );
        })}
      </div>
      ) : null}
    </div>
  );
}

function RuntimeMessageBubble({
  message,
  participant,
  isFocused,
  toolResults,
}: {
  message: RuntimeMessage;
  participant: ParticipantCard;
  isFocused: boolean;
  toolResults: RuntimeMessage[];
}) {
  const text = useLanguageText();
  const isHuman = message.role === "user";

  return (
    <div
      id={messageDomId(message.id)}
      className={cn(
        "scroll-mt-6 rounded-[24px] transition-[background,box-shadow] duration-300",
        isFocused && "bg-[var(--accent)]/10 shadow-[0_0_0_2px_rgba(9,199,232,0.34)]",
      )}
    >
      <div className={cn("flex gap-3", isHuman ? "justify-end" : "justify-start")}>
        {!isHuman ? <ParticipantAvatar participant={participant} active={false} /> : null}
        <div className={cn("max-w-[min(100%,760px)]", isHuman && "order-first")}>
          <div
            className={cn(
              "rounded-[22px] border px-4 py-3",
              isHuman
                ? "border-transparent bg-[var(--accent)] text-white"
                : "border-[var(--line)] bg-white",
            )}
          >
            <BubbleMeta
              message={message}
              participant={participant}
              inverted={isHuman}
            />
            <div
              className={cn(
                "mt-3 whitespace-pre-wrap text-sm leading-6",
                isHuman ? "text-white" : "text-[var(--ink)]",
              )}
            >
              {redactSecrets(messageText(message.content))}
            </div>
            {message.role === "assistant" && thinkingText(message.content) ? (
              <ThoughtDisclosure content={thinkingText(message.content)} />
            ) : null}
            {message.role === "assistant" ? (
              <ToolCallsDisclosure messages={toolResults} />
            ) : null}
            {message.role === "assistant" ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--ink-muted)]">
                {typeof message.content.responseModel === "string" ? (
                  <span>{text("ui.runtimeConsole.message.modelPrefix")} {message.content.responseModel}</span>
                ) : null}
                {renderUsage(message.content) ? <span>{renderUsage(message.content)}</span> : null}
                {renderAssistantFinish(message.content) ? <span>{renderAssistantFinish(message.content)}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
        {isHuman ? <ParticipantAvatar participant={participant} active={false} /> : null}
      </div>
    </div>
  );
}

function SelectedContextPanel({
  selectedContext,
  teamContext,
  participants,
  actorActivities,
  messages,
  events,
  compactFacts,
}: {
  selectedContext: SelectedContext;
  teamContext: RuntimeInteractionConsoleProps["teamContext"];
  participants: ParticipantCard[];
  actorActivities: ActorActivity[];
  messages: RuntimeInteractionConsoleProps["initialMessages"];
  events: RuntimeInteractionConsoleProps["initialEvents"];
  compactFacts: RuntimeInteractionConsoleProps["compactFacts"];
}) {
  const text = useLanguageText();
  const agents = participants.filter((participant) => participant.kind === "agent");
  const humanParticipant = participants.find((participant) => participant.kind === "human");
  const humanLabel = humanParticipant ? participantDisplayName(humanParticipant) : text("ui.runtimeConsole.common.user");
  const selectedAgent =
    selectedContext.kind === "agent"
      ? agents.find((participant) => participant.id === selectedContext.id) ?? null
      : null;

  if (selectedContext.kind === "team" || !selectedAgent) {
    const leader = agents.find((participant) => participant.isLeader) ?? agents[0] ?? null;
    const latestHumanMessage = [...messages].reverse().find((message) => message.role === "user");

    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-[var(--accent)]">
              <UsersRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--ink)]">
                {teamContext?.name ?? text("ui.runtimeConsole.context.teamContext")}
              </div>
              <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">
                {text("ui.runtimeConsole.context.teamMeta", undefined, {
                  count: agents.length,
                  leader: leader ? participantDisplayName(leader) : text("ui.runtimeConsole.common.unset"),
                })}
              </div>
            </div>
          </div>
          {teamContext?.description ? (
            <div className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
              {teamContext.description}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-3">
          <div className="text-xs font-semibold text-[var(--ink)]">{text("ui.runtimeConsole.context.routingTitle")}</div>
          <div className="mt-2 space-y-2 text-xs leading-5 text-[var(--ink-muted)]">
            <div>{text("ui.runtimeConsole.context.routingHuman", undefined, { human: humanLabel })}</div>
            <div>{text("ui.runtimeConsole.context.routingDirectMention")}</div>
            <div>{text("ui.runtimeConsole.context.routingPeer")}</div>
            <div>{text("ui.runtimeConsole.context.routingLeaderSummary")}</div>
          </div>
        </div>

        <div className="space-y-2">
          {agents.map((participant) => {
            const activity = actorActivities.find((item) => item.name === participant.name);
            return (
              <div
                key={participant.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-2"
              >
                <ParticipantAvatar participant={participant} active={Boolean(activity?.active)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold text-[var(--ink)]">
                      {participantDisplayName(participant)}
                    </div>
                    {participant.isLeader ? <Badge variant="accent">Leader</Badge> : null}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                    {text(participant.role)}
                  </div>
                </div>
                <Badge variant={badgeVariantForPhase(activity?.phase ?? "idle")}>
                  {text(labelForPhase(activity?.phase ?? "idle"))}
                </Badge>
              </div>
            );
          })}
        </div>

        {latestHumanMessage ? (
          <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-3">
            <div className="text-xs font-semibold text-[var(--ink)]">{text("ui.runtimeConsole.context.latestHumanInput")}</div>
            <div className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs leading-5 text-[var(--ink-muted)]">
              {redactSecrets(messageText(latestHumanMessage.content))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {compactFacts.map((fact) => (
            <div
              key={`${fact.label}:${fact.value}`}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-3"
            >
              <div className="text-xs font-medium text-[var(--ink-muted)]">{text(fact.label)}</div>
              <div className="mt-1 text-sm font-semibold text-[var(--ink)]">{text(fact.value)}</div>
              {fact.detail ? (
                <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{localizeNode(fact.detail, text)}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activity = actorActivities.find((item) => item.name === selectedAgent.name);
  const agentMessages = messages
    .filter((message) => participantOwnsMessage(selectedAgent, message))
    .filter((message) => message.role !== "toolResult")
    .slice(-5)
    .reverse();
  const agentEvents = events
    .filter((event) => participantOwnsEvent(selectedAgent, event))
    .slice(-6)
    .reverse();
  const toolResults = messages
    .filter((message) => message.role === "toolResult" && message.actorId === selectedAgent.id)
    .slice(-4)
    .reverse();

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-3">
        <div className="flex items-center gap-3">
          <ParticipantAvatar participant={selectedAgent} active={Boolean(activity?.active)} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold text-[var(--ink)]">
                {participantDisplayName(selectedAgent)}
              </div>
              {selectedAgent.isLeader ? <Badge variant="accent">Leader</Badge> : null}
            </div>
            <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">{text(selectedAgent.role)}</div>
            <div className="mt-2">
              <Badge variant="neutral">{mentionHandleForParticipant(selectedAgent)}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-3">
        <div className="flex items-center justify-between gap-3">
            <div>
            <div className="text-xs font-semibold text-[var(--ink)]">{text("ui.runtimeConsole.context.currentStatus")}</div>
            <div className="mt-1 text-xs text-[var(--ink-muted)]">
              {formatActivitySummary(activity?.summary ?? "ui.runtimeConsole.state.waitingInput", text)}
            </div>
          </div>
          <Badge variant={badgeVariantForPhase(activity?.phase ?? "idle")}>
            {text(labelForPhase(activity?.phase ?? "idle"))}
          </Badge>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-3">
        <div className="text-xs font-semibold text-[var(--ink)]">{text("ui.runtimeConsole.context.visibleScope")}</div>
        <div className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
          {selectedAgent.isLeader
            ? text("ui.runtimeConsole.context.leaderScope", undefined, { human: humanLabel })
            : text("ui.runtimeConsole.context.agentScope")}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-3">
        <div className="text-xs font-semibold text-[var(--ink)]">{text("ui.runtimeConsole.context.recentMessages")}</div>
        <div className="mt-2 space-y-2">
          {agentMessages.length > 0 ? agentMessages.map((message) => (
            <div key={message.id} className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--ink-muted)]">
                <Badge variant={message.role === "assistant" ? "neutral" : "accent"}>
                  {text(labelForMessageRole(message.role))}
                </Badge>
                <span>{formatDateTime(message.createdAt)}</span>
              </div>
              <div className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-xs leading-5 text-[var(--ink-muted)]">
                {redactSecrets(messageText(message.content)) || renderAssistantFinish(message.content) || text("ui.runtimeConsole.context.emptyText")}
              </div>
            </div>
          )) : (
            <div className="text-xs text-[var(--ink-muted)]">{text("ui.runtimeConsole.context.noAgentMessages")}</div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-3">
        <div className="text-xs font-semibold text-[var(--ink)]">{text("ui.runtimeConsole.context.recentTools")}</div>
        <div className="mt-2 space-y-2">
          {toolResults.length > 0 ? toolResults.map((message) => (
            <div key={message.id} className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-xs font-semibold text-[var(--ink)]">
                  {typeof message.content.toolName === "string" ? message.content.toolName : message.actorName}
                </div>
                <Badge variant={message.content.isError ? "danger" : "success"}>
                  {message.content.isError ? text("ui.runtimeConsole.status.failed") : text("ui.runtimeConsole.status.completed")}
                </Badge>
              </div>
              <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">
                {redactSecrets(messageText(message.content)) || text("ui.runtimeConsole.context.emptyToolText")}
              </div>
            </div>
          )) : (
            <div className="text-xs text-[var(--ink-muted)]">{text("ui.runtimeConsole.context.noTools")}</div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-3">
        <div className="text-xs font-semibold text-[var(--ink)]">{text("ui.runtimeConsole.context.recentEvents")}</div>
        <div className="mt-2 space-y-2">
          {agentEvents.length > 0 ? agentEvents.map((event) => (
            <div key={event.id} className="rounded-md bg-[var(--surface-muted)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="neutral">{event.eventType}</Badge>
                <span className="text-[11px] text-[var(--ink-muted)]">{formatDateTime(event.createdAt)}</span>
              </div>
              <div className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-[var(--ink-muted)]">
                {renderEventSummary(event.payload)}
              </div>
            </div>
          )) : (
            <div className="text-xs text-[var(--ink-muted)]">{text("ui.runtimeConsole.context.noEvents")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RuntimeInteractionConsole(props: RuntimeInteractionConsoleProps) {
  const text = useLanguageText();
  const [status, setStatus] = useState(props.initialStatus);
  const [messages, setMessages] = useState(props.initialMessages);
  const [events, setEvents] = useState(props.initialEvents);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<TeamDeliveryMode>("queue");
  const [inspectorTab, setInspectorTab] = useState<"activity" | "events" | "summary">("activity");
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [unseenUpdates, setUnseenUpdates] = useState(0);
  const [mentionLookup, setMentionLookup] = useState<MentionLookupState | null>(null);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<SelectedContext>({
    kind: "team",
    id: props.teamContext?.id ?? props.sessionId,
  });
  const [conversationArea, setConversationArea] = useState<ConversationArea>({ kind: "main" });
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const autoFollowPausedRef = useRef(false);
  const lastAutoScrollAtRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);

  const pauseAutoFollow = useCallback(() => {
    autoFollowPausedRef.current = true;
    setIsPinnedToBottom(false);
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const node = scrollerRef.current;
    autoFollowPausedRef.current = false;
    lastAutoScrollAtRef.current = window.performance.now();
    if (node) {
      node.scrollTo({ top: node.scrollHeight, behavior });
    } else {
      bottomSentinelRef.current?.scrollIntoView({ block: "end", behavior });
    }
    setIsPinnedToBottom(true);
    setUnseenUpdates(0);
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const node = document.getElementById(messageDomId(messageId));
    if (!node) return;

    autoFollowPausedRef.current = true;
    setIsPinnedToBottom(false);
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusedMessageId(messageId);
    if (focusTimerRef.current) {
      window.clearTimeout(focusTimerRef.current);
    }
    focusTimerRef.current = window.setTimeout(() => {
      setFocusedMessageId((current) => (current === messageId ? null : current));
      focusTimerRef.current = null;
    }, 1800);
  }, []);

  const handleMessageScroll = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const previousTop = lastScrollTopRef.current;
    const currentTop = node.scrollTop;
    const isMovingUp = currentTop < previousTop - 2;
    lastScrollTopRef.current = currentTop;
    if (isMovingUp) {
      autoFollowPausedRef.current = true;
    }
    const nearBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight <= AUTO_FOLLOW_THRESHOLD;
    if (nearBottom) {
      autoFollowPausedRef.current = false;
      setIsPinnedToBottom(true);
      setUnseenUpdates(0);
      return;
    }
    const autoScrollSettling =
      window.performance.now() - lastAutoScrollAtRef.current < AUTO_SCROLL_SETTLE_MS;
    if (autoFollowPausedRef.current || !autoScrollSettling) {
      setIsPinnedToBottom(false);
    }
  }, []);

  const handleMessageWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY < -2) {
      pauseAutoFollow();
    }
  }, [pauseAutoFollow]);

  const handleMessageTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleMessageTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current;
    const currentY = event.touches[0]?.clientY;
    if (startY == null || currentY == null) return;
    if (currentY - startY > 6) {
      pauseAutoFollow();
    }
  }, [pauseAutoFollow]);

  const handleMessageKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp" || event.key === "PageUp" || event.key === "Home") {
      pauseAutoFollow();
    }
  }, [pauseAutoFollow]);

  const handleStreamPayload = useEffectEvent((rawData: string) => {
    const payload = JSON.parse(rawData) as {
      type: "session_status" | "message" | "event";
      payload: Record<string, unknown>;
    };
    if (payload.type === "session_status") {
      setStatus((current) => String(payload.payload.status ?? current));
      return;
    }
    if (payload.type === "message") {
      setMessages((current) => {
        if (current.some((item) => item.id === payload.payload.id)) return current;
        return [
          ...current,
          payload.payload as RuntimeInteractionConsoleProps["initialMessages"][number],
        ];
      });
      return;
    }
    setEvents((current) => {
      if (current.some((item) => item.id === payload.payload.id)) return current;
      return [
        ...current,
        payload.payload as RuntimeInteractionConsoleProps["initialEvents"][number],
      ];
    });
  });

  useEffect(() => {
    const eventSource = new EventSource(`/api/runtime-sessions/${props.sessionId}/stream`);
    eventSource.onmessage = (message) => handleStreamPayload(message.data);
    return () => eventSource.close();
  }, [props.sessionId]);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) {
        window.clearTimeout(focusTimerRef.current);
      }
    };
  }, []);

  const orderedMessages = useMemo(
    () => [...messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [messages],
  );
  const orderedEvents = useMemo(
    () => [...events].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [events],
  );
  const deferredEvents = useDeferredValue(orderedEvents);
  const participants = useMemo(
    () => buildParticipants(props.participants, orderedMessages),
    [orderedMessages, props.participants],
  );
  const participantByName = useMemo(
    () => {
      const registry = new Map<string, ParticipantCard>();
      for (const participant of participants) {
        registry.set(participant.name, participant);
        if (participant.displayName?.trim()) registry.set(participant.displayName, participant);
      }
      return registry;
    },
    [participants],
  );
  const participantById = useMemo(
    () => new Map(participants.map((participant) => [participant.id, participant])),
    [participants],
  );
  const actorActivities = useMemo(
    () => buildActorActivities(orderedEvents, participants, orderedMessages, status),
    [orderedEvents, orderedMessages, participants, status],
  );
  const queuedInstructions = useMemo(
    () => buildQueuedInstructions(orderedEvents),
    [orderedEvents],
  );
  const activityTargets = useMemo(() => {
    const registry = new Map<string, ActivityMessageTarget>();
    const setTarget = (key: string | null | undefined, target: ActivityMessageTarget) => {
      const normalized = key?.trim();
      if (!normalized) return;
      registry.set(normalized, target);
    };

    for (const message of orderedMessages) {
      if (isAssistantToolHandshake(message)) continue;

      const target = {
        messageId: message.id,
        createdAt: message.createdAt,
        actorName: message.actorName,
        role: message.role,
      } satisfies ActivityMessageTarget;
      const directParticipant =
        participantByName.get(message.actorName) ??
        (message.actorId ? participantById.get(message.actorId) : undefined);

      setTarget(message.actorName, target);
      setTarget(directParticipant?.name, target);
      setTarget(directParticipant?.displayName, target);

      if (message.role === "toolResult" && message.actorId) {
        const owner = participantById.get(message.actorId);
        setTarget(owner?.name, target);
        setTarget(owner?.displayName, target);
      }
    }

    return registry;
  }, [orderedMessages, participantById, participantByName]);
  const agentMentionOptions = useMemo(
    () => participants.filter((participant) => participant.kind === "agent"),
    [participants],
  );
  const rosterAgents = agentMentionOptions;
  const isTeamSession = props.sessionMode === "agent_team";
  const leaderParticipant = useMemo(
    () => rosterAgents.find((participant) => participant.isLeader) ?? rosterAgents[0] ?? null,
    [rosterAgents],
  );
  const mainAreaMessages = useMemo(() => {
    if (!isTeamSession || !leaderParticipant) return orderedMessages;
    return orderedMessages.filter((message) => {
      if (message.role === "user") return true;
      if (message.role === "toolResult") return message.actorId === leaderParticipant.id;
      return participantOwnsMessage(leaderParticipant, message);
    });
  }, [isTeamSession, leaderParticipant, orderedMessages]);
  const toolResultsByBucket = useMemo(() => {
    const registry = new Map<string, RuntimeMessage[]>();
    for (const message of orderedMessages) {
      if (message.role !== "toolResult") continue;
      const key = toolResultBucketKey(message);
      const current = registry.get(key) ?? [];
      current.push(message);
      registry.set(key, current);
    }
    return registry;
  }, [orderedMessages]);
  const subareaSummaries = useMemo(() => {
    const registry = new Map<string, SubareaSummary>();
    const ensure = (id: string, seed: Partial<SubareaSummary>) => {
      const existing = registry.get(id);
      if (existing) return existing;
      const targetName = seed.targetActorName ?? "";
      const participant =
        seed.participant ??
        rosterAgents.find(
          (item) =>
            item.name === targetName ||
            item.displayName === targetName ||
            (seed.messages?.[0] ? participantOwnsMessage(item, seed.messages[0]) : false),
        ) ??
        null;
      const next = {
        id,
        title: seed.title || text("ui.runtimeConsole.subarea.defaultTitle", undefined, { target: targetName || "Agent" }),
        kind: seed.kind || "derived",
        sourceActorName: seed.sourceActorName || leaderParticipant?.name || "Leader",
        targetActorName: targetName || participant?.name || "",
        participant,
        active: false,
        messageCount: 0,
        toolCount: 0,
        latestAt: "",
        preview: "",
        contextText: seed.contextText || "",
        messages: [],
      } satisfies SubareaSummary;
      registry.set(id, next);
      return next;
    };

    for (const event of orderedEvents) {
      const id = getSubConversationIdFromEvent(event);
      if (!id) continue;
      const meta = subConversationMetaFromRecord(event.payload);
      ensure(id, {
        title: meta.title,
        kind: meta.kind,
        sourceActorName: meta.sourceActorName || event.actorName || "",
        targetActorName: meta.targetActorName || event.actorName || "",
        contextText: meta.contextText,
      });
    }

    for (const message of orderedMessages) {
      let id = getSubConversationIdFromContent(message.content);
      let meta = subConversationMetaFromRecord(message.content);
      if (!id && isTeamSession && leaderParticipant && message.role !== "user") {
        const owner =
          rosterAgents.find((participant) => participantOwnsMessage(participant, message)) ?? null;
        if (owner && !owner.isLeader && !participantOwnsMessage(leaderParticipant, message)) {
          id = `legacy:${message.turnIndex}:${owner.id}`;
          meta = {
            parentId: `${props.sessionId}:${message.turnIndex}:main`,
            kind: "legacy_delegation",
            title: text("ui.runtimeConsole.subarea.legacyTitle", undefined, { agent: participantDisplayName(owner) }),
            sourceActorName: participantDisplayName(leaderParticipant),
            targetActorName: participantDisplayName(owner),
            contextText: "",
          };
        }
      }
      if (!id) continue;
      const conversation = ensure(id, {
        title: meta.title,
        kind: meta.kind,
        sourceActorName: meta.sourceActorName,
        targetActorName: meta.targetActorName || message.actorName,
        contextText: meta.contextText,
        messages: [message],
      });
      conversation.messages.push(message);
      conversation.latestAt = message.createdAt;
      if (message.role === "toolResult") {
        conversation.toolCount += 1;
      } else if (!isAssistantToolHandshake(message)) {
        conversation.messageCount += 1;
        const textValue = messageText(message.content).trim();
        if (textValue) conversation.preview = redactSecrets(textValue).slice(0, 72);
      }
      if (!conversation.participant) {
        conversation.participant =
          rosterAgents.find((participant) => participantOwnsMessage(participant, message)) ?? null;
      }
    }

    for (const summary of registry.values()) {
      const activity = summary.participant
        ? actorActivities.find((item) => item.name === summary.participant?.name)
        : actorActivities.find((item) => item.name === summary.targetActorName);
      summary.active = Boolean(activity?.active);
      summary.latestAt ||= activity?.updatedAt ?? "";
      summary.preview ||= formatActivitySummary(activity?.summary ?? "ui.runtimeConsole.state.waitingInput", text);
    }

    return [...registry.values()]
      .filter((summary) => summary.messageCount > 0 || summary.toolCount > 0 || summary.active)
      .sort((left, right) => (left.latestAt || "").localeCompare(right.latestAt || ""));
  }, [actorActivities, isTeamSession, leaderParticipant, orderedEvents, orderedMessages, props.sessionId, rosterAgents, text]);
  const mainSubareaEntries = useMemo(
    () => subareaSummaries,
    [subareaSummaries],
  );
  const selectedSubarea = useMemo(() => {
    if (conversationArea.kind !== "derived") return null;
    return subareaSummaries.find((summary) => summary.id === conversationArea.id) ?? null;
  }, [conversationArea, subareaSummaries]);
  const selectedSubareaMessages = selectedSubarea?.messages ?? [];
  const visibleMentionOptions = useMemo(() => {
    if (!mentionLookup || props.sessionMode !== "agent_team") return [];
    const query = mentionLookup.query.trim().toLowerCase();
    return agentMentionOptions
      .filter((participant) => {
        const handle = mentionHandleForParticipant(participant).toLowerCase();
        const searchable = [
          handle,
          participant.name,
          participant.displayName ?? "",
          participant.role,
        ]
          .join(" ")
          .toLowerCase();
        return !query || searchable.includes(query);
      })
      .slice(0, 8);
  }, [agentMentionOptions, mentionLookup, props.sessionMode]);
  const visibleEvents = useMemo(() => [...deferredEvents].slice(-36).reverse(), [deferredEvents]);
  const activeActors = actorActivities.filter((activity) => activity.active && activity.kind !== "human");
  const selectedDeliveryMode =
    teamDeliveryModes.find((mode) => mode.key === deliveryMode) ?? teamDeliveryModes[0];
  const canSendMessage = draft.trim().length > 0 && !isSending;

  const updateMentionLookup = useCallback((value: string, cursor: number) => {
    if (props.sessionMode !== "agent_team") {
      setMentionLookup(null);
      return;
    }
    setMentionLookup(findMentionLookup(value, cursor));
  }, [props.sessionMode]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollToLatest("auto"));
    return () => cancelAnimationFrame(frame);
  }, [scrollToLatest]);

  useEffect(() => {
    if (isPinnedToBottom && !autoFollowPausedRef.current) {
      const frame = requestAnimationFrame(() => scrollToLatest("smooth"));
      return () => cancelAnimationFrame(frame);
    }
    setUnseenUpdates((current) => current + 1);
    return undefined;
  }, [activeActors.length, events.length, isPinnedToBottom, messages.length, scrollToLatest]);

  async function submitMessage() {
    const message = draft.trim();
    if (!message || isSending) return;
    setMentionLookup(null);
    setIsSending(true);
    setSendError(null);
    try {
      const response = await fetch(`/api/runtime-sessions/${props.sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: message,
          deliveryMode: isTeamSession ? deliveryMode : "queue",
        }),
      });
      if (!response.ok) {
        throw new Error(text("ui.common.sendFailedWithStatus", undefined, { status: response.status }));
      }
      setDraft("");
      if (deliveryMode === "interrupt") {
        setDeliveryMode("queue");
      }
      requestAnimationFrame(() => {
        draftRef.current?.focus();
        scrollToLatest("smooth");
      });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "ui.runtimeConsole.errors.sendFailed");
    } finally {
      setIsSending(false);
    }
  }

  function insertMention(participant: ParticipantCard) {
    const lookup = mentionLookup;
    if (!lookup) return;
    const handle = mentionHandleForParticipant(participant);
    const nextDraft = `${draft.slice(0, lookup.start)}${handle} ${draft.slice(lookup.end)}`;
    const nextCursor = lookup.start + handle.length + 1;
    setDraft(nextDraft);
    setMentionLookup(null);
    requestAnimationFrame(() => {
      const textarea = draftRef.current;
      textarea?.focus();
      textarea?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        eyebrow={text("console.interactions.columns.session")}
        title={text("ui.runtimeConsole.header.title")}
        description={text("ui.runtimeConsole.header.description")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status === "running" ? "accent" : status === "error" ? "danger" : "neutral"}>
              {text(`labels.status.${status}`, status)}
            </Badge>
            <Badge variant="neutral">
              {text(`labels.sessionMode.${props.sessionMode}`, props.sessionMode)}
            </Badge>
            {activeActors.length > 1
              ? <Badge variant="accent">{activeActors.length} {text("ui.runtimeConsole.roster.parallelSuffix")}</Badge>
              : null}
          </div>
        }
      />
      <div className="border-b border-[var(--line)] bg-[var(--surface-muted)]/65 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {props.compactFacts.map((fact) => (
            <div
              key={`${fact.label}:${fact.value}`}
              className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--ink-muted)]"
            >
              <span className="font-medium text-[var(--ink)]">{text(fact.label)}</span>
              <span className="ml-1">{text(fact.value)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          <button
            type="button"
            className={cn(
              "min-w-[196px] rounded-lg border px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30",
              selectedContext.kind === "team"
                ? "border-[var(--accent)] bg-white shadow-sm"
                : "border-[var(--line)] bg-white/80",
            )}
            onClick={() => {
              setSelectedContext({ kind: "team", id: props.teamContext?.id ?? props.sessionId });
              setInspectorTab("summary");
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-[var(--accent)]">
                <UsersRound className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold text-[var(--ink)]">
                    {props.teamContext?.name ?? text("ui.runtimeConsole.common.team")}
                  </div>
                  <Badge variant="accent">Team</Badge>
                </div>
                <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">
                  {text("ui.runtimeConsole.roster.teamMeta", undefined, { count: rosterAgents.length })}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full bg-[#cbd5e1]",
                      activeActors.length > 0 && "agent-presence-dot bg-[var(--accent)]",
                    )}
                  />
                  <span className="truncate text-xs font-medium text-[var(--ink-muted)]">
                    {activeActors.length > 0
                      ? text("ui.runtimeConsole.roster.activeMembers", undefined, { count: activeActors.length })
                      : text("ui.runtimeConsole.roster.teamIdle")}
                  </span>
                </div>
              </div>
            </div>
          </button>

          {rosterAgents.map((participant) => {
            const activity = actorActivities.find((item) => item.name === participant.name);
            const tone = toneForName(participant.name);
            const isActive = Boolean(activity?.active);
            return (
              <button
                key={participant.id}
                type="button"
                className={cn(
                  "min-w-[190px] rounded-lg border px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30",
                  tone.shell,
                  isActive && "bg-[var(--surface)]",
                  selectedContext.kind === "agent" && selectedContext.id === participant.id
                    ? "border-[var(--accent)] bg-white shadow-sm"
                    : "border-[var(--line)]",
                )}
                onClick={() => {
                  setSelectedContext({ kind: "agent", id: participant.id });
                  setInspectorTab("summary");
                }}
              >
                <div className="flex items-start gap-3">
                  <ParticipantAvatar participant={participant} active={isActive} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-[var(--ink)]">{participantDisplayName(participant)}</div>
                      {participant.isLeader ? <Badge variant="accent">{text("ui.runtimeConsole.role.leader")}</Badge> : null}
                    </div>
                    <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">
                      {participant.kind === "agent" && participant.name !== participantDisplayName(participant)
                        ? `${participant.name} · ${text(participant.role)}`
                        : text(participant.role)}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full bg-[#cbd5e1]",
                          isActive && "agent-presence-dot bg-[var(--accent)]",
                        )}
                      />
                      <span className="truncate text-xs font-medium text-[var(--ink-muted)]">
                        {text(labelForPhase(activity?.phase ?? "idle"))}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">
                      {formatActivitySummary(activity?.summary ?? "ui.runtimeConsole.activity.waitingCollaboration", text)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <PanelBody className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 self-start">
          <div className={cn("grid gap-3", isTeamSession && "lg:grid-cols-[190px_minmax(0,1fr)]")}>
            {isTeamSession ? (
              <aside className="rounded-lg border border-[var(--line)] bg-white p-3 lg:sticky lg:top-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--ink)]">
                  <MessagesSquare className="h-4 w-4 text-[var(--accent)]" />
                  {text("ui.runtimeConsole.subarea.treeTitle")}
                </div>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35",
                    conversationArea.kind === "main"
                      ? "border-[var(--accent)]/35 bg-[var(--accent)]/10 text-[var(--ink)]"
                      : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink-muted)] hover:bg-white",
                  )}
                  onClick={() => {
                    setConversationArea({ kind: "main" });
                    setSelectedContext({ kind: "team", id: props.teamContext?.id ?? props.sessionId });
                  }}
                >
                  <UsersRound className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{text("ui.runtimeConsole.subarea.mainArea")}</span>
                  <Badge variant="neutral">{mainAreaMessages.filter((message) => message.role !== "toolResult").length}</Badge>
                </button>
                <div className="relative mt-2 space-y-1.5 pl-4">
                  <div className="absolute left-[0.45rem] top-0 bottom-3 w-px bg-[var(--line-strong)]" aria-hidden="true" />
                  {subareaSummaries.map((summary) => {
                    const participant =
                      summary.participant ??
                      ({
                        id: summary.id,
                        name: summary.targetActorName || summary.title,
                        role: summary.kind,
                        kind: "agent",
                      } satisfies ParticipantCard);
                    const isSelected = conversationArea.kind === "derived" && conversationArea.id === summary.id;
                    return (
                      <button
                        key={summary.id}
                        type="button"
                        className={cn(
                          "relative flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35",
                          isSelected
                            ? "border-[var(--accent)]/35 bg-[var(--accent)]/10"
                            : "border-transparent bg-transparent hover:border-[var(--line)] hover:bg-[var(--surface-muted)]",
                        )}
                        onClick={() => {
                          setConversationArea({ kind: "derived", id: summary.id });
                          if (summary.participant) {
                            setSelectedContext({ kind: "agent", id: summary.participant.id });
                          }
                        }}
                      >
                        <span className="absolute -left-[0.72rem] top-1/2 h-px w-3 bg-[var(--line-strong)]" aria-hidden="true" />
                        <ParticipantAvatar participant={participant} active={summary.active} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-semibold text-[var(--ink)]">
                              {subareaTitle(summary)}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-muted)]">
                            {summary.sourceActorName} {"->"} {summary.targetActorName || participantDisplayName(participant)}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-muted)]">
                            {text("ui.runtimeConsole.subarea.stats", undefined, {
                              messages: summary.messageCount,
                              tools: summary.toolCount,
                            })}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </aside>
            ) : null}

            <div className="min-w-0 space-y-4">
              <div className="relative">
          <div
            ref={scrollerRef}
            aria-label={text("ui.runtimeConsole.messages.ariaLabel")}
            className="relative min-h-[520px] max-h-[calc(100vh-25rem)] scroll-smooth overflow-auto overscroll-contain rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/55 px-4 py-4"
            onScroll={handleMessageScroll}
            onWheel={handleMessageWheel}
            onTouchStart={handleMessageTouchStart}
            onTouchMove={handleMessageTouchMove}
            onKeyDown={handleMessageKeyDown}
            tabIndex={0}
          >
            <div
              className={cn(
                "space-y-5 transition duration-200",
                selectedSubarea && "pointer-events-none blur-[1.5px] opacity-55",
              )}
            >
              {!isPinnedToBottom ? (
                <div className="sticky top-0 z-10 flex justify-center">
                  <div className="rounded-full border border-[var(--line)] bg-white/95 px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] shadow-sm backdrop-blur">
                    {text("ui.runtimeConsole.messages.historyPaused")}
                  </div>
                </div>
              ) : null}

              {mainAreaMessages.map((message) => {
                if (isAssistantToolHandshake(message)) return null;
                if (message.role === "toolResult") return null;

                const participant =
                  participantByName.get(message.actorName) ??
                  ({
                    id: message.id,
                    name: message.actorName,
                    role: message.role,
                    kind: actorKindFromMessage(message),
                  } satisfies ParticipantCard);
                const isFocused = focusedMessageId === message.id;
                const assistantToolResults = message.role === "assistant"
                  ? toolResultsByBucket.get(toolResultBucketKey(message)) ?? []
                  : [];

                return (
                  <RuntimeMessageBubble
                    key={message.id}
                    message={message}
                    participant={participant}
                    isFocused={isFocused}
                    toolResults={assistantToolResults}
                  />
                );
              })}

              {mainSubareaEntries.length > 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--line-strong)] bg-white/80 px-3 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-[var(--ink)]">{text("ui.runtimeConsole.subarea.derivedAreas")}</div>
                    <Badge variant="neutral">{text("ui.runtimeConsole.common.count", undefined, { count: mainSubareaEntries.length })}</Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {mainSubareaEntries.map((summary) => {
                      const participant =
                        summary.participant ??
                        ({
                          id: summary.id,
                          name: summary.targetActorName || summary.title,
                          role: summary.kind,
                          kind: "agent",
                        } satisfies ParticipantCard);
                      return (
                        <button
                          key={summary.id}
                          type="button"
                          className="flex min-w-0 items-start gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-2 text-left transition hover:border-[var(--accent)]/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35"
                          onClick={() => {
                            setConversationArea({ kind: "derived", id: summary.id });
                            if (summary.participant) {
                              setSelectedContext({ kind: "agent", id: summary.participant.id });
                            }
                          }}
                        >
                          <ParticipantAvatar participant={participant} active={summary.active} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-[var(--ink)]">
                                {subareaTitle(summary)}
                              </span>
                              {summary.active ? <Badge variant="accent">{text("ui.runtimeConsole.status.running")}</Badge> : null}
                            </span>
                            <span className="mt-1 block truncate text-xs text-[var(--ink-muted)]">
                              {summary.sourceActorName} {"->"} {summary.targetActorName || participantDisplayName(participant)}
                            </span>
                            <span className="mt-1 block truncate text-xs text-[var(--ink-muted)]">
                              {text("ui.runtimeConsole.subarea.statsLong", undefined, {
                                messages: summary.messageCount,
                                tools: summary.toolCount,
                              })}
                            </span>
                            <span className="mt-1 block max-h-10 overflow-hidden text-xs leading-5 text-[var(--ink-muted)]">
                              {summary.preview}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {mainAreaMessages.filter((message) => !isAssistantToolHandshake(message) && message.role !== "toolResult").length === 0 ? (
                <div className="flex min-h-[340px] items-center justify-center px-4 text-center">
                  <div>
                    <div className="text-sm font-semibold text-[var(--ink)]">{text("ui.runtimeConsole.messages.emptyTitle")}</div>
                    <div className="mt-2 max-w-[28rem] text-sm leading-6 text-[var(--ink-muted)]">
                      {text("ui.runtimeConsole.messages.emptyDescription")}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeActors.length > 0 ? (
                <div className="space-y-3">
                  {activeActors.map((actor) => {
                    const participant =
                      participantByName.get(actor.name) ??
                      ({
                        id: actor.name,
                        name: actor.name,
                        role: labelForPhase(actor.phase),
                        kind: actor.kind,
                      } satisfies ParticipantCard);

                    return (
                      <div key={`${actor.name}:${actor.phase}`} className="flex items-center gap-3">
                        <ParticipantAvatar participant={participant} active />
                        <div className="max-w-[min(100%,420px)] rounded-[22px] border border-[var(--line)] bg-white px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                            <span>{participantDisplayName(participant)}</span>
                            {participantRoleLabel(participant) ? (
                              <Badge variant={participant.isLeader ? "accent" : "neutral"}>
                                {text(participantRoleLabel(participant))}
                              </Badge>
                            ) : null}
                            {participant.isLeader ? <Badge variant="accent">Leader</Badge> : null}
                            <Badge variant={badgeVariantForPhase(actor.phase)}>{text(labelForPhase(actor.phase))}</Badge>
                          </div>
                          <TypingIndicator className="mt-3" label={actor.summary} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <div ref={bottomSentinelRef} aria-hidden="true" className="h-1" />
            </div>

            {!isPinnedToBottom ? (
              <button
                type="button"
                className="sticky bottom-3 left-full z-10 ml-auto flex w-fit items-center gap-2 rounded-full border border-[rgba(15,23,42,0.14)] bg-[linear-gradient(180deg,#232936_0%,#141922_100%)] px-3 py-2 text-xs font-medium text-white shadow-[0_14px_28px_rgba(15,17,21,0.16),0_0_0_1px_rgba(255,255,255,0.07)_inset] transition-[background,border-color,box-shadow] hover:border-[rgba(9,199,232,0.28)] hover:bg-[linear-gradient(180deg,#2a3140_0%,#181d27_100%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35"
                onClick={() => scrollToLatest("smooth")}
              >
                <ArrowDown className="h-4 w-4" />
                {unseenUpdates > 0 ? <>{unseenUpdates} {text("ui.common.newUpdates")}</> : text("ui.runtimeConsole.messages.scrollToBottom")}
              </button>
            ) : null}
          </div>
          {selectedSubarea ? (
            <div
              className="absolute inset-0 z-20 flex cursor-zoom-out items-stretch justify-center p-3 sm:p-5"
              data-subarea-overlay="true"
              onClick={() => {
                setConversationArea({ kind: "main" });
                setSelectedContext({ kind: "team", id: props.teamContext?.id ?? props.sessionId });
              }}
            >
              <div className="absolute inset-0 bg-white/55 backdrop-blur-[2px]" aria-hidden="true" />
              <div
                className="relative z-10 flex h-full w-full max-w-3xl cursor-auto flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.22)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-muted)]/70 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ParticipantAvatar
                      participant={
                        selectedSubarea.participant ??
                        ({
                          id: selectedSubarea.id,
                          name: selectedSubarea.targetActorName || selectedSubarea.title,
                          role: selectedSubarea.kind,
                          kind: "agent",
                        } satisfies ParticipantCard)
                      }
                      active={false}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold text-[var(--ink)]">
                          {subareaTitle(selectedSubarea)}
                        </div>
                        <Badge variant="neutral">{selectedSubarea.kind}</Badge>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                        {text("ui.runtimeConsole.subarea.visibleContextMeta", undefined, {
                          source: selectedSubarea.sourceActorName,
                          target: selectedSubarea.targetActorName,
                        })}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setConversationArea({ kind: "main" });
                      setSelectedContext({ kind: "team", id: props.teamContext?.id ?? props.sessionId });
                    }}
                  >
                    {text("ui.runtimeConsole.subarea.backToMain")}
                  </Button>
                </div>
                <div className="flex-1 overflow-auto px-4 py-4">
                  <div className="space-y-5">
                    {selectedSubareaMessages.map((message) => {
                      if (isAssistantToolHandshake(message)) return null;
                      if (message.role === "toolResult") return null;

                      const participant =
                        participantByName.get(message.actorName) ??
                        selectedSubarea.participant ??
                        ({
                          id: message.id,
                          name: message.actorName,
                          role: message.role,
                          kind: actorKindFromMessage(message),
                        } satisfies ParticipantCard);
                      const assistantToolResults = message.role === "assistant"
                        ? toolResultsByBucket.get(toolResultBucketKey(message)) ?? []
                        : [];

                      return (
                        <RuntimeMessageBubble
                          key={message.id}
                          message={message}
                          participant={participant}
                          isFocused={focusedMessageId === message.id}
                          toolResults={assistantToolResults}
                        />
                      );
                    })}
                    {selectedSubareaMessages.filter((message) => !isAssistantToolHandshake(message) && message.role !== "toolResult").length === 0 ? (
                      <div className="flex min-h-[260px] items-center justify-center px-4 text-center">
                        <div>
                          <div className="text-sm font-semibold text-[var(--ink)]">{text("ui.runtimeConsole.subarea.emptyTitle")}</div>
                          <div className="mt-2 max-w-[26rem] text-sm leading-6 text-[var(--ink-muted)]">
                            {text("ui.runtimeConsole.subarea.emptyDescription")}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
              </div>

          <form
            className="relative rounded-lg border border-[var(--line)] bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitMessage();
            }}
          >
            {isTeamSession ? (
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {teamDeliveryModes.map((mode) => {
                  const Icon = mode.Icon;
                  const isActive = deliveryMode === mode.key;
                  const isInterrupt = mode.key === "interrupt";
                  return (
                    <button
                      key={mode.key}
                      type="button"
                      title={text(mode.descriptionKey)}
                      aria-pressed={isActive}
                      className={cn(
                        "flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35",
                        isActive
                          ? "border-[var(--accent)]/35 bg-[var(--accent)]/10 text-[var(--ink)] shadow-[0_0_0_1px_rgba(255,255,255,0.72)_inset]"
                          : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink-muted)] hover:border-[var(--accent)]/25 hover:bg-white",
                        isInterrupt && isActive
                          ? "border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[var(--danger)]"
                          : "",
                      )}
                      onClick={() => setDeliveryMode(mode.key)}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{text(mode.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {mentionLookup && visibleMentionOptions.length > 0 ? (
              <div className="absolute bottom-[calc(100%+0.5rem)] left-3 right-20 z-20 overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
                <div className="max-h-72 overflow-auto p-1">
                  {visibleMentionOptions.map((participant, index) => {
                    const isActive = index === mentionLookup.activeIndex % visibleMentionOptions.length;
                    const handle = mentionHandleForParticipant(participant);
                    return (
                      <button
                        key={participant.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition",
                          isActive ? "bg-[var(--surface-muted)]" : "hover:bg-[var(--surface-muted)]/70",
                        )}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          insertMention(participant);
                        }}
                      >
                        <ParticipantAvatar participant={participant} active={isActive} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-[var(--ink)]">
                              {participantDisplayName(participant)}
                            </span>
                            {participant.isLeader ? <Badge variant="accent">{text("ui.runtimeConsole.role.leader")}</Badge> : null}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                            {text(participant.role)}
                          </div>
                        </div>
                        <Badge variant="neutral">{handle}</Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {queuedInstructions.length > 0 ? (
              <div className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/70 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-[var(--ink)]">{text("ui.runtimeConsole.queue.title")}</div>
                  <Badge variant="neutral">{text("ui.runtimeConsole.queue.count", undefined, { count: queuedInstructions.length })}</Badge>
                </div>
                <div className="mt-2 space-y-1.5">
                  {queuedInstructions.slice(0, 3).map((item, index) => (
                    <div key={item.id} className="flex items-start gap-2 rounded-md bg-white px-2 py-1.5">
                      <Badge variant={index === 0 ? "accent" : "neutral"}>{index + 1}</Badge>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px] text-[var(--ink-muted)]">
                          <span className="truncate font-medium text-[var(--ink)]">{item.actorName}</span>
                          <span>{text(teamDeliveryModes.find((mode) => mode.key === item.deliveryMode)?.labelKey ?? item.deliveryMode)}</span>
                          <span>{formatDateTime(item.createdAt)}</span>
                        </div>
                        <div className="mt-0.5 max-h-10 overflow-hidden whitespace-pre-wrap text-xs leading-5 text-[var(--ink-muted)]">
                          {redactSecrets(item.text)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {queuedInstructions.length > 3 ? (
                    <div className="px-2 text-xs text-[var(--ink-muted)]">
                      {text("ui.runtimeConsole.queue.moreWaiting", undefined, { count: queuedInstructions.length - 3 })}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="flex items-end gap-3">
              <Textarea
                ref={draftRef}
                value={draft}
                onChange={(event) => {
                  const nextDraft = event.target.value;
                  setDraft(nextDraft);
                  updateMentionLookup(nextDraft, event.target.selectionStart);
                  if (sendError) setSendError(null);
                }}
                onInput={(event) => {
                  const nextDraft = event.currentTarget.value;
                  setDraft(nextDraft);
                  updateMentionLookup(nextDraft, event.currentTarget.selectionStart);
                  if (sendError) setSendError(null);
                }}
                onSelect={(event) => updateMentionLookup(event.currentTarget.value, event.currentTarget.selectionStart)}
                onBlur={() => setMentionLookup(null)}
                placeholder="ui.runtimeConsole.composer.placeholder"
                className="max-h-36 min-h-[52px] resize-none border-transparent bg-[var(--surface-muted)] shadow-none focus:border-[var(--accent)]/35"
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (mentionLookup && visibleMentionOptions.length > 0) {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setMentionLookup((current) =>
                        current
                          ? {
                              ...current,
                              activeIndex: (current.activeIndex + 1) % visibleMentionOptions.length,
                            }
                          : current,
                      );
                      return;
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setMentionLookup((current) =>
                        current
                          ? {
                              ...current,
                              activeIndex:
                                (current.activeIndex - 1 + visibleMentionOptions.length) %
                                visibleMentionOptions.length,
                            }
                          : current,
                      );
                      return;
                    }
                    if (event.key === "Enter" || event.key === "Tab") {
                      event.preventDefault();
                      insertMention(
                        visibleMentionOptions[
                          mentionLookup.activeIndex % visibleMentionOptions.length
                        ],
                      );
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setMentionLookup(null);
                      return;
                    }
                  }
                  const shouldSubmit =
                    event.key === "Enter" && (!event.shiftKey || event.metaKey || event.ctrlKey);
                  if (shouldSubmit) {
                    event.preventDefault();
                    void submitMessage();
                  }
                }}
                onKeyUp={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  updateMentionLookup(event.currentTarget.value, event.currentTarget.selectionStart);
                }}
              />
              <Button type="submit" disabled={!canSendMessage} className="h-[52px] shrink-0 px-4">
                <SendHorizontal className="h-4 w-4" />
                {isSending ? text("ui.runtimeConsole.composer.sending") : text("ui.runtimeConsole.composer.send")}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-muted)]">
              <span>
                {isTeamSession
                  ? `${text(selectedDeliveryMode.labelKey)} · ${text(selectedDeliveryMode.descriptionKey)}`
                  : text("ui.runtimeConsole.composer.singleSessionHint")}
              </span>
              <span>{draft.trim().length} {text("ui.runtimeConsole.composer.characterUnit")}</span>
            </div>
            {sendError ? (
              <div className="mt-2 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-3 py-2 text-xs font-medium text-[var(--danger)]">
                {sendError}
              </div>
            ) : null}
          </form>
            </div>
          </div>
        </section>

        <aside className="min-h-0 space-y-3 self-start xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={inspectorTab === "activity" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setInspectorTab("activity")}
              >
                <Activity className="h-4 w-4" />
                {text("ui.runtimeConsole.tabs.activity")}
              </Button>
              <Button
                type="button"
                variant={inspectorTab === "events" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setInspectorTab("events")}
              >
                <MessageSquareMore className="h-4 w-4" />
                {text("ui.runtimeConsole.tabs.events")}
              </Button>
              <Button
                type="button"
                variant={inspectorTab === "summary" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setInspectorTab("summary")}
              >
                <BrainCircuit className="h-4 w-4" />
                {text("ui.runtimeConsole.context.tab")}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setInspectorCollapsed((current) => !current)}
            >
              {inspectorCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>

          {!inspectorCollapsed ? (
            <Panel className="overflow-hidden">
              <PanelBody className="max-h-[calc(100vh-13rem)] overflow-auto p-3">
                {inspectorTab === "activity" ? (
                  <div className="relative space-y-3 before:absolute before:left-[1.28rem] before:top-3 before:bottom-3 before:w-px before:bg-[var(--line-strong)] before:content-['']">
                    {actorActivities.map((actor) => {
                      const participant = participantByName.get(actor.name);
                      const target = activityTargets.get(actor.name);
                      const activityTime = actor.updatedAt || target?.createdAt || "";
                      return (
                        <div
                          key={actor.name}
                          className="relative grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3"
                        >
                          <button
                            type="button"
                            disabled={!target}
                            title={
                              target
                                ? text("ui.runtimeConsole.activity.jumpToChat")
                                : text("ui.runtimeConsole.activity.noChat")
                            }
                            className={cn(
                              "group relative z-10 flex min-h-16 flex-col items-start justify-start rounded-md border border-transparent bg-white/85 px-1.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35",
                              target
                                ? "cursor-pointer hover:border-[var(--accent)]/25 hover:bg-white"
                                : "cursor-default opacity-60",
                            )}
                            onClick={() => {
                              if (target) scrollToMessage(target.messageId);
                            }}
                          >
                            <span
                              className={cn(
                                "relative z-10 h-3 w-3 rounded-full border-2 border-white bg-[#94a3b8] shadow-sm",
                                actor.active && "agent-presence-dot bg-[var(--accent)]",
                              )}
                              aria-hidden="true"
                            />
                            <span className="relative z-10 mt-1.5 text-[10px] font-semibold leading-4 text-[var(--ink-muted)]">
                              {activityTime ? formatDateTime(activityTime) : text("ui.runtimeConsole.activity.notStarted")}
                            </span>
                          </button>

                          <div className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                {participant ? <ParticipantAvatar participant={participant} active={actor.active} /> : null}
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-[var(--ink)]">
                                    {participant ? participantDisplayName(participant) : actor.name}
                                  </div>
                                  {participant && participantRoleLabel(participant) ? (
                                    <div className="mt-0.5 truncate text-[11px] font-medium text-[var(--ink-muted)]">
                                      {text(participantRoleLabel(participant))}
                                    </div>
                                  ) : null}
                                  <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">
                                    {formatActivitySummary(actor.summary, text)}
                                  </div>
                                </div>
                              </div>
                              <Badge variant={badgeVariantForPhase(actor.phase)}>{text(labelForPhase(actor.phase))}</Badge>
                            </div>
                            {actor.active ? (
                              <TypingIndicator className="mt-3" label={text("ui.runtimeConsole.activity.statusUpdating")} />
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {inspectorTab === "events" ? (
                  <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
                    {visibleEvents.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant="neutral">{event.eventType}</Badge>
                          <div className="text-[11px] text-[var(--ink-muted)]">
                            {formatDateTime(event.createdAt)}
                          </div>
                        </div>
                        <div className="mt-2 text-xs font-medium text-[var(--ink)]">
                          {event.actorName ?? "System"}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                          {renderEventSummary(event.payload)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {inspectorTab === "summary" ? (
                  <SelectedContextPanel
                    selectedContext={selectedContext}
                    teamContext={props.teamContext}
                    participants={participants}
                    actorActivities={actorActivities}
                    messages={orderedMessages}
                    events={orderedEvents}
                    compactFacts={props.compactFacts}
                  />
                ) : null}
              </PanelBody>
            </Panel>
          ) : null}
        </aside>
      </PanelBody>
    </Panel>
  );
}
