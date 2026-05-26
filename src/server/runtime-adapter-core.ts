import { Agent, type AgentEvent, type AgentMessage } from "@earendil-works/pi-agent-core";
import { completeSimple, type AssistantMessage, type Model } from "@earendil-works/pi-ai";
import { randomUUID } from "node:crypto";
import { buildAgentHarnessExecutionProfile } from "@/server/agent-harness-core";
import { type ProviderProfile, type ProviderRuntimeBinding } from "@/server/db";
import { buildReadOnlyWorkspaceTools } from "@/server/pi-agent-toolset";
import {
  buildPiModel,
  buildRuntimeDescriptor,
  resolveProviderApiKey,
} from "@/server/runtime-provider-config";
import { uiText } from "@/lib/language-pack";

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
  mentionHandle?: string;
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

type RuntimeContextCompactionPayload = {
  actorId?: string | null;
  actorName: string;
  turnIndex: number;
  reason: "preflight" | "agent-loop";
  source: "model" | "fallback";
  contextWindow: number;
  maxTokens: number;
  triggerTokens: number;
  targetTokens: number;
  originalTokenEstimate: number;
  compactedTokenEstimate: number;
  summarizedMessages: number;
  retainedMessages: number;
  summaryPreview: string;
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
    }
  | {
      type: "runtime.context.compacted";
      sessionId: string;
      occurredAt: string;
      payload: RuntimeContextCompactionPayload;
    };

export type RuntimeAgentEventCallback = (args: {
  actorId?: string | null;
  actorName: string;
  turnIndex: number;
  subConversation?: RuntimeSubConversationContext | null;
  event: AgentEvent;
}) => void;

export type RuntimeSystemEventCallback = (event: RuntimeSessionEnvelope) => void;

export type InvokeAgentNodeInput = {
  session: RuntimeSessionContext;
  agent: RuntimeAgentProfile | null;
  latestUserMessage: string;
  turnIndex: number;
  instructions?: string;
  subConversation?: RuntimeSubConversationContext | null;
  teamContext?: {
    teamName: string;
    leaderName?: string;
  } | null;
  getTranscript: () => AgentMessage[];
  onAgentEvent: RuntimeAgentEventCallback;
  onRuntimeEvent?: RuntimeSystemEventCallback;
};

export type RuntimeSubConversationContext = {
  id: string;
  parentId: string;
  kind: "direct_mention" | "leader_delegation" | "peer_handoff";
  title: string;
  sourceActorName: string;
  targetActorName: string;
  targetActorId?: string | null;
  contextText: string;
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
    targetActorId?: string | null;
    targetActorName?: string | null;
  }): Promise<boolean>;
  streamEvents(sessionId: string): AsyncIterable<RuntimeSessionEnvelope>;
  invokeAgentNode(input: InvokeAgentNodeInput): Promise<InvokeAgentNodeResult>;
  invokeTeamPlan(input: InvokeTeamPlanInput): Promise<InvokeTeamPlanResult>;
  cancel(sessionId: string): Promise<void>;
  collectArtifacts(sessionId: string): Promise<Array<Record<string, unknown>>>;
}

type SessionStreamState = {
  agents: Map<string, { agent: Agent; actorId?: string | null; actorName: string }>;
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
  const mentionHandle = args.agent?.mentionHandle ? `Mention handle: ${args.agent.mentionHandle}.` : "";
  const header = args.agent
    ? `You are ${args.agent.name}. Role: ${args.agent.role}. ${mentionHandle} Persona: ${args.agent.personaPrompt}`
    : "You are the runtime assistant.";
  const teamContext = args.teamContext
    ? `Team: ${args.teamContext.teamName}.${args.teamContext.leaderName ? ` Leader: ${args.teamContext.leaderName}.` : ""}`
    : "No agent team is attached to this session.";
  const runtimeContext = `Runtime binding: ${args.runtimeBinding.name}. Provider profile: ${args.providerProfile.name}. Actual configured model: ${args.session.model}. When asked about your current provider or model, answer from this runtime metadata instead of prior model lore.`;
  const replyRouting = "When a message contains `Question from @name:`, reply to that questioner by mentioning `@name` in the human-facing answer.";

  return [header, teamContext, runtimeContext, replyRouting, args.session.systemPrompt, args.instructions ?? ""]
    .filter(Boolean)
    .join("\n\n");
}

function slugForMention(value: string, fallback: string) {
  return (
    value
      .toLowerCase()
      .replace(/[/|]+/g, " ")
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || fallback
  );
}

function mentionHandleFor(agent: RuntimeAgentProfile, index: number) {
  if (agent.mentionHandle?.trim()) return agent.mentionHandle.trim();
  return `@${slugForMention(agent.role || agent.name, `agent-${index + 1}`)}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textMentionsHandle(text: string, handle: string) {
  return new RegExp(
    `(^|[^A-Za-z0-9_.-])${escapeRegExp(handle)}(?=\\s|$|[：:，,。.;；、!！?？)\\]】}》」』"'\\\`*_>\\n])`,
    "i",
  ).test(text);
}

function lineLooksLikeMentionHeading(line: string) {
  const normalized = line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\d+[.)、]\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^>\s+/, "")
    .replace(/^(\*\*|__|`)+/, "");
  return normalized.startsWith("@");
}

function lineIsSectionDivider(line: string) {
  return /^-{3,}$/.test(line.trim());
}

function extractMentionPacket(text: string, handle: string) {
  const normalized = text.trim();
  if (!normalized || !textMentionsHandle(normalized, handle)) return null;

  const lines = normalized.split(/\n/);
  const startIndex = lines.findIndex((line) => textMentionsHandle(line, handle));
  if (startIndex < 0) return null;

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (lineLooksLikeMentionHeading(line) && !textMentionsHandle(line, handle)) {
      endIndex = index;
      break;
    }
    if (!lineIsSectionDivider(line)) continue;
    const nextContent = lines.slice(index + 1).find((candidate) => candidate.trim());
    if (!nextContent || lineLooksLikeMentionHeading(nextContent)) {
      endIndex = index;
      break;
    }
  }

  while (endIndex > startIndex && !lines[endIndex - 1]?.trim()) {
    endIndex -= 1;
  }

  return lines
    .slice(startIndex, endIndex)
    .join("\n")
    .trim()
    .slice(0, 2400);
}

function workerDirectory(workers: RuntimeAgentProfile[]) {
  if (workers.length === 0) return "No sub agents are available.";
  return workers
    .map((worker, index) => `${mentionHandleFor(worker, index)} - ${worker.name} (${worker.role})`)
    .join("\n");
}

function collectMentionDelegations(text: string, workers: RuntimeAgentProfile[]) {
  return workers
    .map((worker, index) => {
      const handle = mentionHandleFor(worker, index);
      const packet = extractMentionPacket(text, handle);
      return packet ? { worker, handle, packet } : null;
    })
    .filter((item): item is { worker: RuntimeAgentProfile; handle: string; packet: string } => item !== null);
}

function extractQuestionerName(text: string) {
  const match = text.match(/^\s*Question from @([^:\n]+):/i);
  return match?.[1]?.trim() ? `@${match[1].trim()}` : "Human operator";
}

function buildSubConversationContext(args: {
  sessionId: string;
  turnIndex: number;
  kind: RuntimeSubConversationContext["kind"];
  sourceActorName: string;
  target: RuntimeAgentProfile;
  handle: string;
  contextText: string;
}) {
  const targetName = args.target.name;
  return {
    id: `${args.sessionId}:${args.turnIndex}:${args.kind}:${args.target.id ?? slugForMention(targetName, "agent")}:${randomUUID()}`,
    parentId: `${args.sessionId}:${args.turnIndex}:main`,
    kind: args.kind,
    title: uiText("ui.runtimeConsole.subarea.title", undefined, {
      target: targetName,
      kind: args.kind === "peer_handoff"
        ? uiText("ui.runtimeConsole.subarea.kind.peerHandoff")
        : args.kind === "direct_mention"
          ? uiText("ui.runtimeConsole.subarea.kind.directMention")
          : uiText("ui.runtimeConsole.subarea.kind.leaderDelegation"),
    }),
    sourceActorName: args.sourceActorName,
    targetActorName: targetName,
    targetActorId: args.target.id ?? null,
    contextText: [`${args.sourceActorName} -> ${args.handle}`, args.contextText].join("\n\n"),
  } satisfies RuntimeSubConversationContext;
}

const CONTEXT_COMPACTION_TRIGGER_RATIO = 0.72;
const CONTEXT_COMPACTION_TARGET_RATIO = 0.42;
const CONTEXT_COMPACTION_KEEP_RECENT_MESSAGES = 8;
const CONTEXT_COMPACTION_MAX_SUMMARY_CHARS = 10000;

type ContextCompactionBudget = {
  contextWindow: number;
  maxTokens: number;
  outputReserveTokens: number;
  usableInputTokens: number;
  triggerTokens: number;
  targetTokens: number;
};

type ContextCompactionResult = {
  messages: AgentMessage[];
  metadata?: RuntimeContextCompactionPayload;
};

function numberOrFallback(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function estimateTextTokens(text: string) {
  if (!text) return 0;
  const cjkCount = text.match(/[\u3400-\u9fff\uf900-\ufaff]/g)?.length ?? 0;
  const otherCount = Math.max(0, text.length - cjkCount);
  return Math.ceil(cjkCount * 1.1 + otherCount / 3.4);
}

function clipText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  if (maxChars <= 120) return text.slice(0, maxChars);
  const marker = `\n\n[... ${text.length - maxChars} chars compacted ...]\n\n`;
  const sideChars = Math.max(40, Math.floor((maxChars - marker.length) / 2));
  return `${text.slice(0, sideChars)}${marker}${text.slice(-sideChars)}`;
}

function clipTextToTokenBudget(text: string, maxTokens: number) {
  if (estimateTextTokens(text) <= maxTokens) return text;
  let maxChars = Math.max(800, Math.floor(maxTokens * 2.1));
  let clipped = clipText(text, maxChars);
  while (estimateTextTokens(clipped) > maxTokens && maxChars > 800) {
    maxChars = Math.floor(maxChars * 0.75);
    clipped = clipText(text, maxChars);
  }
  return clipped;
}

function maskToken(value: string) {
  if (value.length <= 8) return "[REDACTED]";
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

function redactSensitiveText(value: string) {
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

function safeStringify(value: unknown, maxChars = 2400) {
  try {
    return clipText(JSON.stringify(value, null, 2), maxChars);
  } catch {
    return clipText(String(value), maxChars);
  }
}

function contentBlocksToText(blocks: Array<Record<string, unknown>>) {
  return blocks
    .map((block) => {
      if (block.type === "text") return typeof block.text === "string" ? block.text : "";
      if (block.type === "thinking") {
        return typeof block.thinking === "string" ? `[thinking]\n${block.thinking}` : "";
      }
      if (block.type === "toolCall") {
        const name = typeof block.name === "string" ? block.name : "unknown_tool";
        const id = typeof block.id === "string" ? block.id : "";
        return [`[tool_call ${name}${id ? ` ${id}` : ""}]`, safeStringify(block.arguments ?? {})]
          .filter(Boolean)
          .join("\n");
      }
      if (block.type === "image") {
        const mimeType = typeof block.mimeType === "string" ? block.mimeType : "image";
        const dataLength = typeof block.data === "string" ? block.data.length : 0;
        return `[image ${mimeType}, ${dataLength} chars]`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function agentMessageToText(message: AgentMessage) {
  if (message.role === "user") {
    return typeof message.content === "string"
      ? message.content
      : contentBlocksToText(message.content as unknown as Array<Record<string, unknown>>);
  }

  if (message.role === "assistant") {
    return contentBlocksToText(message.content as unknown as Array<Record<string, unknown>>);
  }

  if (message.role === "toolResult") {
    return [
      `[tool_result ${message.toolName}${message.isError ? " error" : ""}]`,
      contentBlocksToText(message.content as unknown as Array<Record<string, unknown>>),
      message.details ? `[details]\n${safeStringify(message.details, 1600)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return safeStringify(message);
}

function estimateMessagesTokens(messages: AgentMessage[]) {
  return messages.reduce(
    (total, message) => total + estimateTextTokens(agentMessageToText(message)) + 16,
    0,
  );
}

function estimateToolsTokens(
  tools: Array<{ name?: string; description?: string; parameters?: unknown }>,
) {
  return tools.reduce(
    (total, tool) =>
      total +
      estimateTextTokens(
        [
          tool.name ?? "",
          tool.description ?? "",
          tool.parameters ? safeStringify(tool.parameters, 6000) : "",
        ].join("\n"),
      ) +
      12,
    0,
  );
}

function estimateContextTokens(args: {
  systemPrompt: string;
  tools: Array<{ name?: string; description?: string; parameters?: unknown }>;
  messages: AgentMessage[];
}) {
  return (
    estimateTextTokens(args.systemPrompt) +
    estimateToolsTokens(args.tools) +
    estimateMessagesTokens(args.messages) +
    64
  );
}

function buildContextCompactionBudget(model: Model<string>): ContextCompactionBudget {
  const contextWindow = numberOrFallback(model.contextWindow, 128000);
  const maxTokens = numberOrFallback(model.maxTokens, 8192);
  const outputReserveTokens = Math.min(
    Math.max(maxTokens, 2048),
    Math.max(1024, Math.floor(contextWindow * 0.25)),
  );
  const usableInputTokens = Math.max(4096, contextWindow - outputReserveTokens);
  return {
    contextWindow,
    maxTokens,
    outputReserveTokens,
    usableInputTokens,
    triggerTokens: Math.max(3500, Math.floor(usableInputTokens * CONTEXT_COMPACTION_TRIGGER_RATIO)),
    targetTokens: Math.max(2200, Math.floor(usableInputTokens * CONTEXT_COMPACTION_TARGET_RATIO)),
  };
}

function chooseRetainedMessageCount(args: {
  messages: AgentMessage[];
  systemPrompt: string;
  tools: Array<{ name?: string; description?: string; parameters?: unknown }>;
  budget: ContextCompactionBudget;
  extraTokenEstimate?: number;
}) {
  let keepCount = Math.min(
    CONTEXT_COMPACTION_KEEP_RECENT_MESSAGES,
    Math.max(0, args.messages.length - 1),
  );
  const retainedTarget = Math.floor(args.budget.targetTokens * 0.68);

  while (keepCount > 0) {
    const retained = args.messages.slice(-keepCount);
    const retainedEstimate =
      estimateContextTokens({
        systemPrompt: args.systemPrompt,
        tools: args.tools,
        messages: retained,
      }) +
      (args.extraTokenEstimate ?? 0) +
      320;
    if (retainedEstimate <= retainedTarget) return keepCount;
    keepCount -= 1;
  }

  return 0;
}

function serializeMessageForCompaction(message: AgentMessage, index: number) {
  const role = message.role;
  const timestamp = "timestamp" in message ? new Date(message.timestamp).toISOString() : "";
  const heading = [`#${index + 1}`, role, timestamp].filter(Boolean).join(" ");
  return `${heading}\n${clipText(redactSensitiveText(agentMessageToText(message)), 6000)}`;
}

function fallbackContextSummary(messages: AgentMessage[]) {
  const serialized = messages.map(serializeMessageForCompaction);
  const head = serialized.slice(0, 3);
  const tail = serialized.slice(-6);
  const notablePattern = new RegExp(
    [
      "error",
      "failed",
      "exception",
      uiText("ui.runtimeAdapter.compaction.notable.permission"),
      uiText("ui.runtimeAdapter.compaction.notable.failure"),
      uiText("ui.runtimeAdapter.compaction.notable.exception"),
      "blocked",
      "denied",
    ].join("|"),
    "i",
  );
  const notable = serialized
    .filter((item) => notablePattern.test(item))
    .slice(-6);

  return clipText(
    [
      "## Context Compaction Summary",
      `Summarized messages: ${messages.length}`,
      "",
      "### Early Context",
      head.join("\n\n---\n\n") || "None.",
      "",
      notable.length > 0 ? "### Notable Risks Or Errors" : "",
      notable.join("\n\n---\n\n"),
      "",
      "### Latest Summarized Context",
      tail.join("\n\n---\n\n") || "None.",
    ]
      .filter(Boolean)
      .join("\n"),
    CONTEXT_COMPACTION_MAX_SUMMARY_CHARS,
  );
}

async function summarizeContextWithModel(args: {
  model: Model<string>;
  apiKey?: string;
  actorName: string;
  reason: "preflight" | "agent-loop";
  budget: ContextCompactionBudget;
  messages: AgentMessage[];
  signal?: AbortSignal;
}) {
  const sourceText = args.messages.map(serializeMessageForCompaction).join("\n\n---\n\n");
  const sourceBudget = Math.floor(args.budget.usableInputTokens * 0.52);
  const compactedSource = clipTextToTokenBudget(sourceText, Math.max(1200, sourceBudget));
  const response = await completeSimple(
    args.model,
    {
      messages: [
        {
          role: "user",
          content: [
            "Summarize this older AgentWorld runtime transcript so the same task can continue in a smaller context window.",
            "Preserve the current user goal, constraints, decisions, files/tools touched, errors, permissions, safety notes, agent routing, unfinished work, and any facts the next model call must know.",
            "Drop repeated streaming deltas, low-signal chatter, and raw secrets. Replace secrets with [REDACTED].",
            "Return concise Markdown with sections: Current Goal, Stable Facts, Decisions, Work Done, Open Threads, Tool/File Notes, Risks.",
            `Actor: ${args.actorName}`,
            `Compaction reason: ${args.reason}`,
            "",
            "Transcript to compact:",
            compactedSource,
          ].join("\n"),
          timestamp: Date.now(),
        },
      ],
    },
    {
      apiKey: args.apiKey,
      maxTokens: Math.min(2400, Math.max(700, Math.floor(args.budget.targetTokens * 0.14))),
      reasoning: "minimal",
      signal: args.signal,
    },
  );

  if (response.stopReason === "error") {
    throw new Error(response.errorMessage ?? "Context compaction failed.");
  }

  const summary = flattenVisibleText(response).trim();
  if (!summary) throw new Error("Context compaction returned an empty summary.");
  return clipText(redactSensitiveText(summary), CONTEXT_COMPACTION_MAX_SUMMARY_CHARS);
}

function buildCompactionSummaryMessage(args: {
  actorName: string;
  source: "model" | "fallback";
  summarizedMessages: number;
  retainedMessages: number;
  summary: string;
}) {
  return [
    "[AgentWorld context compaction summary]",
    `Actor: ${args.actorName}`,
    `Source: ${args.source}`,
    `Older messages summarized: ${args.summarizedMessages}`,
    `Recent raw messages retained: ${args.retainedMessages}`,
    "",
    args.summary,
    "",
    "Continue from this summary plus the retained recent messages. Treat the summary as lossy but authoritative for older context.",
  ].join("\n");
}

async function compactAgentMessagesForContext(args: {
  session: RuntimeSessionContext;
  model: Model<string>;
  systemPrompt: string;
  tools: Array<{ name?: string; description?: string; parameters?: unknown }>;
  messages: AgentMessage[];
  pendingUserMessage?: string;
  actorId?: string | null;
  actorName: string;
  turnIndex: number;
  reason: "preflight" | "agent-loop";
  apiKey?: string;
  signal?: AbortSignal;
}): Promise<ContextCompactionResult> {
  const budget = buildContextCompactionBudget(args.model);
  const extraTokenEstimate = args.pendingUserMessage
    ? estimateTextTokens(args.pendingUserMessage) + 16
    : 0;
  const originalTokenEstimate = estimateContextTokens({
    systemPrompt: args.systemPrompt,
    tools: args.tools,
    messages: args.messages,
  }) + extraTokenEstimate;

  if (args.messages.length === 0 || originalTokenEstimate <= budget.triggerTokens) {
    return { messages: args.messages };
  }

  const retainedMessageCount = chooseRetainedMessageCount({
    messages: args.messages,
    systemPrompt: args.systemPrompt,
    tools: args.tools,
    budget,
    extraTokenEstimate,
  });
  const retainedMessages = retainedMessageCount > 0 ? args.messages.slice(-retainedMessageCount) : [];
  const summarizedMessages =
    retainedMessageCount > 0 ? args.messages.slice(0, -retainedMessageCount) : args.messages;

  if (summarizedMessages.length === 0) return { messages: args.messages };

  let source: "model" | "fallback" = "model";
  let summary = "";
  try {
    summary = await summarizeContextWithModel({
      model: args.model,
      apiKey: args.apiKey,
      actorName: args.actorName,
      reason: args.reason,
      budget,
      messages: summarizedMessages,
      signal: args.signal,
    });
  } catch {
    source = "fallback";
    summary = fallbackContextSummary(summarizedMessages);
  }

  const summaryMessage: AgentMessage = {
    role: "user",
    content: buildCompactionSummaryMessage({
      actorName: args.actorName,
      source,
      summarizedMessages: summarizedMessages.length,
      retainedMessages: retainedMessages.length,
      summary,
    }),
    timestamp: Date.now(),
  };
  const messages = [summaryMessage, ...retainedMessages];
  const compactedTokenEstimate = estimateContextTokens({
    systemPrompt: args.systemPrompt,
    tools: args.tools,
    messages,
  }) + extraTokenEstimate;

  return {
    messages,
    metadata: {
      actorId: args.actorId ?? null,
      actorName: args.actorName,
      turnIndex: args.turnIndex,
      reason: args.reason,
      source,
      contextWindow: budget.contextWindow,
      maxTokens: budget.maxTokens,
      triggerTokens: budget.triggerTokens,
      targetTokens: budget.targetTokens,
      originalTokenEstimate,
      compactedTokenEstimate,
      summarizedMessages: summarizedMessages.length,
      retainedMessages: retainedMessages.length,
      summaryPreview: clipText(summary.replace(/\s+/g, " ").trim(), 700),
    },
  };
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
  id = "agentworld-runtime-adapter";
  label = uiText("ui.generated.c1d9b27a203");
  private readonly sessionStreams = new Map<string, SessionStreamState>();
  private readonly sessionGenerations = new Map<string, number>();

  private getSessionState(sessionId: string) {
    const existing = this.sessionStreams.get(sessionId);
    if (existing) return existing;

    const state: SessionStreamState = {
      agents: new Map<string, { agent: Agent; actorId?: string | null; actorName: string }>(),
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

  private getSessionGeneration(sessionId: string) {
    return this.sessionGenerations.get(sessionId) ?? 0;
  }

  private assertSessionGeneration(sessionId: string, generation: number) {
    if (this.getSessionGeneration(sessionId) !== generation) {
      throw new Error("Runtime session interrupted");
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
        note: uiText("ui.generated.c414726f7c6"),
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
        note: uiText("ui.server.runtime.missingApiKey", undefined, {
          apiKey: descriptor.apiKeyRefMasked || uiText("ui.generated.c4e91eb1410"),
        }),
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
            ? response.errorMessage ?? uiText("ui.generated.c41b4ba383f")
            : uiText("ui.server.runtime.healthPassed", undefined, { providerLabel: descriptor.providerLabel }),
      } satisfies DiscoveredRuntime;
    } catch (error) {
      return {
        baseUrl: args.binding.baseUrl,
        status: "offline",
        agents: buildAgentCatalog(args.binding, args.agentCatalog),
        providers: [args.provider.name],
        latencyMs: null,
        note: error instanceof Error ? error.message : uiText("ui.generated.c4f7727a744"),
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

  async resumeSession(args: {
    sessionId: string;
    actorName: string;
    content: string;
    targetActorId?: string | null;
    targetActorName?: string | null;
  }) {
    const state = this.getSessionState(args.sessionId);
    if (state.agents.size === 0) return false;

    const candidates = [...state.agents.values()];
    const target = args.targetActorId
      ? candidates.find((candidate) => candidate.actorId === args.targetActorId)
      : args.targetActorName
        ? candidates.find((candidate) => candidate.actorName === args.targetActorName)
        : candidates.length === 1
          ? candidates[0]
          : null;

    if (!target) {
      return false;
    }

    target.agent.steer({
      role: "user",
      content: args.content,
      timestamp: Date.now(),
    });

    this.emit(args.sessionId, {
      type: "runtime.session.resumed",
      sessionId: args.sessionId,
      occurredAt: nowIso(),
      payload: {
        actorName: args.actorName,
        targetActorId: target.actorId ?? null,
        targetActorName: target.actorName,
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
    const generation = this.getSessionGeneration(input.session.sessionId);
    const model = buildPiModel(input.session.providerProfile, input.session.runtimeBinding) as Model<string>;
    const apiKey =
      resolveProviderApiKey(input.session.providerProfile, input.session.runtimeBinding) ?? undefined;
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
    const actorName = input.agent?.name ?? "Runtime Assistant";
    const actorId = input.agent?.id ?? null;
    const systemPrompt = buildAgentPrompt({
      session: input.session,
      teamContext: input.teamContext ?? null,
      agent: input.agent,
      runtimeBinding: input.session.runtimeBinding,
      providerProfile: input.session.providerProfile,
      instructions: input.instructions,
    });
    const emitContextCompaction = (payload: RuntimeContextCompactionPayload) => {
      const envelope: RuntimeSessionEnvelope = {
        type: "runtime.context.compacted",
        sessionId: input.session.sessionId,
        occurredAt: nowIso(),
        payload,
      };
      this.emit(input.session.sessionId, envelope);
      input.onRuntimeEvent?.(envelope);
    };
    const compactForContext = async (
      messages: AgentMessage[],
      reason: "preflight" | "agent-loop",
      signal?: AbortSignal,
    ) => {
      try {
        const result = await compactAgentMessagesForContext({
          session: input.session,
          model,
          systemPrompt,
          tools: toolSet,
          messages,
          pendingUserMessage: reason === "preflight" ? input.latestUserMessage : undefined,
          actorId,
          actorName,
          turnIndex: input.turnIndex,
          reason,
          apiKey,
          signal,
        });
        if (result.metadata) emitContextCompaction(result.metadata);
        return result.messages;
      } catch {
        return messages;
      }
    };
    const transcriptMessages = await compactForContext(
      input.getTranscript().filter(
        (message) => message.role !== "user" || message.content !== input.latestUserMessage,
      ),
      "preflight",
    );

    const agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        thinkingLevel: harnessProfile.thinkingLevel,
        messages: transcriptMessages,
        tools: toolSet,
      },
      sessionId: `${input.session.sessionId}:${input.agent?.name ?? "runtime-assistant"}`,
      getApiKey: () => apiKey,
      transformContext: (messages, signal) => compactForContext(messages, "agent-loop", signal),
      beforeToolCall: async (context) => {
        if (approvalMode === "allow") return undefined;
        const envelope: RuntimeSessionEnvelope = {
          type: "runtime.permission.ask",
          sessionId: input.session.sessionId,
          occurredAt: nowIso(),
          payload: {
            actorId,
            actorName,
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

    const actorKey = input.agent?.id ?? actorName;
    state.agents.set(actorKey, {
      agent,
      actorId,
      actorName,
    });
    agent.subscribe((event) => {
      this.emit(input.session.sessionId, {
        type: "runtime.agent.event",
        sessionId: input.session.sessionId,
        occurredAt: nowIso(),
        payload: {
          actorId,
          actorName,
          turnIndex: input.turnIndex,
          eventType: event.type,
        },
      });
      input.onAgentEvent({
        actorId,
        actorName,
        turnIndex: input.turnIndex,
        subConversation: input.subConversation ?? null,
        event,
      });
      if (event.type === "message_end" && event.message.role === "assistant") {
        finalAssistant = event.message as AssistantMessage;
      }
    });

    try {
      await agent.prompt(input.latestUserMessage);
      this.assertSessionGeneration(input.session.sessionId, generation);
      return {
        actorId,
        actorName,
        assistantText: flattenVisibleText(finalAssistant),
        thinkingText: flattenThinkingText(finalAssistant),
      } satisfies InvokeAgentNodeResult;
    } finally {
      state.agents.delete(actorKey);
    }
  }

  async invokeTeamPlan(input: InvokeTeamPlanInput) {
    const generation = this.getSessionGeneration(input.session.sessionId);
    const leader =
      input.teamPlan.leaderAgentId
        ? input.teamPlan.actors.find((agent) => agent.id === input.teamPlan.leaderAgentId) ??
          input.teamPlan.actors[0]
        : input.teamPlan.actors[0];
    const workers = input.teamPlan.actors.filter((agent) => agent.id !== leader?.id);
    const leaderName = leader?.name ?? "Team Leader";
    const directory = workerDirectory(workers);
    const directHumanMentions = collectMentionDelegations(input.latestUserMessage, workers);

    const leaderResult = leader
      ? await this.invokeAgentNode({
          session: input.session,
          agent: leader,
          latestUserMessage: input.latestUserMessage,
          turnIndex: input.turnIndex,
          instructions: [
            "You are the only team member that receives the human instruction directly.",
            "Sub agents do not see the full session transcript. Delegate only by mentioning exact handles from the directory below.",
            "If the human directly mentions a sub agent, that sub agent will receive only that direct mention packet, not the full transcript.",
            "When you need a sub agent, write a compact packet that starts with its handle and includes Context, Task, and Expected output.",
            "If you delegate, this first response is a routing packet, not the final answer to the human.",
            "Keep delegation packets short and operational so the conversation stays readable.",
            "If no sub agent is needed, answer the human directly and do not mention any handle.",
            "",
            "Available sub agents:",
            directory,
          ].join("\n"),
          teamContext: {
            teamName: input.teamPlan.teamName,
            leaderName,
          },
          getTranscript: input.getTranscript,
          onAgentEvent: input.onAgentEvent,
          onRuntimeEvent: input.onRuntimeEvent,
        })
      : null;
    this.assertSessionGeneration(input.session.sessionId, generation);

    const delegations = leaderResult
      ? collectMentionDelegations(leaderResult.assistantText, workers)
      : [];
    const workerRequestsById = new Map<
      string,
      {
        worker: RuntimeAgentProfile;
        handle: string;
        humanPackets: string[];
        leaderPackets: string[];
      }
    >();
    const ensureWorkerRequest = (worker: RuntimeAgentProfile, handle: string) => {
      const key = worker.id ?? handle;
      const existing = workerRequestsById.get(key);
      if (existing) return existing;
      const next = {
        worker,
        handle,
        humanPackets: [],
        leaderPackets: [],
      };
      workerRequestsById.set(key, next);
      return next;
    };

    for (const mention of directHumanMentions) {
      ensureWorkerRequest(mention.worker, mention.handle).humanPackets.push(mention.packet);
    }
    for (const delegation of delegations) {
      ensureWorkerRequest(delegation.worker, delegation.handle).leaderPackets.push(delegation.packet);
    }

    this.assertSessionGeneration(input.session.sessionId, generation);
    const initialWorkerContributions = await Promise.all(
      [...workerRequestsById.values()].map((request) => {
        const routedMessage = [
          request.humanPackets.length > 0
            ? [
                `The human operator directly mentioned ${request.handle}.`,
                "Direct mention packet:",
                request.humanPackets.join("\n\n---\n\n"),
              ].join("\n")
            : "",
          request.leaderPackets.length > 0
            ? [
                `${leaderName} explicitly mentioned ${request.handle}.`,
                "Leader routing packet:",
                request.leaderPackets.join("\n\n---\n\n"),
              ].join("\n")
            : "",
        ].filter(Boolean).join("\n\n");
        const kind: RuntimeSubConversationContext["kind"] =
          request.leaderPackets.length > 0 ? "leader_delegation" : "direct_mention";
        const subConversation = buildSubConversationContext({
          sessionId: input.session.sessionId,
          turnIndex: input.turnIndex,
          kind,
          sourceActorName: kind === "leader_delegation" ? leaderName : extractQuestionerName(input.latestUserMessage),
          target: request.worker,
          handle: request.handle,
          contextText: routedMessage,
        });

        return this.invokeAgentNode({
          session: input.session,
          agent: request.worker,
          latestUserMessage: routedMessage,
          turnIndex: input.turnIndex,
          subConversation,
          instructions: [
            "Context isolation rule: do not assume you saw the human's full session transcript or the leader's full transcript.",
            "Use only your system prompt, your role, and the routed packets provided in the current message.",
            "Return your contribution to the team, not directly to the end user.",
            "If you need another sub agent, mention that agent's exact handle and include a small handoff packet.",
            "",
            "Known teammate handles:",
            directory,
          ].join("\n"),
          teamContext: {
            teamName: input.teamPlan.teamName,
            leaderName,
          },
          getTranscript: () => [],
          onAgentEvent: input.onAgentEvent,
          onRuntimeEvent: input.onRuntimeEvent,
        });
      }),
    );
    this.assertSessionGeneration(input.session.sessionId, generation);

    const handoffContributions = (
      await Promise.all(
        initialWorkerContributions.flatMap((sourceResult) =>
          collectMentionDelegations(
            sourceResult.assistantText,
            workers.filter((worker) => worker.id !== sourceResult.actorId),
          ).map((handoff) => {
            const routedMessage = [
              `${sourceResult.actorName} explicitly mentioned ${handoff.handle}.`,
              "This handoff packet is the only peer context you receive:",
              handoff.packet,
            ].join("\n\n");
            const subConversation = buildSubConversationContext({
              sessionId: input.session.sessionId,
              turnIndex: input.turnIndex,
              kind: "peer_handoff",
              sourceActorName: sourceResult.actorName,
              target: handoff.worker,
              handle: handoff.handle,
              contextText: routedMessage,
            });

            return this.invokeAgentNode({
              session: input.session,
              agent: handoff.worker,
              latestUserMessage: routedMessage,
              turnIndex: input.turnIndex,
              subConversation,
              instructions: [
                "Context isolation rule: this is a peer handoff, not the full team transcript.",
                "Use only your system prompt, your role, and this handoff packet.",
                "Return a concise contribution for the leader.",
              ].join("\n"),
              teamContext: {
                teamName: input.teamPlan.teamName,
                leaderName,
              },
              getTranscript: () => [],
              onAgentEvent: input.onAgentEvent,
              onRuntimeEvent: input.onRuntimeEvent,
            });
          }),
        ),
      )
    ).slice(0, Math.max(0, workers.length));
    this.assertSessionGeneration(input.session.sessionId, generation);

    const workerResults = [...initialWorkerContributions, ...handoffContributions];

    const synthesis = leader && workerResults.length > 0
      ? await this.invokeAgentNode({
          session: input.session,
          agent: leader,
          latestUserMessage: [
            "You are the Leader. Produce the final answer for the human operator.",
            `Human instruction:\n${input.latestUserMessage}`,
            `Leader routing plan:\n${leaderResult?.assistantText ?? ""}`,
            `Sub agent outputs:\n${workerResults
              .map((worker) => `${worker.actorName}: ${worker.assistantText}`)
              .join("\n\n")}`,
          ].join("\n\n"),
          turnIndex: input.turnIndex,
          instructions: [
            "Use only the current routed packets and sub agent outputs. Do not invent unseen sub agent context.",
            "Summarize what each participating agent contributed by name.",
            "Start the final answer by mentioning the human questioner when the human instruction contains `Question from @name:`.",
            "Call out conflicts, risks, or missing evidence when they exist.",
            "End with the decision, recommendation, or next actions the human can use.",
            "Do not expose hidden chain-of-thought; summarize reasoning at a useful level.",
          ].join("\n"),
          teamContext: {
            teamName: input.teamPlan.teamName,
            leaderName,
          },
          getTranscript: () => [],
          onAgentEvent: input.onAgentEvent,
          onRuntimeEvent: input.onRuntimeEvent,
        })
      : null;
    this.assertSessionGeneration(input.session.sessionId, generation);

    return {
      leader: leaderResult,
      workers: workerResults,
      synthesis,
    } satisfies InvokeTeamPlanResult;
  }

  async cancel(sessionId: string) {
    const state = this.getSessionState(sessionId);
    this.sessionGenerations.set(sessionId, this.getSessionGeneration(sessionId) + 1);
    const abortedActors = [...state.agents.values()].map((entry) => entry.actorName);
    for (const entry of state.agents.values()) {
      entry.agent.clearAllQueues();
      entry.agent.abort();
    }
    state.agents.clear();
    state.closed = false;
    this.emit(sessionId, {
      type: "runtime.session.cancelled",
      sessionId,
      occurredAt: nowIso(),
      payload: { abortedActors },
    });
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
