import { type Agent, type AgentTeam } from "@/server/db";
import { uiText } from "@/lib/language-pack";

export type AgentTeamRunPlanWorker = {
  agent: string;
  task: string;
  action?: string;
  tool?: string;
  blockId?: string;
  blockType?: string;
  title?: string;
  targetAgentTeamId?: string;
  connectorType?: string;
  publisherRef?: string;
};

export type AgentTeamRunPlanBlock = {
  id: string;
  type: "agent" | "agent_team" | "script_hook" | "http_hook" | "notification";
  title?: string;
  agentId?: string;
  agentTeamId?: string;
  dependsOn?: string[];
  instruction?: string;
  action?: string;
  tool?: string;
  script?: string;
  url?: string;
  method?: string;
  connectorType?: string;
  publisherRef?: string;
  payloadTemplate?: string;
};

export type AgentTeamRunPlan = {
  strategy: string;
  leader: string;
  workers: AgentTeamRunPlanWorker[];
  blocks?: AgentTeamRunPlanBlock[];
  defaultWorkerTool?: string;
  aggregation?: {
    agent: string;
    method: string;
    action?: string;
    tool?: string;
  };
  conflictResolution?: {
    method: string;
  };
  splitStrategy?: string;
};

export type TaskRunNodeSpec = {
  nodeKey: string;
  agentId: string;
  dependsOn?: string[];
  input?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeNodeKey(value: unknown, index: number) {
  const raw = typeof value === "string" && value.trim() ? value : `block_${index + 1}`;
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || `block_${index + 1}`;
}

function normalizeBlockType(value: unknown): AgentTeamRunPlanBlock["type"] {
  if (
    value === "agent" ||
    value === "agent_team" ||
    value === "script_hook" ||
    value === "http_hook" ||
    value === "notification"
  ) {
    return value;
  }
  return "agent";
}

function defaultToolForBlock(type: AgentTeamRunPlanBlock["type"]) {
  if (type === "agent") return "agent.execute";
  if (type === "agent_team") return "agent_team.invoke";
  if (type === "script_hook") return "script.run";
  if (type === "http_hook") return "hook.http";
  return "connector.email";
}

function defaultActionForBlock(type: AgentTeamRunPlanBlock["type"]) {
  if (type === "agent_team") return "delegate";
  if (type === "script_hook") return "run_script";
  if (type === "http_hook") return "call_hook";
  if (type === "notification") return "notify";
  return "execute";
}

function parseRunPlan(value: string): AgentTeamRunPlan | null {
  try {
    const parsed = JSON.parse(value) as Partial<AgentTeamRunPlan>;
    if (!parsed.strategy || !parsed.leader) return null;
    const blocks = Array.isArray(parsed.blocks)
      ? parsed.blocks.filter(isRecord).map((block, index) => {
          const type = normalizeBlockType(block.type);
          return {
            id: normalizeNodeKey(block.id, index),
            type,
            title: typeof block.title === "string" ? block.title : undefined,
            agentId: typeof block.agentId === "string" ? block.agentId : undefined,
            agentTeamId: typeof block.agentTeamId === "string" ? block.agentTeamId : undefined,
            dependsOn: Array.isArray(block.dependsOn) ? block.dependsOn.map(String) : [],
            instruction: typeof block.instruction === "string" ? block.instruction : undefined,
            action: typeof block.action === "string" ? block.action : defaultActionForBlock(type),
            tool: typeof block.tool === "string" ? block.tool : defaultToolForBlock(type),
            script: typeof block.script === "string" ? block.script : undefined,
            url: typeof block.url === "string" ? block.url : undefined,
            method: typeof block.method === "string" ? block.method : undefined,
            connectorType: typeof block.connectorType === "string" ? block.connectorType : undefined,
            publisherRef: typeof block.publisherRef === "string" ? block.publisherRef : undefined,
            payloadTemplate: typeof block.payloadTemplate === "string" ? block.payloadTemplate : undefined,
          } satisfies AgentTeamRunPlanBlock;
        })
      : [];
    return {
      strategy: parsed.strategy,
      leader: parsed.leader,
      workers: Array.isArray(parsed.workers) ? parsed.workers : [],
      blocks,
      defaultWorkerTool:
        typeof parsed.defaultWorkerTool === "string" ? parsed.defaultWorkerTool : undefined,
      aggregation: parsed.aggregation,
      conflictResolution: parsed.conflictResolution,
      splitStrategy: parsed.splitStrategy,
    };
  } catch {
    return null;
  }
}

export function summarizeAgentTeamRunPlan(
  value: string,
  agents: Agent[],
  team?: AgentTeam | null,
) {
	  const parsed = parseRunPlan(value);
	  const leaderId = parsed?.leader ?? team?.leaderAgentId ?? "";
  const leader = agents.find((agent) => agent.id === leaderId) ?? null;
  const workers =
    parsed?.blocks && parsed.blocks.length > 0
      ? parsed.blocks
          .filter((block) => block.id !== "plan")
          .map((block) => {
	            const agentId = block.agentId ?? "";
            return {
              agent: agentId,
              task: block.instruction ?? block.title ?? block.id,
              action: block.action,
              tool: block.tool,
              blockId: block.id,
              blockType: block.type,
              title: block.title,
              targetAgentTeamId: block.agentTeamId,
              connectorType: block.connectorType,
              publisherRef: block.publisherRef,
              agentName: agents.find((agent) => agent.id === agentId)?.name ?? agentId,
            };
          })
      : parsed?.workers.map((worker) => ({
          ...worker,
          agentName: agents.find((agent) => agent.id === worker.agent)?.name ?? worker.agent,
        })) ?? [];

  return {
    strategy: parsed?.strategy ?? team?.workflowType ?? "single",
    leader: {
      agentId: leaderId,
      agentName: leader?.name ?? (leaderId || uiText("ui.generated.c724e005491")),
      role: leader?.role ?? "leader",
    },
    workers,
    aggregation: parsed?.aggregation
      ? {
          ...parsed.aggregation,
          agentName:
            agents.find((agent) => agent.id === parsed.aggregation?.agent)?.name ??
            parsed.aggregation.agent,
        }
      : null,
    conflictResolution: parsed?.conflictResolution ?? { method: "leader_decision" },
    splitStrategy: parsed?.splitStrategy ?? null,
    nodeCount:
      parsed?.blocks && parsed.blocks.length > 0
        ? parsed.blocks.length
        : 1 + workers.length + (parsed?.aggregation ? 1 : 0),
  };
}

export function buildNodeSpecsFromRunPlan(value: string, agents: Agent[]) {
	  const parsed = parseRunPlan(value);
	  if (!parsed) return [];
	  const leaderExists = agents.some((agent) => agent.id === parsed.leader);
	  const leaderAgentId = leaderExists ? parsed.leader : "";
	  if (!leaderAgentId) return [];

  if (parsed.blocks && parsed.blocks.length > 0) {
    return parsed.blocks.map((block, index) => {
	      const agentId =
	        block.agentId && agents.some((agent) => agent.id === block.agentId)
	          ? block.agentId
	          : "";
      return {
        nodeKey: normalizeNodeKey(block.id, index),
        agentId,
        dependsOn: (block.dependsOn ?? []).map((dependency, dependencyIndex) =>
          normalizeNodeKey(dependency, dependencyIndex),
        ),
        input: {
          action: block.action ?? defaultActionForBlock(block.type),
          tool: block.tool ?? defaultToolForBlock(block.type),
          assignment: block.instruction ?? block.title ?? block.id,
          blockId: block.id,
          blockType: block.type,
          title: block.title ?? block.id,
          targetAgentTeamId: block.agentTeamId,
          script: block.script,
          url: block.url,
          method: block.method,
          connectorType: block.connectorType,
          publisherRef: block.publisherRef,
          payloadTemplate: block.payloadTemplate,
        },
      };
    });
  }

  const defaultWorkerTool =
    parsed.defaultWorkerTool ?? (parsed.splitStrategy === "by_repository" ? "repo.clone.read" : "repo.diff.read");

  const workerNodes = parsed.workers
    .filter((worker) => agents.some((agent) => agent.id === worker.agent))
    .map((worker, index) => ({
      nodeKey: `worker_${index + 1}`,
      agentId: worker.agent,
      dependsOn: ["plan"],
      input: {
        action: worker.action ?? "execute",
        tool: worker.tool ?? defaultWorkerTool,
        assignment: worker.task,
      },
    }));

  const aggregateAgentId =
    parsed.aggregation?.agent && agents.some((agent) => agent.id === parsed.aggregation?.agent)
      ? parsed.aggregation.agent
      : leaderAgentId;

  return [
    {
      nodeKey: "plan",
      agentId: leaderAgentId,
      dependsOn: [],
      input: {
        action: "plan",
        tool: "memory.retrieve",
        strategy: parsed.strategy,
      },
    },
    ...workerNodes,
    {
      nodeKey: "aggregate",
      agentId: aggregateAgentId,
      dependsOn: workerNodes.map((node) => node.nodeKey),
      input: {
        action: parsed.aggregation?.action ?? "publish",
        tool: parsed.aggregation?.tool ?? "finding.aggregate",
        method: parsed.aggregation?.method ?? "deduplicate_rank_and_publish",
      },
    },
  ];
}

export function synthesizeTeamNodes(team: AgentTeam, agents: Agent[]): TaskRunNodeSpec[] {
  const teamAgents = agents.filter((agent) => agent.teamId === team.id);
  const leader = team.leaderAgentId
    ? teamAgents.find((agent) => agent.id === team.leaderAgentId) ?? null
    : null;
  const specialist =
    teamAgents.find((agent) => agent.role.toLowerCase() === "specialist") ??
    teamAgents[0] ??
    null;
  const executor =
    teamAgents.find((agent) => agent.role.toLowerCase() === "executor") ??
    specialist;
  const inspector =
    teamAgents.find((agent) => agent.role.toLowerCase() === "inspector") ??
    teamAgents[teamAgents.length - 1] ??
    null;

  if (!leader && !specialist && !inspector) return [];

  if (team.workflowType === "single") {
    const singleAgent = leader ?? specialist ?? inspector;
    if (!singleAgent) return [];
    return [
      {
        nodeKey: "single",
        agentId: singleAgent.id,
        dependsOn: [],
        input: { action: "analyze", tool: "memory.read" },
      },
    ];
  }

  const defaultLeader = leader ?? specialist ?? inspector;
  const defaultSpecialist = executor ?? specialist ?? leader ?? inspector;
  const defaultInspector = inspector ?? leader ?? specialist;
  if (!defaultLeader || !defaultSpecialist || !defaultInspector) return [];

  return [
    {
      nodeKey: "plan",
      agentId: defaultLeader.id,
      dependsOn: [],
      input: { action: "plan", tool: "memory.read" },
    },
    {
      nodeKey: "execute",
      agentId: defaultSpecialist.id,
      dependsOn: ["plan"],
      input: { action: "execute", tool: "repo.read" },
    },
    {
      nodeKey: "finalize",
      agentId: defaultInspector.id,
      dependsOn: ["execute"],
      input: { action: "finalize", tool: "repo.write" },
    },
  ];
}
