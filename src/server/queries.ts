import { addMinutes } from "date-fns";
import {
  execute,
  queryAll,
  queryOne,
  type AgentProfile,
  type DispatchPreview,
  type ExecutionEvent,
  type HarnessProfile,
  type ProviderConnection,
  type RepositoryProfile,
  type RuntimeEndpoint,
  type TaskDefinition,
  type TaskRun,
  type TeamSpace,
  type WebhookEndpoint,
} from "@/server/db";
import { buildDispatchAssessment } from "@/server/dispatch-core";
import { buildHarnessSummary } from "@/server/harness-core";
import { buildInvocationPlan } from "@/server/invocation-core";
import { discoverConfiguredRuntimes } from "@/server/opencode-adapter";
import { listDispatchableTasks, listScheduleAssessments } from "@/server/scheduler-core";

export function listTeamSpaces() {
  return queryAll<TeamSpace>("SELECT * FROM team_spaces ORDER BY name");
}

export function listHarnessProfiles() {
  return queryAll<HarnessProfile>(
    "SELECT * FROM harness_profiles ORDER BY name",
  );
}

export function listTaskDefinitions() {
  return queryAll<TaskDefinition>(
    "SELECT * FROM task_definitions ORDER BY default_priority DESC, name ASC",
  );
}

export function listRuntimeEndpoints() {
  return queryAll<RuntimeEndpoint>(
    "SELECT * FROM runtime_endpoints ORDER BY team_space_id, name ASC",
  );
}

export function listProviders() {
  return queryAll<ProviderConnection>(
    "SELECT * FROM provider_connections ORDER BY name ASC",
  );
}

export function listRepositories() {
  return queryAll<RepositoryProfile>(
    "SELECT * FROM repository_profiles ORDER BY activity_score DESC, name ASC",
  );
}

export function listAgents() {
  return queryAll<AgentProfile>(
    "SELECT * FROM agent_profiles ORDER BY name ASC",
  );
}

export function listTaskRuns() {
  return queryAll<TaskRun>(
    "SELECT * FROM task_runs ORDER BY started_at DESC",
  );
}

export function listWebhooks() {
  return queryAll<WebhookEndpoint>(
    "SELECT * FROM webhook_endpoints ORDER BY name ASC",
  );
}

export function getRunDetail(runId: string) {
  const run = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", runId);

  if (!run) {
    return null;
  }

  const task = queryOne<TaskDefinition>(
    "SELECT * FROM task_definitions WHERE id = ?",
    run.taskDefinitionId,
  );
  const runtime = queryOne<RuntimeEndpoint>(
    "SELECT * FROM runtime_endpoints WHERE id = ?",
    run.runtimeEndpointId,
  );
  const harness = queryOne<HarnessProfile>(
    "SELECT * FROM harness_profiles WHERE id = ?",
    run.harnessProfileId,
  );
  const events = queryAll<ExecutionEvent>(
    "SELECT * FROM execution_events WHERE task_run_id = ? ORDER BY seq ASC",
    run.id,
  );
  const groupedEvents = events.reduce<Record<string, ExecutionEvent[]>>(
    (groups, event) => {
      groups[event.foldGroup] ??= [];
      groups[event.foldGroup].push(event);
      return groups;
    },
    {},
  );

  return {
    run,
    task,
    runtime,
    harness: harness ? buildHarnessSummary(harness) : null,
    groupedEvents,
  };
}

export function getDashboardSnapshot() {
  const teams = listTeamSpaces();
  const tasks = listTaskDefinitions();
  const runs = listTaskRuns();
  const runtimes = listRuntimeEndpoints();
  const harnesses = listHarnessProfiles();
  const agents = listAgents();
  const repositories = listRepositories();
  const scheduleAssessments = listScheduleAssessments(tasks);
  const dueTasks = listDispatchableTasks(tasks);

  const successCount = runs.filter((run) => run.resultStatus === "success").length;
  const activeRuns = runs.filter((run) => run.dispatchState === "running").length;
  const pausedRuns = runs.filter((run) => run.dispatchState === "waiting_human").length;

  const dispatchPreviews: DispatchPreview[] = tasks.slice(0, 3).map((task) => {
    const harness = harnesses.find(
      (profile) => profile.id === task.harnessProfileId,
    )!;

    const assessment = buildDispatchAssessment({
      task,
      harness,
      runtimes,
    });

    const team = teams.find((teamSpace) => teamSpace.id === task.teamSpaceId)!;

    return {
      taskName: assessment.taskName,
      teamSpace: team.name,
      priorityScore: assessment.priorityScore,
      selectedRuntimeName: assessment.selectedRuntimeName,
      selectedRuntimeStatus: assessment.selectedRuntimeStatus,
      harnessName: assessment.harnessName,
    };
  });

  return {
    metrics: [
      { label: "Running now", value: String(activeRuns), detail: "Currently owned by the invocation core." },
      { label: "Waiting for humans", value: String(pausedRuns), detail: "Runs that have crossed a harness approval gate." },
      {
        label: "Success rate",
        value: `${Math.round((successCount / Math.max(runs.length, 1)) * 100)}%`,
        detail: "Based on the seeded run history in SQLite.",
      },
      {
        label: "Healthy runtimes",
        value: String(runtimes.filter((runtime) => runtime.healthStatus === "healthy").length),
        detail: "Health is visible before dispatch, not after the fact.",
      },
    ],
    teams,
    tasks,
    runs,
    runtimes,
    agents,
    repositories,
    dispatchPreviews,
    scheduleAssessments,
    dueTaskCount: dueTasks.length,
    invocationStages:
      tasks.length > 0 && runtimes.length > 0
        ? buildInvocationPlan({
            task: tasks[0],
            harness: harnesses.find((profile) => profile.id === tasks[0].harnessProfileId)!,
            runtime: runtimes.find((runtime) => runtime.teamSpaceId === tasks[0].teamSpaceId) ?? null,
          })
        : [],
    upcomingWindow: addMinutes(new Date(), 45).toISOString(),
  };
}

export function getWallboardSnapshot() {
  const runs = listTaskRuns();
  const tasks = listTaskDefinitions();
  const repositories = listRepositories();
  const agents = listAgents();
  const developers = queryAll<{ id: string; name: string; focus: string; lastActiveAt: string }>(
    "SELECT * FROM developer_profiles ORDER BY last_active_at DESC",
  );
  const runtimes = listRuntimeEndpoints();

  return {
    running: runs.filter((run) => run.dispatchState === "running"),
    upcoming: tasks.filter((task) => Boolean(task.nextRunAt)),
    topRepositories: repositories.slice(0, 3),
    topAgents: agents.slice(0, 3),
    topDevelopers: developers.slice(0, 3),
    runtimes,
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
