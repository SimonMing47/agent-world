import { addMinutes } from "date-fns";
import {
  execute,
  queryAll,
  queryOne,
  type Agent,
  type AgentTeam,
  type Contract,
  type DeveloperProfile,
  type EventLog,
  type HarnessProfile,
  type Kingdom,
  type ProviderProfile,
  type Quest,
  type QuestIntervention,
  type QuestNode,
  type QuestPlan,
  type RepositoryProfile,
  type RuntimeEndpoint,
  type ScheduleTemplate,
  type TavernListing,
  type WebhookEndpoint,
  type World,
} from "@/server/db";
import { buildContractSummary } from "@/server/contract-core";
import { buildExecutionBoard, summarizeNodeState } from "@/server/executor-core";
import { buildHarnessSummary } from "@/server/harness-core";
import { buildInvocationPlan } from "@/server/invocation-core";
import { discoverConfiguredRuntimes } from "@/server/opencode-adapter";
import { buildQuestPriorityAssessment, listDueSchedules, listScheduleAssessments } from "@/server/scheduler-core";
import { groupEventsByFoldGroup } from "@/server/trace-core";
import { buildWorldSummary, buildKingdomSummary } from "@/server/tenant-core";
import { buildAgentTeamSummary, buildTavernResume } from "@/server/registry-core";
import { buildProviderSelection } from "@/server/provider-core";
import { summarizeQuestPlan, buildTeamPlanningMode } from "@/server/planner-core";
import { buildRuntimeSummary } from "@/server/runtime-core";

export function listWorlds() {
  return queryAll<World>("SELECT * FROM worlds ORDER BY name ASC");
}

export function listKingdoms() {
  return queryAll<Kingdom>("SELECT * FROM kingdoms ORDER BY name ASC");
}

export function listHarnessProfiles() {
  return queryAll<HarnessProfile>("SELECT * FROM harness_profiles ORDER BY name ASC");
}

export function listAgentTeams() {
  return queryAll<AgentTeam>("SELECT * FROM agent_teams ORDER BY name ASC");
}

export function listAgents() {
  return queryAll<Agent>("SELECT * FROM agents ORDER BY name ASC");
}

export function listProviders() {
  return queryAll<ProviderProfile>("SELECT * FROM provider_profiles ORDER BY name ASC");
}

export function listRuntimeEndpoints() {
  return queryAll<RuntimeEndpoint>("SELECT * FROM runtime_endpoints ORDER BY name ASC");
}

export function listContracts() {
  return queryAll<Contract>("SELECT * FROM contracts ORDER BY created_at DESC");
}

export function listTavernListings() {
  return queryAll<TavernListing>("SELECT * FROM tavern_listings ORDER BY created_at DESC");
}

export function listScheduleTemplates() {
  return queryAll<ScheduleTemplate>("SELECT * FROM schedule_templates ORDER BY created_at DESC");
}

export function listQuests() {
  return queryAll<Quest>("SELECT * FROM quests ORDER BY created_at DESC");
}

export function listRepositories() {
  return queryAll<RepositoryProfile>("SELECT * FROM repository_profiles ORDER BY activity_score DESC, name ASC");
}

export function listDevelopers() {
  return queryAll<DeveloperProfile>("SELECT * FROM developer_profiles ORDER BY last_active_at DESC");
}

export function listWebhooks() {
  return queryAll<WebhookEndpoint>("SELECT * FROM webhook_endpoints ORDER BY name ASC");
}

export function getQuestDetail(questId: string) {
  const quest = queryOne<Quest>("SELECT * FROM quests WHERE id = ?", questId);

  if (!quest) return null;

  const world = queryOne<World>("SELECT * FROM worlds WHERE id = ?", quest.worldId);
  const kingdom = queryOne<Kingdom>("SELECT * FROM kingdoms WHERE id = ?", quest.kingdomId);
  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", quest.teamId);
  const contract = quest.contractId
    ? queryOne<Contract>("SELECT * FROM contracts WHERE id = ?", quest.contractId)
    : null;
  const plan = queryOne<QuestPlan>("SELECT * FROM quest_plans WHERE quest_id = ?", quest.id);
  const nodes = queryAll<QuestNode>("SELECT * FROM quest_nodes WHERE quest_id = ? ORDER BY node_key ASC", quest.id);
  const interventions = queryAll<QuestIntervention>(
    "SELECT * FROM quest_interventions WHERE quest_id = ? ORDER BY requested_at DESC",
    quest.id,
  );
  const events = queryAll<EventLog>(
    "SELECT * FROM event_logs WHERE quest_id = ? ORDER BY seq ASC",
    quest.id,
  );
  const agents = listAgents();
  const providers = listProviders();
  const runtimes = listRuntimeEndpoints();
  const harnesses = listHarnessProfiles();

  const teamHarness = team?.defaultHarnessId
    ? harnesses.find((item) => item.id === team.defaultHarnessId) ?? null
    : null;
  const captain = team?.captainAgentId
    ? agents.find((agent) => agent.id === team.captainAgentId) ?? null
    : null;
  const featuredAgent =
    captain ?? agents.find((agent) => agent.teamId === team?.id) ?? null;
  const runtime =
    runtimes.find((item) => item.kingdomId === quest.kingdomId) ??
    runtimes.find((item) => item.worldId === quest.worldId) ??
    null;
  const providerSelection =
    world && kingdom && featuredAgent
      ? buildProviderSelection({
          world,
          kingdom,
          agent: featuredAgent,
          providers,
        })
      : { provider: null, rationale: ["当前无法给出 Provider 选择结果。"] };

  return {
    quest,
    world,
    kingdom,
    team,
    contract: contract ? buildContractSummary(contract) : null,
    plan: plan && team
      ? summarizeQuestPlan(
          plan,
          nodes,
          agents.filter((agent) => agent.teamId === team.id),
        )
      : null,
    nodes: nodes.map((node) => ({
      ...summarizeNodeState(node),
      agentName: agents.find((agent) => agent.id === node.agentId)?.name ?? "未知 Agent",
    })),
    executionBoard: buildExecutionBoard(nodes),
    interventions,
    groupedEvents: groupEventsByFoldGroup(events),
    harness: teamHarness ? buildHarnessSummary(teamHarness) : null,
    invocationStages:
      world && kingdom && team && featuredAgent && teamHarness
        ? buildInvocationPlan({
            world,
            kingdom,
            team,
            agent: featuredAgent,
            harness: teamHarness,
            runtime,
            provider: providerSelection.provider,
            contract,
          })
        : [],
    providerRationale: providerSelection.rationale,
  };
}

export function getDashboardSnapshot() {
  const worlds = listWorlds();
  const kingdoms = listKingdoms();
  const teams = listAgentTeams();
  const agents = listAgents();
  const quests = listQuests();
  const schedules = listScheduleTemplates();
  const listings = listTavernListings();
  const contracts = listContracts();
  const providers = listProviders();
  const runtimes = listRuntimeEndpoints();
  const repositories = listRepositories();
  const developers = listDevelopers();
  const harnesses = listHarnessProfiles();

  const runningQuests = quests.filter((quest) => quest.status === "running");
  const awaitingQuests = quests.filter((quest) => quest.status === "awaiting");
  const completedQuests = quests.filter((quest) => quest.status === "completed");

  const worldSummaries = worlds.map((world) => buildWorldSummary(world, kingdoms));
  const kingdomSummaries = kingdoms.map((kingdom) => buildKingdomSummary(kingdom));
  const teamSummaries = teams.map((team) => buildAgentTeamSummary(team, agents));
  const tavernResumes = listings.map((listing) => {
    const team = teams.find((item) => item.id === listing.teamId);
    return {
      ...buildTavernResume(listing),
      teamName: team?.name ?? "未知 AgentTeam",
    };
  });

  const scheduleAssessments = listScheduleAssessments(schedules);
  const dueSchedules = listDueSchedules(schedules);
  const questPriorityBoard = quests
    .map((quest) => buildQuestPriorityAssessment(quest))
    .sort((left, right) => right.effectivePriority - left.effectivePriority);

  const featuredQuest = runningQuests[0] ?? awaitingQuests[0] ?? quests[0] ?? null;
  const featuredTeam = featuredQuest
    ? teams.find((team) => team.id === featuredQuest.teamId) ?? null
    : null;
  const featuredWorld = featuredQuest
    ? worlds.find((world) => world.id === featuredQuest.worldId) ?? null
    : null;
  const featuredKingdom = featuredQuest
    ? kingdoms.find((kingdom) => kingdom.id === featuredQuest.kingdomId) ?? null
    : null;
  const featuredHarness = featuredTeam?.defaultHarnessId
    ? harnesses.find((harness) => harness.id === featuredTeam.defaultHarnessId) ?? null
    : null;
  const featuredAgent =
    (featuredTeam?.captainAgentId
      ? agents.find((agent) => agent.id === featuredTeam.captainAgentId)
      : null) ??
    agents.find((agent) => agent.teamId === featuredTeam?.id) ??
    null;
  const providerSelection =
    featuredWorld && featuredKingdom && featuredAgent
      ? buildProviderSelection({
          world: featuredWorld,
          kingdom: featuredKingdom,
          agent: featuredAgent,
          providers,
        })
      : { provider: null, rationale: ["当前没有可展示的 Provider 选择结果。"] };
  const featuredRuntime =
    featuredQuest
      ? runtimes.find((runtime) => runtime.kingdomId === featuredQuest.kingdomId) ?? null
      : null;

  return {
    metrics: [
      {
        label: "运行中的 Quest",
        value: String(runningQuests.length),
        detail: "这些 Quest 正由进程内执行槽位接手运行。",
      },
      {
        label: "等待人工处理",
        value: String(awaitingQuests.length),
        detail: "这些 Quest 命中了 Harness 人工门禁，正在等待介入。",
      },
      {
        label: "公开 AgentTeam",
        value: String(teams.filter((team) => team.visibility === "public").length),
        detail: "这些 AgentTeam 可以在 Tavern 上架，并被其他 Kingdom 招募。",
      },
      {
        label: "生效中的 Contract",
        value: String(contracts.filter((contract) => contract.status === "active").length),
        detail: "跨 Kingdom 的服务访问只能通过这些 Contract 合法发生。",
      },
    ],
    worldSummaries,
    kingdomSummaries,
    teamSummaries,
    quests,
    tavernResumes,
    contracts: contracts.map((contract) => ({
      ...buildContractSummary(contract),
      providerTeamName: teams.find((team) => team.id === contract.providerTeamId)?.name ?? "未知 AgentTeam",
      consumerKingdomName:
        kingdoms.find((kingdom) => kingdom.id === contract.consumerKingdomId)?.name ?? "未知 Kingdom",
    })),
    runtimes: runtimes.map((runtime) => buildRuntimeSummary(runtime)),
    repositories,
    developers,
    scheduleAssessments,
    dueScheduleCount: dueSchedules.length,
    questPriorityBoard,
    featuredInvocation:
      featuredWorld && featuredKingdom && featuredTeam && featuredAgent && featuredHarness
        ? buildInvocationPlan({
            world: featuredWorld,
            kingdom: featuredKingdom,
            team: featuredTeam,
            agent: featuredAgent,
            harness: featuredHarness,
            runtime: featuredRuntime,
            provider: providerSelection.provider,
            contract:
              featuredQuest?.contractId
                ? contracts.find((contract) => contract.id === featuredQuest.contractId) ?? null
                : null,
          })
        : [],
    featuredProviderRationale: providerSelection.rationale,
    featuredPlanningMode: featuredTeam ? buildTeamPlanningMode(featuredTeam) : null,
    upcomingWindow: addMinutes(new Date(), 60).toISOString(),
    completedQuestCount: completedQuests.length,
  };
}

export function getWallboardSnapshot() {
  const quests = listQuests();
  const teams = listAgentTeams();
  const agents = listAgents();
  const repositories = listRepositories();
  const developers = listDevelopers();
  const kingdoms = listKingdoms();
  const runtimes = listRuntimeEndpoints();

  return {
    activeQuests: quests.filter((quest) => ["running", "awaiting"].includes(quest.status)),
    topTeams: teams.slice(0, 3).map((team) => buildAgentTeamSummary(team, agents)),
    topRepositories: repositories.slice(0, 3),
    topDevelopers: developers.slice(0, 3),
    kingdoms: kingdoms.map((kingdom) => buildKingdomSummary(kingdom)),
    runtimes: runtimes.map((runtime) => buildRuntimeSummary(runtime)),
  };
}

export async function refreshRuntimeCatalogs() {
  const runtimes = listRuntimeEndpoints();
  const discoveries = await discoverConfiguredRuntimes(runtimes);

  for (const discovery of discoveries) {
    const current = runtimes.find((runtime) => runtime.baseUrl === discovery.baseUrl);

    if (current) {
      execute(
        "UPDATE runtime_endpoints SET health_status = ?, agent_catalog_json = ?, provider_catalog_json = ?, last_discovered_at = ? WHERE id = ?",
        discovery.status,
        JSON.stringify(discovery.agents),
        JSON.stringify(discovery.providers),
        new Date().toISOString(),
        current.id,
      );
    }
  }

  return discoveries;
}
