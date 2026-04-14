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
      return "Captain Agent 可以先产出多节点 DAG，执行器会在真正运行前校验它。";
    case "parallel":
      return "只要依赖满足，多个节点就可以同时进入可执行状态。";
    case "sequential":
      return "节点会按确定顺序一个接一个推进。";
    default:
      return "这个团队默认使用单节点执行计划。";
  }
}
