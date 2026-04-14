import { addMinutes } from "date-fns";
import { randomUUID } from "node:crypto";
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
import { buildContractSummary, evaluateContractAccess } from "@/server/contract-core";
import { buildExecutionBoard, summarizeNodeState } from "@/server/executor-core";
import {
  buildHarnessSummary,
  composeHarnessProfile,
  evaluateHarnessToolPolicy,
} from "@/server/harness-core";
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
    executionInsights: getQuestExecutionBoard(quest.id),
    dependencyGraph: getQuestDependencyGraph(quest.id),
    costBreakdown: getQuestCostBreakdown(quest.id),
    policyHits: getQuestPolicyHits(quest.id),
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

type QuestNodeSpec = {
  nodeKey: string;
  agentId: string;
  dependsOn?: string[];
  input?: Record<string, unknown>;
};

type SubmitQuestInput = {
  teamId: string;
  sourceType: Quest["sourceType"];
  sourceRef?: string | null;
  requestedBy: string;
  priority?: number;
  contractId?: string | null;
  plannerMode?: string;
  summary?: string;
  inputPayload: Record<string, unknown>;
  nodes?: QuestNodeSpec[];
};

function nowIso() {
  return new Date().toISOString();
}

function getQuestNodes(questId: string) {
  return queryAll<QuestNode>("SELECT * FROM quest_nodes WHERE quest_id = ? ORDER BY node_key ASC", questId);
}

function getNextEventSeq(questId: string) {
  const row = queryOne<{ maxSeq: number | null }>(
    "SELECT MAX(seq) as maxSeq FROM event_logs WHERE quest_id = ?",
    questId,
  );
  return (row?.maxSeq ?? 0) + 1;
}

function appendQuestEvent(args: {
  traceId: string;
  questId: string;
  nodeId?: string | null;
  phase: string;
  foldGroup: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}) {
  execute(
    "INSERT INTO event_logs (id, trace_id, quest_id, node_id, seq, phase, fold_group, title, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    randomUUID(),
    args.traceId,
    args.questId,
    args.nodeId ?? null,
    getNextEventSeq(args.questId),
    args.phase,
    args.foldGroup,
    args.title,
    args.content,
    JSON.stringify(args.metadata ?? {}),
    nowIso(),
  );
}

function synthesizeTeamNodes(team: AgentTeam) {
  const teamAgents = listAgents().filter((agent) => agent.teamId === team.id);
  const captain = team.captainAgentId
    ? teamAgents.find((agent) => agent.id === team.captainAgentId) ?? null
    : null;
  const specialist =
    teamAgents.find((agent) => agent.role.toLowerCase() === "specialist") ??
    teamAgents[0] ??
    null;
  const reviewer =
    teamAgents.find((agent) => agent.role.toLowerCase() === "reviewer") ??
    teamAgents[teamAgents.length - 1] ??
    null;

  if (!captain && !specialist && !reviewer) return [];

  if (team.workflowType === "single") {
    const singleAgent = captain ?? specialist ?? reviewer;
    if (!singleAgent) return [];
    return [
      {
        nodeKey: "single",
        agentId: singleAgent.id,
        dependsOn: [],
        input: { action: "analyze", tool: "memory.read" },
      },
    ] satisfies QuestNodeSpec[];
  }

  const defaultCaptain = captain ?? specialist ?? reviewer;
  const defaultSpecialist = specialist ?? captain ?? reviewer;
  const defaultReviewer = reviewer ?? captain ?? specialist;
  if (!defaultCaptain || !defaultSpecialist || !defaultReviewer) return [];

  return [
    {
      nodeKey: "plan",
      agentId: defaultCaptain.id,
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
      nodeKey: "review",
      agentId: defaultReviewer.id,
      dependsOn: ["execute"],
      input: { action: "review", tool: "repo.write" },
    },
  ] satisfies QuestNodeSpec[];
}

function loadComposedHarnessForQuest(quest: Quest) {
  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", quest.teamId);
  const profiles = listHarnessProfiles();
  if (!team) return null;

  return composeHarnessProfile({
    profiles,
    worldId: quest.worldId,
    kingdomId: quest.kingdomId,
    teamId: team.id,
  });
}

function resolveQuestStatusFromNodes(nodes: QuestNode[]) {
  if (nodes.every((node) => node.status === "completed")) return "completed";
  if (nodes.some((node) => node.status === "awaiting")) return "awaiting";
  if (nodes.some((node) => node.status === "failed")) return "failed";
  if (nodes.some((node) => node.status === "running")) return "running";
  return "running";
}

function classifyFailure(args: {
  reason: string;
  policyViolation?: boolean;
  contractViolation?: boolean;
  timeout?: boolean;
}) {
  if (args.policyViolation) return "policy_violation";
  if (args.contractViolation) return "contract_violation";
  if (args.timeout) return "timeout";
  if (args.reason.toLowerCase().includes("budget")) return "budget_exceeded";
  return "runtime_error";
}

const COST_PER_COMPLETED_NODE = 0.5;
const BASE_ESTIMATED_NODE_COST = 0.25;
const BASE_ACTUAL_NODE_COST = 0.3;
const PER_ATTEMPT_NODE_COST = 0.2;

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function submitQuest(input: SubmitQuestInput) {
  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", input.teamId);
  if (!team) {
    throw new Error("AgentTeam 不存在。");
  }

  const kingdom = queryOne<Kingdom>("SELECT * FROM kingdoms WHERE id = ?", team.kingdomId);
  if (!kingdom) {
    throw new Error("Kingdom 不存在。");
  }

  const world = queryOne<World>("SELECT * FROM worlds WHERE id = ?", kingdom.worldId);
  if (!world) {
    throw new Error("World 不存在。");
  }

  const questId = randomUUID();
  const traceId = randomUUID();
  const planId = randomUUID();
  const createdAt = nowIso();
  const nodeSpecs = input.nodes?.length ? input.nodes : synthesizeTeamNodes(team);
  const dagNodes = nodeSpecs.map((node) => ({ id: node.nodeKey, agent: node.agentId }));
  const dagEdges = nodeSpecs.flatMap((node) =>
    (node.dependsOn ?? []).map((dependency) => [dependency, node.nodeKey]),
  );

  execute(
    "INSERT INTO quests (id, world_id, kingdom_id, team_id, contract_id, source_type, source_ref, status, priority, input_payload_json, output_payload_json, cost_estimate, cost_actual, trace_id, requested_by, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    questId,
    world.id,
    kingdom.id,
    team.id,
    input.contractId ?? null,
    input.sourceType,
    input.sourceRef ?? null,
    "running",
    input.priority ?? 50,
    JSON.stringify(input.inputPayload),
    null,
    0,
    0,
    traceId,
    input.requestedBy,
    createdAt,
    null,
  );

  execute(
    "INSERT INTO quest_plans (id, quest_id, planner_mode, dag_json, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    planId,
    questId,
    input.plannerMode ?? (team.workflowType === "dag" ? "captain_agent" : "rule"),
    JSON.stringify({ nodes: dagNodes, edges: dagEdges }),
    input.summary ?? "任务已提交并生成执行图。",
    createdAt,
  );

  for (const node of nodeSpecs) {
    execute(
      "INSERT INTO quest_nodes (id, quest_id, plan_id, node_key, agent_id, depends_on_json, input_json, output_json, status, attempt_count, max_attempts, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      randomUUID(),
      questId,
      planId,
      node.nodeKey,
      node.agentId,
      JSON.stringify(node.dependsOn ?? []),
      JSON.stringify(node.input ?? {}),
      null,
      "submitted",
      0,
      3,
      null,
      null,
    );
  }

  appendQuestEvent({
    traceId,
    questId,
    phase: "planning",
    foldGroup: "Planning",
    title: "Quest submitted",
    content: `Quest 已进入 ${team.name} 的执行队列。`,
    metadata: {
      workflowType: team.workflowType,
      plannerMode: input.plannerMode ?? "rule",
      nodeCount: nodeSpecs.length,
    },
  });

  return getQuestDetail(questId);
}

export function executeQuestTick(questId: string, requestedBy = "system") {
  const quest = queryOne<Quest>("SELECT * FROM quests WHERE id = ?", questId);
  if (!quest) throw new Error("Quest 不存在。");

  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", quest.teamId);
  const nodes = getQuestNodes(questId);
  if (!team || nodes.length === 0) return getQuestDetail(questId);

  const composedHarness = loadComposedHarnessForQuest(quest);
  const contract = quest.contractId
    ? queryOne<Contract>("SELECT * FROM contracts WHERE id = ?", quest.contractId)
    : null;

  for (const node of nodes) {
    if (node.status !== "submitted") continue;
    const dependencies = JSON.parse(node.dependsOnJson) as string[];
    const dependencyNodes = nodes.filter((candidate) => dependencies.includes(candidate.nodeKey));
    const ready = dependencyNodes.length === dependencies.length && dependencyNodes.every((candidate) => candidate.status === "completed");
    if (ready) {
      execute("UPDATE quest_nodes SET status = ? WHERE id = ?", "ready", node.id);
      appendQuestEvent({
        traceId: quest.traceId,
        questId: quest.id,
        nodeId: node.id,
        phase: "planning",
        foldGroup: "Planning",
        title: "Node unlocked",
        content: `节点 ${node.nodeKey} 依赖满足，进入可执行状态。`,
      });
    }
  }

  const refreshedNodes = getQuestNodes(questId);
  const runnable = refreshedNodes.find((node) => node.status === "ready");
  if (!runnable) {
    execute("UPDATE quests SET status = ? WHERE id = ?", resolveQuestStatusFromNodes(refreshedNodes), quest.id);
    return getQuestDetail(questId);
  }

  execute(
    "UPDATE quest_nodes SET status = ?, started_at = ?, attempt_count = attempt_count + 1 WHERE id = ?",
    "running",
    nowIso(),
    runnable.id,
  );

  appendQuestEvent({
    traceId: quest.traceId,
    questId: quest.id,
    nodeId: runnable.id,
    phase: "thinking",
    foldGroup: "Analysis",
    title: "Node started",
    content: `节点 ${runnable.nodeKey} 开始执行，发起人：${requestedBy}。`,
  });

  const nodeInput = JSON.parse(runnable.inputJson) as { action?: string; tool?: string };
  const simulatedDurationMs = Number(
    (nodeInput as { simulatedDurationMs?: unknown }).simulatedDurationMs ?? 0,
  );
  const timeoutReached = simulatedDurationMs > team.timeoutMs;
  const action = nodeInput.action ?? "execute";
  const tool = nodeInput.tool ?? "memory.read";

  const contractDecision = evaluateContractAccess({
    contract,
    isCrossKingdomCall: Boolean(contract),
    action,
    tool,
  });
  if (!contractDecision.allowed) {
    const failureClass = classifyFailure({
      reason: contractDecision.reason,
      contractViolation: true,
    });
    execute(
      "UPDATE quest_nodes SET status = ?, output_json = ?, completed_at = ? WHERE id = ?",
      "failed",
      JSON.stringify({ failureClass, reason: contractDecision.reason }),
      nowIso(),
      runnable.id,
    );
    execute("UPDATE quests SET status = ? WHERE id = ?", "failed", quest.id);
    appendQuestEvent({
      traceId: quest.traceId,
      questId: quest.id,
      nodeId: runnable.id,
      phase: "contract_violation",
      foldGroup: "Human Actions",
      title: "Contract blocked",
      content: contractDecision.reason,
      metadata: { failureClass, violation: contractDecision.violation },
    });
    return getQuestDetail(questId);
  }

  const harnessDecision = composedHarness
    ? evaluateHarnessToolPolicy(composedHarness.resolved, tool)
    : {
        allowed: true,
        requiresApproval: false,
        reason: "未配置 Harness，默认放行。",
        policyHit: "allow" as const,
      };

  if (!harnessDecision.allowed) {
    const failureClass = classifyFailure({
      reason: harnessDecision.reason,
      policyViolation: true,
    });
    execute(
      "UPDATE quest_nodes SET status = ?, output_json = ?, completed_at = ? WHERE id = ?",
      "failed",
      JSON.stringify({ failureClass, reason: harnessDecision.reason }),
      nowIso(),
      runnable.id,
    );
    execute("UPDATE quests SET status = ? WHERE id = ?", "failed", quest.id);
    appendQuestEvent({
      traceId: quest.traceId,
      questId: quest.id,
      nodeId: runnable.id,
      phase: "policy_violation",
      foldGroup: "Human Actions",
      title: "Harness blocked",
      content: harnessDecision.reason,
      metadata: { failureClass, policyHit: harnessDecision.policyHit },
    });
    return getQuestDetail(questId);
  }

  if (harnessDecision.requiresApproval) {
    execute("UPDATE quest_nodes SET status = ? WHERE id = ?", "awaiting", runnable.id);
    execute("UPDATE quests SET status = ? WHERE id = ?", "awaiting", quest.id);
    execute(
      "INSERT INTO quest_interventions (id, quest_id, node_id, kind, status, requested_action, resolution_note, requested_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      randomUUID(),
      quest.id,
      runnable.id,
      "approval",
      "pending",
      `Approve tool ${tool} for node ${runnable.nodeKey}`,
      null,
      nowIso(),
      null,
    );
    appendQuestEvent({
      traceId: quest.traceId,
      questId: quest.id,
      nodeId: runnable.id,
      phase: "approval_required",
      foldGroup: "Human Actions",
      title: "Approval required",
      content: harnessDecision.reason,
      metadata: { tool, policyHit: harnessDecision.policyHit },
    });
    return getQuestDetail(questId);
  }

  if (timeoutReached) {
    const failureClass = classifyFailure({
      reason: "节点执行超时",
      timeout: true,
    });
    execute(
      "UPDATE quest_nodes SET status = ?, output_json = ?, completed_at = ? WHERE id = ?",
      "failed",
      JSON.stringify({ failureClass, reason: "节点执行超时" }),
      nowIso(),
      runnable.id,
    );
    execute("UPDATE quests SET status = ? WHERE id = ?", "failed", quest.id);
    appendQuestEvent({
      traceId: quest.traceId,
      questId: quest.id,
      nodeId: runnable.id,
      phase: "timeout",
      foldGroup: "Analysis",
      title: "Node timeout",
      content: `节点 ${runnable.nodeKey} 执行超时。`,
      metadata: { failureClass },
    });
    return getQuestDetail(questId);
  }

  execute(
    "UPDATE quest_nodes SET status = ?, output_json = ?, completed_at = ? WHERE id = ?",
    "completed",
    JSON.stringify({
      result: "ok",
      action,
      tool,
      executedBy: requestedBy,
      completedAt: nowIso(),
    }),
    nowIso(),
    runnable.id,
  );

  appendQuestEvent({
    traceId: quest.traceId,
    questId: quest.id,
    nodeId: runnable.id,
    phase: "tool_result",
    foldGroup: "Synthesis",
    title: "Node completed",
    content: `节点 ${runnable.nodeKey} 已完成，工具 ${tool} 执行成功。`,
  });

  const completedNodes = getQuestNodes(quest.id);
  const questStatus = resolveQuestStatusFromNodes(completedNodes);
  execute(
    "UPDATE quests SET status = ?, completed_at = ?, cost_actual = ? WHERE id = ?",
    questStatus,
    questStatus === "completed" ? nowIso() : null,
    roundCurrency(
      completedNodes.filter((node) => node.status === "completed").length *
        COST_PER_COMPLETED_NODE,
    ),
    quest.id,
  );

  return getQuestDetail(questId);
}

export function retryQuestNode(args: { questId: string; nodeId: string; requestedBy: string }) {
  const quest = queryOne<Quest>("SELECT * FROM quests WHERE id = ?", args.questId);
  const node = queryOne<QuestNode>("SELECT * FROM quest_nodes WHERE id = ? AND quest_id = ?", args.nodeId, args.questId);
  if (!quest || !node) {
    throw new Error("Quest 或 Node 不存在。");
  }

  if (node.attemptCount >= node.maxAttempts) {
    throw new Error("已达到最大重试次数。");
  }

  execute(
    "UPDATE quest_nodes SET status = ?, output_json = ?, started_at = ?, completed_at = ? WHERE id = ?",
    "ready",
    null,
    null,
    null,
    node.id,
  );
  execute("UPDATE quests SET status = ? WHERE id = ?", "running", quest.id);

  appendQuestEvent({
    traceId: quest.traceId,
    questId: quest.id,
    nodeId: node.id,
    phase: "planning",
    foldGroup: "Planning",
    title: "Node retried",
    content: `${args.requestedBy} 触发节点 ${node.nodeKey} 重试。`,
  });

  return getQuestDetail(args.questId);
}

export function resolveQuestIntervention(args: {
  interventionId: string;
  decision: "approved" | "rejected";
  resolutionNote?: string;
  resolvedBy: string;
}) {
  const intervention = queryOne<QuestIntervention>(
    "SELECT * FROM quest_interventions WHERE id = ?",
    args.interventionId,
  );
  if (!intervention) throw new Error("Intervention 不存在。");

  const quest = queryOne<Quest>("SELECT * FROM quests WHERE id = ?", intervention.questId);
  if (!quest) throw new Error("Quest 不存在。");

  execute(
    "UPDATE quest_interventions SET status = ?, resolution_note = ?, resolved_at = ? WHERE id = ?",
    args.decision,
    args.resolutionNote ?? null,
    nowIso(),
    intervention.id,
  );

  if (intervention.nodeId) {
    execute(
      "UPDATE quest_nodes SET status = ? WHERE id = ?",
      args.decision === "approved" ? "ready" : "failed",
      intervention.nodeId,
    );
  }

  execute("UPDATE quests SET status = ? WHERE id = ?", args.decision === "approved" ? "running" : "failed", quest.id);

  appendQuestEvent({
    traceId: quest.traceId,
    questId: quest.id,
    nodeId: intervention.nodeId,
    phase: "approval_result",
    foldGroup: "Human Actions",
    title: "Intervention resolved",
    content: `${args.resolvedBy} 将干预单 ${intervention.id} 标记为 ${args.decision}。`,
    metadata: { resolutionNote: args.resolutionNote ?? null },
  });

  return getQuestDetail(quest.id);
}

export function resumeQuest(questId: string, requestedBy: string) {
  const quest = queryOne<Quest>("SELECT * FROM quests WHERE id = ?", questId);
  if (!quest) throw new Error("Quest 不存在。");

  execute("UPDATE quest_nodes SET status = ? WHERE quest_id = ? AND status = ?", "ready", questId, "awaiting");
  execute("UPDATE quests SET status = ? WHERE id = ?", "running", questId);

  appendQuestEvent({
    traceId: quest.traceId,
    questId,
    phase: "approval_result",
    foldGroup: "Human Actions",
    title: "Quest resumed",
    content: `${requestedBy} 恢复了任务执行。`,
  });

  return getQuestDetail(questId);
}

export function getQuestExecutionBoard(questId: string) {
  const quest = queryOne<Quest>("SELECT * FROM quests WHERE id = ?", questId);
  if (!quest) return null;
  const nodes = getQuestNodes(questId);

  const readyByDependency = nodes.map((node) => {
    const deps = JSON.parse(node.dependsOnJson) as string[];
    const dependencyNodes = nodes.filter((candidate) => deps.includes(candidate.nodeKey));
    const dependenciesReady =
      deps.length === 0 ||
      (dependencyNodes.length === deps.length &&
        dependencyNodes.every((candidate) => candidate.status === "completed"));
    return {
      nodeId: node.id,
      nodeKey: node.nodeKey,
      status: node.status,
      dependenciesReady,
      dependencies: deps,
    };
  });

  const total = nodes.length;
  const completedCount = nodes.filter((node) => node.status === "completed").length;
  const failedCount = nodes.filter((node) => node.status === "failed").length;
  const awaitingCount = nodes.filter((node) => node.status === "awaiting").length;
  const retryableCount = nodes.filter((node) => node.status === "failed" && node.attemptCount < node.maxAttempts).length;
  const throughput = total === 0 ? 0 : completedCount / total;
  const failureRate = total === 0 ? 0 : failedCount / total;
  const humanInterventionRate = total === 0 ? 0 : awaitingCount / total;
  const retryRecoveryPotential = failedCount === 0 ? 0 : retryableCount / failedCount;

  return {
    questId,
    questStatus: quest.status,
    board: buildExecutionBoard(nodes),
    readiness: readyByDependency,
    metrics: {
      throughput: Number(throughput.toFixed(2)),
      failureRate: Number(failureRate.toFixed(2)),
      humanInterventionRate: Number(humanInterventionRate.toFixed(2)),
      retryRecoveryPotential: Number(retryRecoveryPotential.toFixed(2)),
    },
  };
}

export function getQuestDependencyGraph(questId: string) {
  const plan = queryOne<QuestPlan>("SELECT * FROM quest_plans WHERE quest_id = ?", questId);
  const nodes = getQuestNodes(questId);
  if (!plan) return null;
  const dag = JSON.parse(plan.dagJson) as {
    nodes?: Array<{ id: string; agent: string }>;
    edges?: string[][];
  };
  return {
    questId,
    plannerMode: plan.plannerMode,
    summary: plan.summary,
    nodes: nodes.map((node) => ({
      id: node.id,
      nodeKey: node.nodeKey,
      agentId: node.agentId,
      status: node.status,
      dependsOn: JSON.parse(node.dependsOnJson) as string[],
    })),
    edges: dag.edges ?? [],
  };
}

export function getQuestCostBreakdown(questId: string) {
  const quest = queryOne<Quest>("SELECT * FROM quests WHERE id = ?", questId);
  if (!quest) return null;
  const nodes = getQuestNodes(questId);
  const nodeCosts = nodes.map((node) => ({
    nodeId: node.id,
    nodeKey: node.nodeKey,
    status: node.status,
    attemptCount: node.attemptCount,
    estimatedUsd: roundCurrency(
      BASE_ESTIMATED_NODE_COST + node.attemptCount * PER_ATTEMPT_NODE_COST,
    ),
    actualUsd:
      node.status === "completed"
        ? roundCurrency(BASE_ACTUAL_NODE_COST + node.attemptCount * PER_ATTEMPT_NODE_COST)
        : 0,
  }));
  const estimatedUsd = roundCurrency(
    nodeCosts.reduce((sum, node) => sum + node.estimatedUsd, 0),
  );
  const actualUsd = roundCurrency(nodeCosts.reduce((sum, node) => sum + node.actualUsd, 0));

  return {
    questId,
    status: quest.status,
    estimateFromQuest: quest.costEstimate,
    actualFromQuest: quest.costActual,
    estimatedUsd,
    actualUsd,
    nodeCosts,
  };
}

export function getQuestPolicyHits(questId: string) {
  const quest = queryOne<Quest>("SELECT * FROM quests WHERE id = ?", questId);
  if (!quest) return null;
  const events = queryAll<EventLog>(
    "SELECT * FROM event_logs WHERE quest_id = ? ORDER BY seq ASC",
    questId,
  );
  const policyPhases = [
    "approval_required",
    "policy_violation",
    "contract_violation",
    "approval_result",
    "timeout",
  ];

  const hits = events
    .filter((event) => policyPhases.includes(event.phase))
    .map((event) => ({
      seq: event.seq,
      phase: event.phase,
      title: event.title,
      content: event.content,
      createdAt: event.createdAt,
      metadata: JSON.parse(event.metadataJson) as Record<string, unknown>,
    }));

  return {
    questId,
    hitCount: hits.length,
    hits,
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
