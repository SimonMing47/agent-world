import { completeSimple } from "@earendil-works/pi-ai";
import { randomUUID } from "node:crypto";
import {
  queryOne,
  type ProviderProfile,
  type ProviderRuntimeBinding,
} from "@/server/db";
import { buildPiModel, resolveProviderApiKey } from "@/server/runtime-provider-config";
import { uiText } from "@/lib/language-pack";

type TeamMemberDraft = {
  agentDefinitionId?: string;
  memberRole?: string;
  workInstruction?: string;
  status?: string;
};

export type AgentTeamOptimizationDraft = {
  name?: string;
  slug?: string;
  description?: string;
  workflowType?: string;
  orchestrationPrompt?: string;
  workflowDefinitionJson?: string;
  members?: TeamMemberDraft[];
};

type AgentTeamOptimizationSuggestion = {
  name: string;
  slug: string;
  description: string;
  orchestrationPrompt: string;
  workflowType: string;
  teamStructure: string;
  teamObjective: string;
  aggregationMethod: string;
  conflictResolution: string;
  splitStrategy: string;
  members: TeamMemberDraft[];
  notes: string[];
};

export type AgentTeamAssemblyAvailableAgent = {
  id: string;
  name: string;
  role: string;
  description?: string;
  systemPrompt?: string;
  tagsJson?: string;
  status?: string;
  visibility?: string;
};

export type AgentTeamAssemblySelectedMember = {
  agentDefinitionId: string;
  memberRole: string;
  workInstruction: string;
  status?: string;
  position?: number;
  isLeader?: boolean;
  rationale?: string;
};

export type AgentTeamAssemblyNewAgentDraft = {
  tempId: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  memberRole: string;
  workInstruction: string;
  tags?: string[];
  isLeader?: boolean;
  rationale?: string;
};

type AgentTeamAssemblySuggestion = {
  name: string;
  slug: string;
  description: string;
  orchestrationPrompt: string;
  workflowType: string;
  teamStructure: string;
  teamObjective: string;
  aggregationMethod: string;
  conflictResolution: string;
  splitStrategy: string;
  selectedMembers: AgentTeamAssemblySelectedMember[];
  newAgents: AgentTeamAssemblyNewAgentDraft[];
  notes: string[];
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function flattenVisibleText(message: Awaited<ReturnType<typeof completeSimple>>) {
  return message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n");
}

function extractJsonObject<T>(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function resolveDefaultRuntime() {
  const runtimeBinding = queryOne<ProviderRuntimeBinding>(
    "SELECT * FROM provider_runtime_bindings WHERE is_enabled = 1 ORDER BY updated_at DESC LIMIT 1",
  );
  if (!runtimeBinding) throw new Error(uiText("ui.generated.c368a833c53"));

  const providerProfile =
    (runtimeBinding.defaultProviderProfileId
      ? queryOne<ProviderProfile>(
          "SELECT * FROM provider_profiles WHERE id = ? AND is_enabled = 1",
          runtimeBinding.defaultProviderProfileId,
        )
      : null) ??
    queryOne<ProviderProfile>(
      "SELECT * FROM provider_profiles WHERE is_enabled = 1 ORDER BY updated_at DESC LIMIT 1",
    );
  if (!providerProfile) throw new Error(uiText("ui.generated.c3b8fb2bc14"));

  const apiKey = resolveProviderApiKey(providerProfile, runtimeBinding);
  if (!apiKey) throw new Error(uiText("ui.generated.c1e2d0bd2b6"));

  return { runtimeBinding, providerProfile, apiKey };
}

export async function optimizeAgentTeamDraft(args: {
  team: AgentTeamOptimizationDraft;
  optimizationGoal?: string;
}) {
  const { runtimeBinding, providerProfile, apiKey } = resolveDefaultRuntime();
  const model = buildPiModel(providerProfile, runtimeBinding);
  const response = await completeSimple(
    model,
    {
      messages: [
        {
          role: "user",
          content: [
            uiText(
              "ui.server.agentTeam.optimization.promptRole",
              "You are AgentWorld's Agent Team configuration designer. Optimize one team definition.",
            ),
            uiText(
              "ui.server.agentTeam.optimization.promptRequirements",
              "Requirements: return JSON only; keep the single TEAM.md document form; strengthen Leader delegation, member responsibilities, context isolation, and result aggregation around the current team goal; do not output explanatory text.",
            ),
            'JSON schema: {"name":"string","slug":"string","description":"string","orchestrationPrompt":"string","workflowType":"string","teamStructure":"string","teamObjective":"string","aggregationMethod":"string","conflictResolution":"string","splitStrategy":"string","members":[{"memberRole":"string","workInstruction":"string","status":"string"}],"notes":["string"]}',
            `Current name: ${args.team.name ?? ""}`,
            `Current description: ${args.team.description ?? ""}`,
            `Current workflow type: ${args.team.workflowType ?? ""}`,
            `Current workflow definition JSON:\n${args.team.workflowDefinitionJson ?? "{}"}`,
            `Current TEAM.md:\n${args.team.orchestrationPrompt ?? ""}`,
            `Current members:\n${JSON.stringify(args.team.members ?? [], null, 2)}`,
            args.optimizationGoal ? `Optimization goal:\n${args.optimizationGoal}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
          timestamp: Date.now(),
        },
      ],
    },
    {
      apiKey,
      maxTokens: 1800,
      reasoning: "medium",
    },
  );

  if (response.stopReason === "error") {
    throw new Error(response.errorMessage ?? uiText("ui.server.agentTeam.optimization.failed", "Agent Team optimization failed."));
  }

  const rawText = flattenVisibleText(response);
  const parsed = extractJsonObject<AgentTeamOptimizationSuggestion>(rawText);
  if (!parsed) {
    throw new Error(
      uiText(
        "ui.server.agentTeam.optimization.parseJsonFailed",
        "The default model did not return parseable team configuration JSON.",
      ),
    );
  }

  return {
    suggestion: {
      ...parsed,
      slug: parsed.slug || slugify(parsed.name || args.team.name || "agent-team"),
    },
    rawText,
    responseModel: response.responseModel ?? response.model,
    usage: response.usage,
  };
}

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStatus(value: unknown) {
  const status = normalizeText(value, "active");
  return ["active", "draft", "paused"].includes(status) ? status : "active";
}

function sanitizeAssemblySuggestion(
  suggestion: Partial<AgentTeamAssemblySuggestion>,
  args: {
    team: AgentTeamOptimizationDraft;
    availableAgents: AgentTeamAssemblyAvailableAgent[];
  },
): AgentTeamAssemblySuggestion {
  const availableById = new Map(args.availableAgents.map((agent) => [agent.id, agent]));
  const seenAgentIds = new Set<string>();
  const teamObjective = normalizeText(
    suggestion.teamObjective,
    normalizeText(args.team.workflowDefinitionJson, args.team.description ?? args.team.name ?? ""),
  );

  const selectedMembers = (Array.isArray(suggestion.selectedMembers) ? suggestion.selectedMembers : [])
    .filter((member) => availableById.has(member.agentDefinitionId))
    .filter((member) => {
      if (seenAgentIds.has(member.agentDefinitionId)) return false;
      seenAgentIds.add(member.agentDefinitionId);
      return true;
    })
    .slice(0, 8)
    .map((member, index) => {
      const agent = availableById.get(member.agentDefinitionId);
      return {
        agentDefinitionId: member.agentDefinitionId,
        memberRole: normalizeText(member.memberRole, agent?.role || `member-${index + 1}`),
        workInstruction: normalizeText(
          member.workInstruction,
          uiText(
            "ui.server.agentTeam.assembly.defaultSelectedMemberWorkInstruction",
            "{agentName} completes delegated work according to the team goal.",
            { agentName: agent?.name ?? "Agent" },
          ),
        ),
        status: normalizeStatus(member.status),
        position: index,
        isLeader: Boolean(member.isLeader),
        rationale: normalizeText(member.rationale),
      };
    });

  if (!selectedMembers.some((member) => member.isLeader) && selectedMembers[0]) {
    selectedMembers[0].isLeader = true;
  }

  const newAgents = (Array.isArray(suggestion.newAgents) ? suggestion.newAgents : [])
    .slice(0, 6)
    .map((agent) => {
      const name = normalizeText(agent.name);
      const role = normalizeText(agent.role, normalizeText(agent.memberRole));
      const systemPrompt = normalizeText(agent.systemPrompt);
      if (!name || !role || !systemPrompt) return null;
      const memberRole = normalizeText(agent.memberRole, role);
      return {
        tempId: normalizeText(agent.tempId, `new-${randomUUID().slice(0, 8)}`),
        name,
        role,
        description: normalizeText(agent.description),
        systemPrompt,
        memberRole,
        workInstruction: normalizeText(
          agent.workInstruction,
          uiText(
            "ui.server.agentTeam.assembly.defaultNewAgentWorkInstruction",
            "Produce a mergeable expert conclusion from the local context delegated by the Leader.",
          ),
        ),
        tags: Array.isArray(agent.tags) ? agent.tags.map(String).filter(Boolean).slice(0, 8) : ["team-generated"],
        isLeader: Boolean(agent.isLeader) && !selectedMembers.some((member) => member.isLeader),
        rationale: normalizeText(agent.rationale),
      };
    })
    .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent));

  if (!selectedMembers.length && !newAgents.length && args.availableAgents[0]) {
    selectedMembers.push({
      agentDefinitionId: args.availableAgents[0].id,
      memberRole: args.availableAgents[0].role || "leader",
      workInstruction: uiText(
        "ui.server.agentTeam.assembly.fallbackLeaderWorkInstruction",
        "Perform the initial breakdown, execution, and summary according to the team goal.",
      ),
      status: "active",
      position: 0,
      isLeader: true,
      rationale: uiText(
        "ui.server.agentTeam.assembly.fallbackLeaderRationale",
        "Default fallback selects the first available Agent.",
      ),
    });
  }

  return {
    name: normalizeText(suggestion.name, args.team.name ?? "Agent Team"),
    slug: slugify(normalizeText(suggestion.slug, suggestion.name ?? args.team.name ?? "agent-team")),
    description: normalizeText(
      suggestion.description,
      args.team.description ??
        uiText(
          "ui.server.agentTeam.assembly.defaultTeamDescription",
          "An execution team assembled from existing Agents and necessary new Agents.",
        ),
    ),
    orchestrationPrompt: normalizeText(suggestion.orchestrationPrompt, args.team.orchestrationPrompt ?? ""),
    workflowType: normalizeText(suggestion.workflowType, args.team.workflowType ?? "parallel"),
    teamStructure: normalizeText(suggestion.teamStructure, "leader_worker"),
    teamObjective,
    aggregationMethod: normalizeText(suggestion.aggregationMethod, "leader_summary"),
    conflictResolution: normalizeText(suggestion.conflictResolution, "leader_decision"),
    splitStrategy: normalizeText(suggestion.splitStrategy, "by_capability_gap"),
    selectedMembers,
    newAgents,
    notes: Array.isArray(suggestion.notes) ? suggestion.notes.map(String).slice(0, 8) : [],
  };
}

export async function assembleAgentTeamDraft(args: {
  team: AgentTeamOptimizationDraft;
  availableAgents: AgentTeamAssemblyAvailableAgent[];
}) {
  const { runtimeBinding, providerProfile, apiKey } = resolveDefaultRuntime();
  const model = buildPiModel(providerProfile, runtimeBinding);
  const response = await completeSimple(
    model,
    {
      messages: [
        {
          role: "user",
          content: [
            uiText(
              "ui.server.agentTeam.assembly.promptRole",
              "You are AgentWorld's Agent Team assembly designer. Select members from existing Agents according to the team goal.",
            ),
            uiText(
              "ui.server.agentTeam.assembly.promptExistingAgentsRule",
              "Important rule: prefer existing Agents. Suggest new Agents in newAgents only when existing Agents clearly cannot cover the responsibilities required by the team goal. Do not add new Agents just to fill seats.",
            ),
            uiText(
              "ui.server.agentTeam.assembly.promptMemberIdsRule",
              "Important rule: selectedMembers.agentDefinitionId must come from the id values in Available agents. newAgents are only pending drafts and must not be assumed to already exist.",
            ),
            uiText(
              "ui.server.agentTeam.assembly.promptLeaderRule",
              "Important rule: the team must have one Leader. Prefer choosing the Leader from existing Agents; only put a new Leader in newAgents when no suitable existing Leader is available.",
            ),
            uiText("ui.server.agentTeam.assembly.promptJsonOnly", "Return JSON only and do not output explanatory text."),
            'JSON schema: {"name":"string","slug":"string","description":"string","orchestrationPrompt":"string","workflowType":"string","teamStructure":"string","teamObjective":"string","aggregationMethod":"string","conflictResolution":"string","splitStrategy":"string","selectedMembers":[{"agentDefinitionId":"string","memberRole":"string","workInstruction":"string","status":"active","position":0,"isLeader":true,"rationale":"string"}],"newAgents":[{"tempId":"string","name":"string","role":"string","description":"string","systemPrompt":"string","memberRole":"string","workInstruction":"string","tags":["string"],"isLeader":false,"rationale":"string"}],"notes":["string"]}',
            `Team draft:\n${JSON.stringify(args.team, null, 2)}`,
            `Available agents:\n${JSON.stringify(
              args.availableAgents.map((agent) => ({
                id: agent.id,
                name: agent.name,
                role: agent.role,
                description: agent.description,
                systemPrompt: agent.systemPrompt?.slice(0, 2400),
                tagsJson: agent.tagsJson,
                status: agent.status,
                visibility: agent.visibility,
              })),
              null,
              2,
            )}`,
          ].join("\n\n"),
          timestamp: Date.now(),
        },
      ],
    },
    {
      apiKey,
      maxTokens: 3200,
      reasoning: "medium",
    },
  );

  if (response.stopReason === "error") {
    throw new Error(response.errorMessage ?? uiText("ui.server.agentTeam.assembly.failed", "Agent Team assembly failed."));
  }

  const rawText = flattenVisibleText(response);
  const parsed = extractJsonObject<Partial<AgentTeamAssemblySuggestion>>(rawText);
  if (!parsed) {
    throw new Error(
      uiText(
        "ui.server.agentTeam.assembly.parseJsonFailed",
        "The default model did not return parseable team assembly JSON.",
      ),
    );
  }

  return {
    suggestion: sanitizeAssemblySuggestion(parsed, args),
    rawText,
    responseModel: response.responseModel ?? response.model,
    usage: response.usage,
  };
}
