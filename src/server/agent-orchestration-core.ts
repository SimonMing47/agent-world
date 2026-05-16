import { type Agent, type AgentTeam } from "@/server/db";

export type AgentTeamRunPlanWorker = {
  agent: string;
  task: string;
};

export type AgentTeamRunPlan = {
  strategy: string;
  leader: string;
  workers: AgentTeamRunPlanWorker[];
  aggregation?: {
    agent: string;
    method: string;
  };
  conflictResolution?: {
    method: string;
  };
  splitStrategy?: string;
};

function parseRunPlan(value: string): AgentTeamRunPlan | null {
  try {
    const parsed = JSON.parse(value) as Partial<AgentTeamRunPlan>;
    if (!parsed.strategy || !parsed.leader) return null;
    return {
      strategy: parsed.strategy,
      leader: parsed.leader,
      workers: Array.isArray(parsed.workers) ? parsed.workers : [],
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
  const leaderId = parsed?.leader ?? team?.leaderAgentId ?? agents[0]?.id ?? "";
  const leader = agents.find((agent) => agent.id === leaderId) ?? null;
  const workers =
    parsed?.workers.map((worker) => ({
      ...worker,
      agentName: agents.find((agent) => agent.id === worker.agent)?.name ?? worker.agent,
    })) ?? [];

  return {
    strategy: parsed?.strategy ?? team?.workflowType ?? "single",
    leader: {
      agentId: leaderId,
      agentName: leader?.name ?? (leaderId || "未配置 Leader"),
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
    nodeCount: 1 + workers.length + (parsed?.aggregation ? 1 : 0),
  };
}

export function buildNodeSpecsFromRunPlan(value: string, agents: Agent[]) {
  const parsed = parseRunPlan(value);
  if (!parsed) return [];
  const leaderExists = agents.some((agent) => agent.id === parsed.leader);
  const leaderAgentId = leaderExists ? parsed.leader : agents[0]?.id;
  if (!leaderAgentId) return [];

  const workerNodes = parsed.workers
    .filter((worker) => agents.some((agent) => agent.id === worker.agent))
    .map((worker, index) => ({
      nodeKey: `worker_${index + 1}`,
      agentId: worker.agent,
      dependsOn: ["plan"],
      input: {
        action: "execute",
        tool: "repo.diff.read",
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
        action: "publish",
        tool: "finding.aggregate",
        method: parsed.aggregation?.method ?? "deduplicate_rank_and_publish",
      },
    },
  ];
}
