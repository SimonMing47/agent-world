import { type Agent, type AgentTeam, type ServiceCatalogListing } from "@/server/db";

export function buildAgentTeamSummary(team: AgentTeam, agents: Agent[]) {
  const members = agents
    .filter((agent) => agent.teamId === team.id)
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
    }));

  return {
    id: team.id,
    name: team.name,
    workflowType: team.workflowType,
    visibility: team.visibility,
    agentCount: members.length,
    members,
    timeoutMinutes: Math.round(team.timeoutMs / 60000),
    successRateTarget: team.successRateThreshold,
  };
}

export function buildServiceCatalogEntry(listing: ServiceCatalogListing) {
  const resume = JSON.parse(listing.resumeJson) as {
    successRate?: number;
    avgLatencyMs?: number;
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
