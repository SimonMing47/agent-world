import { type Agent, type AgentTeam, type TaskRunNode, type TaskRunPlan } from "@/server/db";
import { uiText } from "@/lib/language-pack";

export function summarizeTaskRunPlan(plan: TaskRunPlan, nodes: TaskRunNode[], agents: Agent[]) {
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
      return uiText("ui.generated.cc7f887e140");
    case "parallel":
      return uiText("ui.generated.c66ae402528");
    case "sequential":
      return uiText("ui.generated.cb14a22c1e2");
    default:
      return uiText("ui.generated.cbeb09bf83b");
  }
}
