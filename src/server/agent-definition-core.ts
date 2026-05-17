import { randomUUID } from "node:crypto";
import { Agent, type AgentEvent } from "@earendil-works/pi-agent-core";
import { completeSimple, type AssistantMessage } from "@earendil-works/pi-ai";
import {
  execute,
  queryOne,
  type AgentDefinition,
  type BusinessTeam,
  type ProviderProfile,
  type ProviderRuntimeBinding,
} from "@/server/db";
import {
  buildAgentHarnessExecutionProfile,
  parseAgentHarnessConfig,
  parseAgentPermissionPolicy,
} from "@/server/agent-harness-core";
import { buildReadOnlyWorkspaceTools } from "@/server/pi-agent-toolset";
import {
  buildPiModel,
  resolveProviderApiKey,
} from "@/server/runtime-provider-config";

export type AgentDefinitionDraft = {
  id?: string;
  tenantSpaceId?: string;
  ownerBusinessTeamId?: string | null;
  ownerUserId?: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  model: string;
  defaultProviderProfileId?: string | null;
  defaultRuntimeBindingId?: string | null;
  toolBindings: string[];
  harnessConfigJson?: string;
  permissionPolicyJson?: string;
  memoryScope: string;
  tags: string[];
  visibility: string;
  status: string;
};

type AgentDefinitionOptimization = {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  testPrompt: string;
  notes: string[];
};

function nowIso() {
  return new Date().toISOString();
}

function buildDefinitionSystemPrompt(definition: AgentDefinitionDraft) {
  const harness = parseAgentHarnessConfig(definition.harnessConfigJson);
  const permissions = parseAgentPermissionPolicy(definition.permissionPolicyJson);
  return [
    `You are ${definition.name}.`,
    `Role: ${definition.role}.`,
    definition.description ? `Description: ${definition.description}` : "",
    `Harness approval mode: ${harness.approvalMode ?? "allow"}. Thinking level: ${harness.thinkingLevel ?? "medium"}. Human intervention: ${harness.humanIntervention ?? "steer"}.`,
    `Tool permissions: allow ${permissions.allowedToolNames?.join(", ") || "all configured read-only tools"}; deny ${permissions.deniedToolNames?.join(", ") || "none"}.`,
    `Resource permissions: repository ${permissions.repositoryAccess ?? "read_only"}, memory ${permissions.memoryAccess ?? "inherit"}, secret ${permissions.secretAccess ?? "runtime_bound_only"}.`,
    definition.systemPrompt,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function flattenVisibleText(message: AssistantMessage) {
  return message.content
    .map((block) => {
      if (block.type === "text") return block.text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function flattenThinkingText(message: AssistantMessage) {
  return message.content
    .map((block) => {
      if (block.type === "thinking") return block.thinking;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate) as AgentDefinitionOptimization;
  } catch {
    return null;
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function resolveProviderAndRuntime(definition: AgentDefinitionDraft) {
  const runtimeBinding =
    (definition.defaultRuntimeBindingId
      ? queryOne<ProviderRuntimeBinding>(
          "SELECT * FROM provider_runtime_bindings WHERE id = ?",
          definition.defaultRuntimeBindingId,
        )
      : null) ??
    queryOne<ProviderRuntimeBinding>(
      "SELECT * FROM provider_runtime_bindings WHERE is_enabled = 1 ORDER BY updated_at DESC LIMIT 1",
    );

  const providerProfile =
    (definition.defaultProviderProfileId
      ? queryOne<ProviderProfile>(
          "SELECT * FROM provider_profiles WHERE id = ?",
          definition.defaultProviderProfileId,
        )
      : null) ??
    (runtimeBinding?.defaultProviderProfileId
      ? queryOne<ProviderProfile>(
          "SELECT * FROM provider_profiles WHERE id = ?",
          runtimeBinding.defaultProviderProfileId,
        )
      : null) ??
    queryOne<ProviderProfile>(
      "SELECT * FROM provider_profiles WHERE is_enabled = 1 ORDER BY updated_at DESC LIMIT 1",
    );

  if (!runtimeBinding) {
    throw new Error("未找到可用的运行时绑定，请先配置 Runtime。");
  }
  if (!providerProfile) {
    throw new Error("未找到可用的模型接口，请先配置 Provider。");
  }

  const apiKey = resolveProviderApiKey(providerProfile, runtimeBinding);
  if (!apiKey) {
    throw new Error("当前 Provider 缺少 API Key 引用。");
  }

  return {
    runtimeBinding,
    providerProfile,
    apiKey,
  };
}

function maybePersistValidation(
  definitionId: string | undefined,
  status: "passed" | "failed",
  summary: string,
) {
  if (!definitionId) return;

  const current = queryOne<AgentDefinition>(
    "SELECT * FROM agent_definitions WHERE id = ?",
    definitionId,
  );
  if (!current) return;

  execute(
    "UPDATE agent_definitions SET validation_status = ?, last_validated_at = ?, last_validation_summary = ?, updated_at = ? WHERE id = ?",
    status,
    nowIso(),
    summary,
    nowIso(),
    definitionId,
  );
}

export async function optimizeAgentDefinitionDraft(args: {
  definition: AgentDefinitionDraft;
  optimizationGoal?: string;
}) {
  const { runtimeBinding, providerProfile, apiKey } = resolveProviderAndRuntime(args.definition);
  const harnessProfile = buildAgentHarnessExecutionProfile(args.definition, runtimeBinding);
  const businessTeam = args.definition.ownerBusinessTeamId
    ? queryOne<BusinessTeam>(
        "SELECT * FROM business_teams WHERE id = ?",
        args.definition.ownerBusinessTeamId,
      )
    : null;

  const model = buildPiModel(
    {
      ...providerProfile,
      defaultModel: args.definition.model || providerProfile.defaultModel,
    },
    runtimeBinding,
  );

  const response = await completeSimple(
    model,
    {
      messages: [
        {
          role: "user",
          content: [
            "请优化下面这个 Agent 定义，使它更适合团队级 Agent 平台使用。",
            "输出必须是 JSON，不要输出额外解释。",
            'JSON schema: {"name":"string","role":"string","description":"string","systemPrompt":"string","testPrompt":"string","notes":["string"]}',
            `Owner business team: ${businessTeam?.name ?? "未指定"}`,
            `Current name: ${args.definition.name}`,
            `Current role: ${args.definition.role}`,
            `Current description: ${args.definition.description}`,
            `Current visibility: ${args.definition.visibility}`,
            `Current tools: ${args.definition.toolBindings.join(", ") || "none"}`,
            `Current memory scope: ${args.definition.memoryScope}`,
            `Current tags: ${args.definition.tags.join(", ") || "none"}`,
            `Current harness approval mode: ${harnessProfile.approvalMode}`,
            `Current harness thinking level: ${harnessProfile.thinkingLevel}`,
            `Current harness human intervention: ${harnessProfile.humanIntervention}`,
            `Allowed tool names: ${harnessProfile.allowedToolNames.join(", ") || "all read-only tools"}`,
            `Denied tool names: ${harnessProfile.deniedToolNames.join(", ") || "none"}`,
            `Repository access: ${harnessProfile.repositoryAccess}`,
            `Memory access: ${harnessProfile.memoryAccess}`,
            `Secret access: ${harnessProfile.secretAccess}`,
            `Current system prompt:\n${args.definition.systemPrompt}`,
            args.optimizationGoal ? `Optimization goal:\n${args.optimizationGoal}` : "",
            "目标：保持定义严肃、可执行、边界清楚，强调职责、输入输出约束、协作方式和安全边界，并与当前 Harness 权限模型一致。",
          ]
            .filter(Boolean)
            .join("\n\n"),
          timestamp: Date.now(),
        },
      ],
    },
    {
      apiKey,
      maxTokens: 1600,
      reasoning: "medium",
    },
  );

  if (response.stopReason === "error") {
    throw new Error(response.errorMessage ?? "优化 Agent 定义失败。");
  }

  const rawText = flattenVisibleText(response);
  const parsed = extractJsonObject(rawText);
  if (!parsed) {
    throw new Error("模型返回的优化结果不是有效 JSON。");
  }

  return {
    suggestion: {
      ...parsed,
      slug: slugify(parsed.name || args.definition.name),
    },
    rawText,
    responseModel: response.responseModel ?? response.model,
    usage: response.usage,
  };
}

export async function testAgentDefinitionDraft(args: {
  definition: AgentDefinitionDraft;
  testPrompt: string;
  workspaceRoot?: string;
  persistValidation?: boolean;
}) {
  const { runtimeBinding, providerProfile, apiKey } = resolveProviderAndRuntime(args.definition);
  const harnessProfile = buildAgentHarnessExecutionProfile(args.definition, runtimeBinding);
  const model = buildPiModel(
    {
      ...providerProfile,
      defaultModel: args.definition.model || providerProfile.defaultModel,
    },
    runtimeBinding,
  );

  const events: Array<{
    id: string;
    eventType: string;
    actorName: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }> = [];

  let finalMessage: AssistantMessage | null = null;
  const toolResults: Array<{
    toolName: string;
    text: string;
    isError: boolean;
    details?: unknown;
  }> = [];

  const agent = new Agent({
    initialState: {
      systemPrompt: buildDefinitionSystemPrompt(args.definition),
      model,
      thinkingLevel: harnessProfile.thinkingLevel,
      messages: [],
      tools: buildReadOnlyWorkspaceTools(
        args.workspaceRoot ?? runtimeBinding.workspaceRoot,
        {
          approvalMode: harnessProfile.approvalMode,
          allowedToolNames: harnessProfile.allowedToolNames,
          deniedToolNames: harnessProfile.deniedToolNames,
        },
      ),
    },
    sessionId: `agent-definition-test:${args.definition.id ?? randomUUID()}`,
    getApiKey: () => apiKey,
  });

  agent.subscribe((event: AgentEvent) => {
    const createdAt = nowIso();

    if (event.type === "message_update") {
      const assistantEvent = event.assistantMessageEvent;
      if (
        assistantEvent.type === "thinking_start" ||
        assistantEvent.type === "thinking_delta" ||
        assistantEvent.type === "thinking_end"
      ) {
        events.push({
          id: randomUUID(),
          eventType: assistantEvent.type,
          actorName: args.definition.name,
          payload: {
            contentIndex: assistantEvent.contentIndex,
            delta: "delta" in assistantEvent ? assistantEvent.delta : undefined,
          },
          createdAt,
        });
      } else if (
        assistantEvent.type === "toolcall_start" ||
        assistantEvent.type === "toolcall_delta" ||
        assistantEvent.type === "toolcall_end"
      ) {
        const contentBlock = assistantEvent.partial.content[assistantEvent.contentIndex];
        events.push({
          id: randomUUID(),
          eventType:
            assistantEvent.type === "toolcall_start"
              ? "tool_call_requested"
              : assistantEvent.type === "toolcall_end"
                ? "tool_call_finished"
                : "tool_call_delta",
          actorName: args.definition.name,
          payload: {
            toolName: contentBlock?.type === "toolCall" ? contentBlock.name : undefined,
            delta: "delta" in assistantEvent ? assistantEvent.delta : undefined,
          },
          createdAt,
        });
      } else if (assistantEvent.type === "text_delta") {
        events.push({
          id: randomUUID(),
          eventType: "agent_message_delta",
          actorName: args.definition.name,
          payload: {
            delta: assistantEvent.delta,
            contentIndex: assistantEvent.contentIndex,
          },
          createdAt,
        });
      }
      return;
    }

    if (event.type === "tool_execution_start") {
      events.push({
        id: randomUUID(),
        eventType: "tool_call_started",
        actorName: args.definition.name,
        payload: {
          toolName: event.toolName,
          args: event.args,
        },
        createdAt,
      });
      return;
    }

    if (event.type === "tool_execution_end") {
      events.push({
        id: randomUUID(),
        eventType: "tool_call_finished",
        actorName: args.definition.name,
        payload: {
          toolName: event.toolName,
          isError: event.isError,
        },
        createdAt,
      });
      return;
    }

    if (event.type === "turn_end") {
      event.toolResults.forEach((toolResult) => {
        toolResults.push({
          toolName: toolResult.toolName,
          text: toolResult.content
            .map((block) => (block.type === "text" ? block.text : ""))
            .filter(Boolean)
            .join("\n"),
          isError: toolResult.isError,
          details: toolResult.details,
        });
      });
      return;
    }

    if (event.type === "message_end" && event.message.role === "assistant") {
      finalMessage = event.message;
    }
  });

  try {
    await agent.prompt(args.testPrompt);
    const resolvedFinalMessage = finalMessage as AssistantMessage | null;
    const outputText = resolvedFinalMessage ? flattenVisibleText(resolvedFinalMessage) : "";
    const thinkingText = resolvedFinalMessage ? flattenThinkingText(resolvedFinalMessage) : "";
    const summary =
      outputText.trim().slice(0, 240) || "测试已完成，但输出为空。";
    if (args.persistValidation) {
      maybePersistValidation(args.definition.id, "passed", summary);
    }

    return {
      status: "passed" as const,
      outputText,
      thinkingText,
      toolResults,
      events,
      responseModel:
        resolvedFinalMessage?.responseModel ??
        resolvedFinalMessage?.model ??
        args.definition.model,
      usage: resolvedFinalMessage?.usage ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "测试 Agent 失败。";
    if (args.persistValidation) {
      maybePersistValidation(args.definition.id, "failed", message);
    }
    throw new Error(message);
  }
}
