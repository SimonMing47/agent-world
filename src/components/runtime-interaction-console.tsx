"use client";

import {
  BrainCircuit,
  Bot,
  ChevronDown,
  ChevronUp,
  MessageSquareMore,
  UserRound,
  WandSparkles,
  Wrench,
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
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
    detail?: string;
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
    ring: "shadow-[0_0_0_3px_rgba(191,219,254,0.55)]",
  },
  {
    shell: "border-[#d5dfcb] bg-white",
    avatar: "bg-[#edf6e8]",
    avatarText: "text-[#166534]",
    ring: "shadow-[0_0_0_3px_rgba(187,247,208,0.5)]",
  },
  {
    shell: "border-[#e1d5c7] bg-white",
    avatar: "bg-[#fbefe4]",
    avatarText: "text-[#b45309]",
    ring: "shadow-[0_0_0_3px_rgba(253,230,138,0.45)]",
  },
  {
    shell: "border-[#d8d2ea] bg-white",
    avatar: "bg-[#efe8fb]",
    avatarText: "text-[#7c3aed]",
    ring: "shadow-[0_0_0_3px_rgba(221,214,254,0.5)]",
  },
];

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

function renderEventSummary(payload: Record<string, unknown>) {
  if (typeof payload.delta === "string" && payload.delta.trim()) return redactSecrets(payload.delta);
  if (typeof payload.text === "string" && payload.text.trim()) return redactSecrets(payload.text);
  if (typeof payload.toolName === "string") return redactSecrets(payload.toolName);
  if (typeof payload.error === "string") return redactSecrets(payload.error);
  if (typeof payload.content === "string" && payload.content.trim()) return redactSecrets(payload.content);
  return redactSecrets(JSON.stringify(payload));
}

function labelForPhase(phase: ActorPhase) {
  if (phase === "thinking") return "思考中";
  if (phase === "replying") return "回复中";
  if (phase === "tool") return "工具处理中";
  if (phase === "waiting") return "等待人工";
  if (phase === "error") return "异常";
  return "空闲";
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
          ? "人工介入"
          : message.role === "toolResult"
            ? "工具输出"
            : "协作成员",
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
      summary: "等待输入",
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
      event.eventType === "session_started"
    ) {
      current.phase = "thinking";
      current.active = true;
      current.summary = eventSummary || "正在组织思路";
    } else if (event.eventType === "thinking_end") {
      current.phase = "replying";
      current.active = true;
      current.summary = "准备输出回复";
    } else if (event.eventType === "agent_message_delta") {
      current.phase = "replying";
      current.active = true;
      current.summary = eventSummary || "正在生成回复";
    } else if (
      event.eventType === "tool_call_requested" ||
      event.eventType === "tool_call_started" ||
      event.eventType === "tool_call_update"
    ) {
      current.phase = "tool";
      current.active = true;
      current.summary = toolName ? `正在处理 ${toolName}` : "正在处理工具调用";
    } else if (event.eventType === "tool_call_finished") {
      current.phase = "thinking";
      current.active = true;
      current.summary = toolName ? `${toolName} 已完成` : "工具调用完成";
    } else if (event.eventType === "human_approval_required") {
      current.phase = "waiting";
      current.active = true;
      current.summary = toolName ? `等待审批 ${toolName}` : "等待人工批准";
    } else if (event.eventType === "session_completed") {
      current.phase = "idle";
      current.active = false;
      current.summary = "本轮执行完成";
    } else if (event.eventType === "session_failed") {
      current.phase = "error";
      current.active = false;
      current.summary = eventSummary || "执行失败";
    } else if (event.eventType === "human_message" || event.eventType === "human_steer") {
      current.phase = "idle";
      current.active = false;
      current.summary = "已发送人工消息";
      current.kind = "human";
    }

    current.updatedAt = event.createdAt;
  }

  for (const message of orderedMessages) {
    const current = ensureActor(message.actorName, actorKindFromMessage(message));
    if (current.active) continue;
    if (message.role === "assistant") {
      current.summary = redactSecrets(messageText(message.content)).slice(0, 72) || "已输出回复";
      current.updatedAt = message.createdAt;
    } else if (message.role === "toolResult") {
      current.summary = `返回 ${message.actorName} 输出`;
      current.updatedAt = message.createdAt;
    } else if (message.role === "user") {
      current.summary = "已发送消息";
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
        current.summary = "正在继续处理";
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
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="agent-typing-indicator" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="text-xs font-medium text-[var(--ink-muted)]">{label}</div>
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
        "flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60",
        tone.avatar,
        tone.avatarText,
        active && tone.ring,
      )}
    >
      {participant.kind === "agent" && label ? (
        <span className="text-xs font-semibold uppercase tracking-[0.08em]">{label}</span>
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
      {participant.isLeader ? <Badge variant="accent">Leader</Badge> : null}
      {message.role === "toolResult" ? <Badge variant="warning">Tool</Badge> : null}
      {message.role === "assistant" ? <Badge variant="neutral">Agent</Badge> : null}
      {message.role === "user" ? <Badge variant="neutral">Human</Badge> : null}
      <span>{formatDateTime(message.createdAt)}</span>
    </div>
  );
}

export function RuntimeInteractionConsole(props: RuntimeInteractionConsoleProps) {
  const [status, setStatus] = useState(props.initialStatus);
  const [messages, setMessages] = useState(props.initialMessages);
  const [events, setEvents] = useState(props.initialEvents);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"activity" | "events" | "summary">("activity");
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

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
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, events.length]);

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

  async function submitMessage() {
    if (!draft.trim()) return;
    setIsSending(true);
    await fetch(`/api/runtime-sessions/${props.sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: draft.trim(),
        actorName: "Operator",
      }),
    });
    setDraft("");
    setIsSending(false);
  }

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        eyebrow="Conversation"
        title="模型交互"
        description="让对话、协作和执行状态待在同一个工作台里。"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status === "running" ? "accent" : status === "error" ? "danger" : "success"}>
              {status}
            </Badge>
            <Badge variant="neutral">
              {props.sessionMode === "agent_team" ? "Agent Team" : "Single Agent"}
            </Badge>
            {activeActors.length > 1 ? <Badge variant="accent">{activeActors.length} 路并行</Badge> : null}
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
              <span className="font-medium text-[var(--ink)]">{fact.label}</span>
              <span className="ml-1">{fact.value}</span>
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
                  "min-w-[188px] rounded-2xl border px-3 py-3",
                  tone.shell,
                  isActive && "bg-[var(--surface)]",
                )}
              >
                <div className="flex items-start gap-3">
                  <ParticipantAvatar participant={participant} active={isActive} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-[var(--ink)]">{participant.name}</div>
                      {participant.isLeader ? <Badge variant="accent">Leader</Badge> : null}
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
                      {activity?.summary ?? "等待协作"}
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
            className="min-h-[520px] max-h-[calc(100vh-25rem)] overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)]/55 px-4 py-4"
          >
            <div className="space-y-5">
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
                          "rounded-[22px] border px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
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
                          <details className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
                            <summary className="cursor-pointer text-xs font-medium text-[var(--ink-muted)]">
                              思考过程
                            </summary>
                            <div className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--ink-muted)]">
                              {redactSecrets(thinkingText(message.content))}
                            </div>
                          </details>
                        ) : null}
                        {message.role === "assistant" ? (
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--ink-muted)]">
                            {typeof message.content.responseModel === "string" ? (
                              <span>responseModel: {message.content.responseModel}</span>
                            ) : null}
                            {renderUsage(message.content) ? <span>{renderUsage(message.content)}</span> : null}
                            {typeof message.content.stopReason === "string" ? (
                              <span>stop: {message.content.stopReason}</span>
                            ) : null}
                          </div>
                        ) : null}
                        {message.role === "toolResult" && message.content.details ? (
                          <details className="mt-3 rounded-2xl border border-[#f0d9b5] bg-white/80 p-3">
                            <summary className="cursor-pointer text-xs font-medium text-[var(--ink-muted)]">
                              工具细节
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
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="发送一条消息，或在运行中追加人工介入。"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitMessage();
                }
              }}
            />
            <Button type="button" onClick={submitMessage} disabled={isSending}>
              {isSending ? "发送中" : "发送"}
            </Button>
          </div>
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
                <WandSparkles className="h-4 w-4" />
                活动
              </Button>
              <Button
                type="button"
                variant={inspectorTab === "events" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setInspectorTab("events")}
              >
                <MessageSquareMore className="h-4 w-4" />
                事件
              </Button>
              <Button
                type="button"
                variant={inspectorTab === "summary" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setInspectorTab("summary")}
              >
                <BrainCircuit className="h-4 w-4" />
                摘要
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
                        className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[var(--ink)]">{actor.name}</div>
                            <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">{actor.summary}</div>
                          </div>
                          <Badge variant={badgeVariantForPhase(actor.phase)}>{labelForPhase(actor.phase)}</Badge>
                        </div>
                        {actor.active ? (
                          <TypingIndicator className="mt-3" label="正在持续更新状态" />
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
                        className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-3"
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
                        className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-3"
                      >
                        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                          {fact.label}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-[var(--ink)]">{fact.value}</div>
                        {fact.detail ? (
                          <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{fact.detail}</div>
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
