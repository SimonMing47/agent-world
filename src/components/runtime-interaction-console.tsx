"use client";

import {
  ArrowDown,
  BrainCircuit,
  Bot,
  ChevronDown,
  ChevronUp,
  Activity,
  MessageSquareMore,
  SendHorizontal,
  UserRound,
  Wrench,
} from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { localizeNode, useLanguageText } from "@/components/language-pack-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { translateSessionMode, translateStatus } from "@/lib/presentation";
import { cn, formatDateTime, initials } from "@/lib/utils";

type RuntimeInteractionConsoleProps = {
  sessionId: string;
  sessionMode: "single_agent" | "agent_team";
  initialStatus: string;
  initialMessages: Array<{
    id: string;
    actorType: string;
    actorName: string;
    role: string;
    content: Record<string, unknown>;
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
    role: string;
    kind: "agent" | "human";
    isLeader?: boolean;
  }>;
  compactFacts: Array<{
    label: string;
    value: string;
    detail?: ReactNode;
  }>;
};

type ParticipantCard = {
  id: string;
  name: string;
  role: string;
  kind: "agent" | "human" | "tool";
  isLeader?: boolean;
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
  if (stopReason === "toolUse") return "工具调用中";
  if (stopReason === "error") {
    const errorMessage = typeof content.errorMessage === "string" ? content.errorMessage : "";
    return errorMessage ? `异常：${errorMessage}` : "异常";
  }
  if (stopReason === "length" || stopReason === "maxTokens") return "达到输出上限";
  if (stopReason === "cancelled") return "已取消";
  return `响应状态：${stopReason}`;
}

function renderEventSummary(payload: Record<string, unknown>) {
  if (typeof payload.delta === "string" && payload.delta.trim()) return redactSecrets(payload.delta);
  if (typeof payload.text === "string" && payload.text.trim()) return redactSecrets(payload.text);
  if (typeof payload.toolName === "string") return redactSecrets(payload.toolName);
  if (typeof payload.error === "string") return redactSecrets(payload.error);
  if (typeof payload.content === "string" && payload.content.trim()) return redactSecrets(payload.content);
  return redactSecrets(JSON.stringify(payload));
}

function labelForPhase(phase: ActorPhase) {
  if (phase === "thinking") return "ui.generated.c138d5364bb";
  if (phase === "replying") return "ui.generated.c40f42daae7";
  if (phase === "tool") return "ui.generated.ccda8fcb667";
  if (phase === "waiting") return "ui.generated.c8ff9347ecc";
  if (phase === "error") return "ui.generated.c5caf279339";
  return "ui.generated.c837e7a109a";
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
    registry.set(participant.name, {
      id: participant.id,
      name: participant.name,
      role: participant.role,
      kind: participant.kind,
      isLeader: participant.isLeader,
    });
  }

  for (const message of messages) {
    if (registry.has(message.actorName)) continue;
    registry.set(message.actorName, {
      id: message.id,
      name: message.actorName,
      role:
        message.actorType === "human"
          ? "ui.generated.c8d8f100fb8"
          : message.role === "toolResult"
            ? "ui.generated.cfb7edd231f"
            : "ui.generated.cb01dd40289",
      kind: actorKindFromMessage(message),
    });
  }

  return [...registry.values()];
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
      summary: "ui.generated.c32d948a2ef",
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
    const current = ensureActor(
      actorName,
      actorName === "Operator" ? "human" : "agent",
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
      current.summary = eventSummary || "ui.generated.c43fba8ce70";
    } else if (event.eventType === "thinking_end") {
      current.phase = "replying";
      current.active = true;
      current.summary = "ui.generated.c96f528a547";
    } else if (event.eventType === "agent_message_delta") {
      current.phase = "replying";
      current.active = true;
      current.summary = eventSummary || "ui.generated.c5e40fbee29";
    } else if (
      event.eventType === "tool_call_requested" ||
      event.eventType === "tool_call_started" ||
      event.eventType === "tool_call_update"
    ) {
      current.phase = "tool";
      current.active = true;
      current.summary = toolName ? `ui.common.processingPrefix ${toolName}` : "ui.generated.c847d330a47";
    } else if (event.eventType === "tool_call_finished") {
      current.phase = "thinking";
      current.active = true;
      current.summary = toolName ? `${toolName} ui.common.completed` : "ui.generated.ca7977ccccd";
    } else if (event.eventType === "human_approval_required") {
      current.phase = "waiting";
      current.active = true;
      current.summary = toolName ? `ui.common.approvalPrefix ${toolName}` : "ui.generated.c793239df50";
    } else if (event.eventType === "session_completed" || event.eventType === "agent_completed") {
      current.phase = "idle";
      current.active = false;
      current.summary = "ui.generated.c0a9ed3f757";
    } else if (event.eventType === "session_failed") {
      current.phase = "error";
      current.active = false;
      current.summary = eventSummary || "ui.generated.c9746cfc7d2";
    } else if (event.eventType === "human_message" || event.eventType === "human_steer") {
      current.phase = "idle";
      current.active = false;
      current.summary = "ui.generated.c8787872f4c";
      current.kind = "human";
    } else if (event.eventType === "leader_instruction_queued") {
      current.phase = "waiting";
      current.active = false;
      current.summary = "已排队给 Leader";
      current.kind = "human";
    }

    current.updatedAt = event.createdAt;
  }

  for (const message of orderedMessages) {
    const current = ensureActor(message.actorName, actorKindFromMessage(message));
    if (current.active) continue;
    if (message.role === "assistant") {
      current.summary = redactSecrets(messageText(message.content)).slice(0, 72) || "ui.generated.cbe6d5af7f7";
      current.updatedAt = message.createdAt;
    } else if (message.role === "toolResult") {
      current.summary = `ui.common.returnOutputPrefix ${message.actorName} ui.common.outputSuffix`;
      current.updatedAt = message.createdAt;
    } else if (message.role === "user") {
      current.summary = "ui.generated.c85c9b52bb7";
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
        current.summary = "ui.generated.c70f83dd504";
      }
    }
  }

  return [...registry.values()].sort((left, right) => {
    if (left.active !== right.active) return left.active ? -1 : 1;
    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function TypingIndicator({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const text = useLanguageText();
  const displayLabel = label.startsWith("ui.common.processingPrefix ")
    ? `${text("ui.common.processingPrefix")} ${label.slice("ui.common.processingPrefix ".length)}`
    : label.startsWith("ui.common.approvalPrefix ")
      ? `${text("ui.common.approvalPrefix")} ${label.slice("ui.common.approvalPrefix ".length)}`
      : label.endsWith(" ui.common.completed")
        ? `${label.slice(0, -" ui.common.completed".length)} ${text("ui.common.completed")}`
        : label.startsWith("ui.common.returnOutputPrefix ") && label.endsWith(" ui.common.outputSuffix")
          ? `${text("ui.common.returnOutputPrefix")} ${label
            .slice("ui.common.returnOutputPrefix ".length, -" ui.common.outputSuffix".length)} ${text("ui.common.outputSuffix")}`
          : text(label);

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
}: {
  participant: ParticipantCard;
  active: boolean;
}) {
  const tone = toneForName(participant.name);
  const label = participant.kind === "agent" ? initials(participant.name) || "AG" : null;

  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg border border-white/60",
        tone.avatar,
        tone.avatarText,
        active && tone.ring,
      )}
    >
      {participant.kind === "agent" && label ? (
        <span className="text-xs font-semibold">{label}</span>
      ) : participant.kind === "human" ? (
        <UserRound className="h-4 w-4" />
      ) : participant.kind === "tool" ? (
        <Wrench className="h-4 w-4" />
      ) : (
        <Bot className="h-4 w-4" />
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
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-xs",
        inverted ? "text-white/72" : "text-[var(--ink-muted)]",
      )}
    >
      <span className={cn("font-medium", inverted ? "text-white" : "text-[var(--ink)]")}>
        {message.actorName}
      </span>
      {participant.isLeader ? <Badge variant="accent">ui.generated.c974d383f36</Badge> : null}
      {message.role === "toolResult" ? <Badge variant="warning">ui.generated.ca72ef18d9a</Badge> : null}
      {message.role === "assistant" ? <Badge variant="neutral">Agent</Badge> : null}
      {message.role === "user" ? <Badge variant="neutral">ui.generated.c80212d3591</Badge> : null}
      <span>{formatDateTime(message.createdAt)}</span>
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
  const [inspectorTab, setInspectorTab] = useState<"activity" | "events" | "summary">("activity");
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [unseenUpdates, setUnseenUpdates] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const node = scrollerRef.current;
    if (node) {
      node.scrollTo({ top: node.scrollHeight, behavior });
    } else {
      bottomSentinelRef.current?.scrollIntoView({ block: "end", behavior });
    }
    setIsPinnedToBottom(true);
    setUnseenUpdates(0);
  }, []);

  const handleMessageScroll = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const nearBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight <= AUTO_FOLLOW_THRESHOLD;
    setIsPinnedToBottom(nearBottom);
    if (nearBottom) {
      setUnseenUpdates(0);
    }
  }, []);

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
    () => new Map(participants.map((participant) => [participant.name, participant])),
    [participants],
  );
  const actorActivities = useMemo(
    () => buildActorActivities(orderedEvents, participants, orderedMessages, status),
    [orderedEvents, orderedMessages, participants, status],
  );
  const visibleEvents = useMemo(() => [...deferredEvents].slice(-36).reverse(), [deferredEvents]);
  const activeActors = actorActivities.filter((activity) => activity.active && activity.kind !== "human");
  const canSendMessage = draft.trim().length > 0 && !isSending;

  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollToLatest("auto"));
    return () => cancelAnimationFrame(frame);
  }, [scrollToLatest]);

  useEffect(() => {
    if (isPinnedToBottom) {
      const frame = requestAnimationFrame(() => scrollToLatest("smooth"));
      return () => cancelAnimationFrame(frame);
    }
    setUnseenUpdates((current) => current + 1);
    return undefined;
  }, [activeActors.length, events.length, isPinnedToBottom, messages.length, scrollToLatest]);

  async function submitMessage() {
    const message = draft.trim();
    if (!message || isSending) return;
    setIsSending(true);
    setSendError(null);
    try {
      const response = await fetch(`/api/runtime-sessions/${props.sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: message,
          actorName: "Operator",
        }),
      });
      if (!response.ok) {
        throw new Error(text("ui.common.sendFailedWithStatus", undefined, { status: response.status }));
      }
      setDraft("");
      requestAnimationFrame(() => {
        draftRef.current?.focus();
        scrollToLatest("smooth");
      });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "ui.generated.cfc43172b72");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        eyebrow="ui.generated.c836ffe0e10"
        title="ui.generated.c282129d737"
        description="ui.generated.c4bd66b4bf7"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status === "running" ? "accent" : status === "error" ? "danger" : "neutral"}>
              {translateStatus(status)}
            </Badge>
            <Badge variant="neutral">
              {translateSessionMode(props.sessionMode)}
            </Badge>
            {activeActors.length > 1 ? <Badge variant="accent">{activeActors.length} ui.generated.c49ec72c849</Badge> : null}
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
          {participants.map((participant) => {
            const activity = actorActivities.find((item) => item.name === participant.name);
            const tone = toneForName(participant.name);
            const isActive = Boolean(activity?.active);
            return (
              <div
                key={participant.id}
                className={cn(
                  "min-w-[176px] rounded-lg border px-3 py-3",
                  tone.shell,
                  isActive && "bg-[var(--surface)]",
                )}
              >
                <div className="flex items-start gap-3">
                  <ParticipantAvatar participant={participant} active={isActive} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-[var(--ink)]">{participant.name}</div>
                      {participant.isLeader ? <Badge variant="accent">ui.generated.c974d383f36</Badge> : null}
                    </div>
                    <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">{participant.role}</div>
                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full bg-[#cbd5e1]",
                          isActive && "agent-presence-dot bg-[var(--accent)]",
                        )}
                      />
                      <span className="truncate text-xs font-medium text-[var(--ink-muted)]">
                        {labelForPhase(activity?.phase ?? "idle")}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">
                      {activity?.summary ?? "ui.generated.cf3e50f365b"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <PanelBody className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 space-y-4">
          <div
            ref={scrollerRef}
            aria-label="ui.generated.c089a724d1f"
            className="relative min-h-[520px] max-h-[calc(100vh-25rem)] scroll-smooth overflow-auto overscroll-contain rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/55 px-4 py-4"
            onScroll={handleMessageScroll}
            tabIndex={0}
          >
            <div className="space-y-5">
              {!isPinnedToBottom ? (
                <div className="sticky top-0 z-10 flex justify-center">
                  <div className="rounded-full border border-[var(--line)] bg-white/95 px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] shadow-sm backdrop-blur">
                    ui.generated.ceb16ef1a7f
                  </div>
                </div>
              ) : null}

              {orderedMessages.map((message) => {
                const participant =
                  participantByName.get(message.actorName) ??
                  ({
                    id: message.id,
                    name: message.actorName,
                    role: message.role,
                    kind: actorKindFromMessage(message),
                  } satisfies ParticipantCard);
                const isHuman = message.role === "user";
                const isTool = message.role === "toolResult";

                return (
                  <div
                    key={message.id}
                    className={cn("flex gap-3", isHuman ? "justify-end" : "justify-start")}
                  >
                    {!isHuman ? <ParticipantAvatar participant={participant} active={false} /> : null}
                    <div className={cn("max-w-[min(100%,760px)]", isHuman && "order-first")}>
                      <div
                        className={cn(
                          "rounded-[22px] border px-4 py-3",
                          isHuman
                            ? "border-transparent bg-[var(--accent)] text-white"
                            : isTool
                              ? "border-[#f3d19c] bg-[#fff7e8]"
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
                          <details className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-3">
                            <summary className="cursor-pointer text-xs font-medium text-[var(--ink-muted)]">
                              ui.generated.cf6145bc4ca
                            </summary>
                            <div className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--ink-muted)]">
                              {redactSecrets(thinkingText(message.content))}
                            </div>
                          </details>
                        ) : null}
                        {message.role === "assistant" ? (
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--ink-muted)]">
                            {typeof message.content.responseModel === "string" ? (
                              <span>ui.generated.cf21d6e8111 {message.content.responseModel}</span>
                            ) : null}
                            {renderUsage(message.content) ? <span>{renderUsage(message.content)}</span> : null}
                            {renderAssistantFinish(message.content) ? <span>{renderAssistantFinish(message.content)}</span> : null}
                          </div>
                        ) : null}
                        {message.role === "toolResult" && message.content.details ? (
                          <details className="mt-3 rounded-lg border border-[#f0d9b5] bg-white/80 p-3">
                            <summary className="cursor-pointer text-xs font-medium text-[var(--ink-muted)]">
                              ui.generated.c58c7b46168
                            </summary>
                            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs leading-5 text-[var(--ink-muted)]">
                              {redactSecrets(JSON.stringify(message.content.details, null, 2))}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    </div>
                    {isHuman ? <ParticipantAvatar participant={participant} active={false} /> : null}
                  </div>
                );
              })}

              {orderedMessages.length === 0 ? (
                <div className="flex min-h-[340px] items-center justify-center px-4 text-center">
                  <div>
                    <div className="text-sm font-semibold text-[var(--ink)]">ui.generated.ca6658b3a48</div>
                    <div className="mt-2 max-w-[28rem] text-sm leading-6 text-[var(--ink-muted)]">
                      ui.generated.c62a4e600e7
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
                          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                            {actor.name}
                            <Badge variant={badgeVariantForPhase(actor.phase)}>{labelForPhase(actor.phase)}</Badge>
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
                {unseenUpdates > 0 ? <>{unseenUpdates} ui.common.newUpdates</> : "ui.generated.c32282e734a"}
              </button>
            ) : null}
          </div>

          <form
            className="rounded-lg border border-[var(--line)] bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitMessage();
            }}
          >
            <div className="flex items-end gap-3">
              <Textarea
                ref={draftRef}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (sendError) setSendError(null);
                }}
                placeholder="ui.generated.c5da4989f38"
                className="max-h-36 min-h-[52px] resize-none border-transparent bg-[var(--surface-muted)] shadow-none focus:border-[var(--accent)]/35"
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  const shouldSubmit =
                    event.key === "Enter" && (!event.shiftKey || event.metaKey || event.ctrlKey);
                  if (shouldSubmit) {
                    event.preventDefault();
                    void submitMessage();
                  }
                }}
              />
              <Button type="submit" disabled={!canSendMessage} className="h-[52px] shrink-0 px-4">
                <SendHorizontal className="h-4 w-4" />
                {isSending ? "ui.generated.cd948e6a3fb" : "ui.generated.c1214d633a4"}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-muted)]">
              <span>ui.generated.c633f10d101</span>
              <span>{draft.trim().length} ui.generated.c582c50066c</span>
            </div>
            {sendError ? (
              <div className="mt-2 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-3 py-2 text-xs font-medium text-[var(--danger)]">
                {sendError}
              </div>
            ) : null}
          </form>
        </section>

        <aside className="space-y-3 xl:sticky xl:top-4 xl:h-fit">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={inspectorTab === "activity" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setInspectorTab("activity")}
              >
                <Activity className="h-4 w-4" />
                ui.generated.cb2548636f0
              </Button>
              <Button
                type="button"
                variant={inspectorTab === "events" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setInspectorTab("events")}
              >
                <MessageSquareMore className="h-4 w-4" />
                ui.generated.c550e328062
              </Button>
              <Button
                type="button"
                variant={inspectorTab === "summary" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setInspectorTab("summary")}
              >
                <BrainCircuit className="h-4 w-4" />
                ui.generated.c46d4c1b4e4
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
              <PanelBody className="p-3">
                {inspectorTab === "activity" ? (
                  <div className="space-y-3">
                    {actorActivities.map((actor) => (
                      <div
                        key={actor.name}
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[var(--ink)]">{actor.name}</div>
                            <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">{actor.summary}</div>
                          </div>
                          <Badge variant={badgeVariantForPhase(actor.phase)}>{labelForPhase(actor.phase)}</Badge>
                        </div>
                        {actor.active ? (
                          <TypingIndicator className="mt-3" label="ui.generated.c943db1095f" />
                        ) : null}
                      </div>
                    ))}
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
                  <div className="space-y-3">
                    {props.compactFacts.map((fact) => (
                      <div
                        key={`${fact.label}:${fact.value}`}
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-3"
                      >
                        <div className="text-xs font-medium text-[var(--ink-muted)]">
                          {text(fact.label)}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-[var(--ink)]">{text(fact.value)}</div>
                        {fact.detail ? (
                          <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{localizeNode(fact.detail, text)}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </PanelBody>
            </Panel>
          ) : null}
        </aside>
      </PanelBody>
    </Panel>
  );
}
