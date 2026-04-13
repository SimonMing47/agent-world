import { type Agent, type AgentTeam, type QuestNode, type QuestPlan } from "@/server/db";

export function summarizeQuestPlan(plan: QuestPlan, nodes: QuestNode[], agents: Agent[]) {
  const dag = JSON.parse(plan.dagJson) as {
    nodes?: Array<{ id: string; agent: string }>;
    edges?: string[][];
  };

  return {
    plannerMode: plan.plannerMode,
    summary: plan.summary,
    nodeCount: dag.nodes?.length ?? nodes.length,
    edgeCount: dag.edges?.length ?? 0,
    agentLabels: nodes
      .map((node) => agents.find((agent) => agent.id === node.agentId)?.name ?? node.nodeKey)
      .filter((value, index, array) => array.indexOf(value) === index),
  };
}

export function buildTeamPlanningMode(team: AgentTeam) {
  switch (team.workflowType) {
    case "dag":
      return "Captain agent can create a multi-node DAG and the executor will validate it before running.";
    case "parallel":
      return "Multiple nodes may become ready at the same time as long as dependencies stay satisfied.";
    case "sequential":
      return "Nodes are advanced one-by-one in a deterministic order.";
    default:
      return "This team defaults to a single-node execution plan.";
  }
}
