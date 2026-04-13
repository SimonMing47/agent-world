import { type Agent, type AgentTeam, type TavernListing } from "@/server/db";

export function buildAgentTeamSummary(team: AgentTeam, agents: Agent[]) {
  return {
    id: team.id,
    name: team.name,
    workflowType: team.workflowType,
    visibility: team.visibility,
    agentCount: agents.filter((agent) => agent.teamId === team.id).length,
    timeoutMinutes: Math.round(team.timeoutMs / 60000),
    successRateTarget: team.successRateThreshold,
  };
}

export function buildTavernResume(listing: TavernListing) {
  const resume = JSON.parse(listing.resumeJson) as {
    successRate?: number;
    avgLatencyMs?: number;
    avgCostUsd?: number;
    topTasks?: string[];
  };

  return {
    id: listing.id,
    recruitmentMode: listing.recruitmentMode,
    status: listing.status,
    tags: JSON.parse(listing.tagsJson) as string[],
    resume,
  };
}
